import type { Assignment, Database, SolveResult, UnplacedSession } from "./types";
import {
  checkCandidate,
  computeScore,
  findConflicts,
  ctxFor,
  windowInterval,
  isTpRoomCompatible,
  type Candidate,
} from "./conflicts";
import { buildSlots, decomposeHours, overlaps, windowsFor } from "./time";

interface Session {
  key: string;
  teachingId: number;
  groupId: number;
  subjectId: number;
  hours: number;
  kind: "COURS" | "TP";
}

/**
 * Moteur de génération déterministe : placement glouton ordonné par degré de
 * contrainte, puis recherche locale pour optimiser les contraintes souples.
 * N'ajoute JAMAIS d'affectation qui viole une contrainte obligatoire :
 * chaque candidat est validé par checkCandidate avant insertion.
 */
export function solve(data: Database, keep?: Assignment[]): SolveResult {
  const ctx = ctxFor(data);
  const { slots, data: d } = ctx;
  const blocking: string[] = [];
  const unplaced: UnplacedSession[] = [];
  const failed: Array<{ s: Session; reasons: string[] }> = [];

  // ----- Pré-vérifications de faisabilité -----
  const compHours = new Map<string, number>();
  for (const t of d.teachings) {
    const s = d.subjects.find((x) => x.id === t.subjectId);
    if (!s) continue;
    compHours.set(s.competenceKey, (compHours.get(s.competenceKey) || 0) + t.hoursPerWeek);
  }
  for (const [comp, total] of compHours) {
    const qualified = d.instructors.filter((i) => i.active && i.competences.includes(comp));
    if (qualified.length === 0) {
      blocking.push(
        `Aucun formateur qualifié en « ${comp} » : impossible de couvrir ${total}h/semaine de séances associées à cette compétence.`
      );
    } else {
      const cap = qualified.reduce((s, i) => s + i.maxHoursPerWeek, 0);
      if (cap < total) {
        blocking.push(
          `Volume horaire impossible pour « ${comp} » : ${total}h/semaine demandées, mais les formateurs qualifiés (${qualified
            .map((i) => `${i.firstName} ${i.lastName}`)
            .join(", ")}) ne peuvent fournir au maximum ${cap}h/semaine.`
        );
      }
    }
  }
  for (const t of d.teachings) {
    const s = d.subjects.find((x) => x.id === t.subjectId);
    const g = d.groups.find((x) => x.id === t.groupId);
    if (!s || !g) continue;
    const rooms = d.rooms.filter(
      (r) =>
        r.allowedKinds.includes(s.kind) &&
        (s.kind !== "TP" || isTpRoomCompatible(s.competenceKey, r.name)) &&
        r.capacity >= g.studentCount
    );
    if (rooms.length === 0)
      blocking.push(
        `Aucune salle compatible pour ${g.name} × ${s.name} : ${
          s.kind === "TP" ? "aucun atelier conforme" : "aucune salle"
        } d'une capacité ≥ ${g.studentCount} ne permet ce type de séance.`
      );
  }

  // ----- Construction des séances à placer -----
  const sessions: Session[] = [];
  for (const t of d.teachings) {
    const s = d.subjects.find((x) => x.id === t.subjectId);
    if (!s) continue;
    const allowed = (s.kind === "TP" ? d.settings.tpDurations : d.settings.coursDurations).filter(
      (x) => windowsFor(slots, x).length > 0
    );
    const blocks = decomposeHours(t.hoursPerWeek, allowed);
    if (!blocks) {
      const anyWin =
        (s.kind === "TP" ? d.settings.tpDurations : d.settings.coursDurations).filter(
          (x) => windowsFor(slots, x).length > 0
        );
      unplaced.push({
        teachingId: t.id,
        groupId: t.groupId,
        subjectId: t.subjectId,
        hours: t.hoursPerWeek,
        reasons:
          anyWin.length === 0
            ? ["Aucune durée de séance autorisée ne forme un bloc continu dans la grille horaire actuelle."]
            : [
                `Volume de ${t.hoursPerWeek}h/durées autorisées non décomposable en blocs continus (durées disponibles : ${anyWin.join("h / ")}h).`,
              ],
      });
      continue;
    }
    for (const h of blocks)
      sessions.push({
        key: `${t.id}:${h}:${sessions.filter((x) => x.teachingId === t.id).length}`,
        teachingId: t.id,
        groupId: t.groupId,
        subjectId: t.subjectId,
        hours: h,
        kind: s.kind,
      });
  }

  // ----- État courant -----
  const placed: Assignment[] = []; // id incrémental local
  let seq = 0;
  const addPlaced = (c: Candidate): Assignment => {
    const a: Assignment = {
      id: -1 - seq++,
      versionId: 0,
      teachingId: c.teachingId ?? null,
      day: c.day,
      startSlot: c.startSlot,
      hours: c.hours,
      kind: c.kind,
      groupId: c.groupId,
      subjectId: c.subjectId,
      instructorId: c.instructorId,
      roomId: c.roomId,
      source: "gen",
    };
    placed.push(a);
    return a;
  };

  const keepIndex = new Map<string, Array<{ day: number; startSlot: number; instructorId: number; roomId: number }>>();
  for (const k of keep || []) {
    const key = `${k.groupId}|${k.subjectId}|${k.hours}`;
    if (!keepIndex.has(key)) keepIndex.set(key, []);
    keepIndex.get(key)!.push({ day: k.day, startSlot: k.startSlot, instructorId: k.instructorId, roomId: k.roomId });
  }
  const consumeKeep = (key: string, day: number, startSlot: number, instructorId: number, roomId: number) => {
    const list = keepIndex.get(key);
    if (!list) return;
    const i = list.findIndex(
      (x) => x.day === day && x.startSlot === startSlot && x.instructorId === instructorId && x.roomId === roomId
    );
    if (i >= 0) list.splice(i, 1);
  };

  const qualifiedOf = (subjectId: number) => {
    const s = d.subjects.find((x) => x.id === subjectId)!;
    return d.instructors.filter((i) => i.active && i.competences.includes(s.competenceKey));
  };
  const roomsOf = (subjectId: number, groupId: number) => {
    const s = d.subjects.find((x) => x.id === subjectId)!;
    const g = d.groups.find((x) => x.id === groupId)!;
    return d.rooms.filter(
      (r) =>
        r.allowedKinds.includes(s.kind) &&
        (s.kind !== "TP" || isTpRoomCompatible(s.competenceKey, r.name)) &&
        r.capacity >= g.studentCount
    );
  };

  // ----- Ordre de placement : les séances les plus contraintes d'abord -----
  const feasibleCount = (s: Session) => {
    const wins = windowsFor(slots, s.hours).length;
    return qualifiedOf(s.subjectId).length * roomsOf(s.subjectId, s.groupId).length * wins * d.settings.enabledDays.length;
  };
  const ordered = [...sessions].sort((a, b) => feasibleCount(a) - feasibleCount(b) || a.teachingId - b.teachingId || a.hours - b.hours);

  const weekLoad = (instructorId: number) => placed.filter((a) => a.instructorId === instructorId).reduce((s2, a) => s2 + a.hours, 0);
  const dayLoad = (instructorId: number, day: number) =>
    placed.filter((a) => a.instructorId === instructorId && a.day === day).reduce((s2, a) => s2 + a.hours, 0);
  const groupDayHas = (groupId: number, day: number) => placed.some((a) => a.groupId === groupId && a.day === day);

  const candidateScore = (s: Session, c: Candidate, keepKey: string): number => {
    let sc = 0;
    const keepList = keepIndex.get(keepKey);
    if (keepList) {
      const exact = keepList.some((x) => x.day === c.day && x.startSlot === c.startSlot && x.instructorId === c.instructorId && x.roomId === c.roomId);
      const pos = keepList.some((x) => x.day === c.day && x.startSlot === c.startSlot);
      if (exact) sc += 8;
      else if (pos) sc += 5;
      else if (keepList.some((x) => x.day === c.day)) sc += 2;
    }
    if (groupDayHas(s.groupId, c.day)) sc += 1.8; // compacité groupe
    const inst = d.instructors.find((i) => i.id === c.instructorId)!;
    const w = windowInterval(slots, c.startSlot, c.hours)!;
    if (inst.preferences.some((p) => p.day === c.day && p.slots.some((x) => w.slotIdx.includes(x)))) sc += 1.5; // préférence
    const subj = d.subjects.find((x) => x.id === s.subjectId)!;
    const peers = d.instructors.filter((i) => i.active && i.competences.includes(subj.competenceKey));
    if (peers.length > 1) {
      const load = weekLoad(c.instructorId);
      sc -= load * 0.12; // équilibre de charge
    }
    if (dayLoad(c.instructorId, c.day) + c.hours > 8) sc -= 0.8; // surcharge journalière
    if (dayLoad(c.instructorId, c.day) === 0) sc += 0.25; // éviter de fragmenter trop de jours
    sc -= c.day * 0.01; // léger biais vers le début de semaine
    return sc;
  };

  // ----- Placement glouton -----
  for (const s of ordered) {
    const keepKey = `${s.groupId}|${s.subjectId}|${s.hours}`;
    const qual = qualifiedOf(s.subjectId);
    const rooms = roomsOf(s.subjectId, s.groupId);
    const wins = windowsFor(slots, s.hours);
    if (qual.length === 0 || rooms.length === 0 || wins.length === 0) {
      const reasons: string[] = [];
      if (qual.length === 0)
        reasons.push("Aucun formateur qualifié (compétence requise) n'est disponible pour cette matière.");
      if (rooms.length === 0)
        reasons.push(
          `Aucune salle compatible (${s.kind === "TP" ? "atelier / espace pédagogique" : "salle de cours"}) avec une capacité suffisante.`
        );
      if (wins.length === 0) reasons.push("Aucun bloc continu de cette durée dans la grille horaire.");
      unplaced.push({ teachingId: s.teachingId, groupId: s.groupId, subjectId: s.subjectId, hours: s.hours, reasons });
      continue;
    }
    let best: { cand: Candidate; score: number } | null = null;
    const reasonBag = new Map<string, number>();
    for (const day of d.settings.enabledDays)
      for (const win of wins) {
        const startSlot = win[0].index;
        for (const inst of qual)
          for (const room of rooms) {
            const cand: Candidate = {
              day,
              startSlot,
              hours: s.hours,
              kind: s.kind,
              groupId: s.groupId,
              subjectId: s.subjectId,
              instructorId: inst.id,
              roomId: room.id,
              teachingId: s.teachingId,
            };
            const err = checkCandidate(cand, placed, ctx);
            if (err) {
              reasonBag.set(err.message, (reasonBag.get(err.message) || 0) + 1);
              continue;
            }
            const sc = candidateScore(s, cand, keepKey);
            if (!best || sc > best.score) best = { cand, score: sc };
          }
      }
    if (best) {
      addPlaced(best.cand);
      consumeKeep(keepKey, best.cand.day, best.cand.startSlot, best.cand.instructorId, best.cand.roomId);
    } else {
      const reasons = [...reasonBag.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
      failed.push({ s, reasons: reasons.length ? reasons : ["Aucun créneau compatible ne reste disponible."] });
    }
  }

  // ----- Backtracking : chaînes d'éjection -----
  // Pour une séance sans place, on cherche un créneau bloqué par 1 ou 2 séances déjà placées ;
  // on les déplace (récursivement, profondeur limitée) vers d'autres combinaisons valides.
  // Toute tentative qui échoue est annulée : le planning reste valide à chaque instant.
  const OVERLAP_CODES = new Set(["INSTRUCTOR_OVERLAP", "GROUP_OVERLAP", "ROOM_OVERLAP"]);
  const MAX_DEPTH = 3;
  let nodes = 0;
  const NODE_BUDGET = 60000;
  const sessionOf = (a: Assignment): Session => ({
    key: `bt:${a.id}`,
    teachingId: a.teachingId ?? 0,
    groupId: a.groupId,
    subjectId: a.subjectId,
    hours: a.hours,
    kind: a.kind,
  });
  const enumerate = (s: Session): Candidate[] => {
    const out: Candidate[] = [];
    const qual = qualifiedOf(s.subjectId);
    const rms = roomsOf(s.subjectId, s.groupId);
    for (const day of d.settings.enabledDays)
      for (const win of windowsFor(slots, s.hours))
        for (const inst of qual)
          for (const room of rms)
            out.push({
              day,
              startSlot: win[0].index,
              hours: s.hours,
              kind: s.kind,
              groupId: s.groupId,
              subjectId: s.subjectId,
              instructorId: inst.id,
              roomId: room.id,
              teachingId: s.teachingId,
            });
    return out;
  };
  const tryPlace = (s: Session, depth: number, protect: Set<number>): boolean => {
    const cands = enumerate(s);
    // 1. placement direct
    let best: { cand: Candidate; score: number } | null = null;
    for (const cand of cands) {
      if (nodes++ > NODE_BUDGET) return false;
      if (checkCandidate(cand, placed, ctx)) continue;
      const sc = candidateScore(s, cand, "");
      if (!best || sc > best.score) best = { cand, score: sc };
    }
    if (best) {
      addPlaced(best.cand);
      return true;
    }
    if (depth <= 0) return false;
    // 2. éjection de 1 à 2 séances bloquantes
    const options: Array<{ cand: Candidate; blockers: Assignment[] }> = [];
    for (const cand of cands) {
      if (nodes++ > NODE_BUDGET) break;
      const err = checkCandidate(cand, placed, ctx);
      if (!err || !OVERLAP_CODES.has(err.code)) continue;
      const w = windowInterval(slots, cand.startSlot, cand.hours);
      if (!w) continue;
      const conflicting = placed.filter((a) => {
        if (a.day !== cand.day) return false;
        if (a.instructorId !== cand.instructorId && a.groupId !== cand.groupId && a.roomId !== cand.roomId) return false;
        const aw = windowInterval(slots, a.startSlot, a.hours);
        return !!aw && overlaps(w.startMin, w.endMin, aw.startMin, aw.endMin);
      });
      if (conflicting.length === 0 || conflicting.length > 2) continue;
      if (conflicting.some((a) => protect.has(a.id))) continue;
      const others = placed.filter((a) => !conflicting.includes(a));
      if (checkCandidate(cand, others, ctx)) continue;
      options.push({ cand, blockers: conflicting });
    }
    options.sort((x, y) => x.blockers.length - y.blockers.length);
    for (const opt of options.slice(0, 12)) {
      const snapshot = placed.slice();
      for (const b of opt.blockers) placed.splice(placed.indexOf(b), 1);
      const mine = addPlaced(opt.cand);
      const protect2 = new Set(protect).add(mine.id);
      if (opt.blockers.every((b) => tryPlace(sessionOf(b), depth - 1, protect2))) return true;
      placed.length = 0;
      placed.push(...snapshot);
      if (nodes > NODE_BUDGET) return false;
    }
    return false;
  };
  for (const f of failed) {
    // Le placement direct a déjà échoué dans la phase gloutonne : seules les éjections peuvent aider.
    const snapshot = placed.slice();
    if (tryPlace(f.s, MAX_DEPTH, new Set())) continue;
    placed.length = 0;
    placed.push(...snapshot);
    unplaced.push({
      teachingId: f.s.teachingId,
      groupId: f.s.groupId,
      subjectId: f.s.subjectId,
      hours: f.s.hours,
      reasons: [
        ...f.reasons,
        `Aucune solution même après réaffectation des séances déjà placées (backtracking, profondeur ${MAX_DEPTH}, ${nodes} combinaisons testées).`,
      ],
    });
  }

  // ----- Recherche locale (contraintes souples) -----
  let currentScore = computeScore(placed, ctx).total;
  let budget = 20000;
  for (let pass = 0; pass < 3 && budget > 0; pass++) {
    for (const a of [...placed]) {
      if (budget <= 0) break;
      const others = placed.filter((x) => x.id !== a.id);
      const subj = d.subjects.find((x) => x.id === a.subjectId)!;
      const qual = d.instructors.filter((i) => i.active && i.competences.includes(subj.competenceKey));
      const rooms = d.rooms.filter((r) => r.allowedKinds.includes(subj.kind));
      const g = d.groups.find((x) => x.id === a.groupId)!;
      const okRooms = rooms.filter((r) => r.capacity >= g.studentCount);
      const wins = windowsFor(slots, a.hours);
      let moved = false;
      for (const day of d.settings.enabledDays)
        for (const win of wins)
          for (const inst of qual)
            for (const room of okRooms) {
              if (budget <= 0) break;
              budget--;
              const cand: Candidate = {
                day,
                startSlot: win[0].index,
                hours: a.hours,
                kind: a.kind,
                groupId: a.groupId,
                subjectId: a.subjectId,
                instructorId: inst.id,
                roomId: room.id,
                teachingId: a.teachingId,
              };
              if (cand.day === a.day && cand.startSlot === a.startSlot && cand.instructorId === a.instructorId && cand.roomId === a.roomId)
                continue;
              if (checkCandidate(cand, others, ctx)) continue;
              const trial = [...others];
              trial.push({ ...a, day: cand.day, startSlot: cand.startSlot, instructorId: cand.instructorId, roomId: cand.roomId });
              const sc = computeScore(trial, ctx).total;
              if (sc > currentScore) {
                const idx = placed.indexOf(a);
                placed[idx] = { ...a, day: cand.day, startSlot: cand.startSlot, instructorId: cand.instructorId, roomId: cand.roomId };
                currentScore = sc;
                moved = true;
                break;
              }
            }
      if (moved) continue;
    }
  }

  // ----- Garde-fou défensif : le planning renvoyé est toujours sans conflit -----
  let conflicts = findConflicts(placed, ctx);
  while (conflicts.length > 0) {
    const badId = conflicts[0].assignmentId!;
    const i = placed.findIndex((a) => a.id === badId);
    if (i < 0) break;
    const removed = placed[i];
    placed.splice(i, 1);
    const subj = d.subjects.find((x) => x.id === removed.subjectId);
    const grp = d.groups.find((x) => x.id === removed.groupId);
    unplaced.push({
      teachingId: removed.teachingId ?? 0,
      groupId: removed.groupId,
      subjectId: removed.subjectId,
      hours: removed.hours,
      reasons: [`Séance retirée par le garde-fou de sécurité (${subj?.name ?? "?"} de ${grp?.name ?? "?"}) : ${conflicts[0].message}`],
    });
    conflicts = findConflicts(placed, ctx);
  }
  const { total, breakdown } = computeScore(placed, ctx);

  const checks = [
    "Aucun formateur n'est affecté à deux groupes simultanément",
    "Aucun groupe n'a deux activités simultanées",
    "Aucune salle n'accueille deux groupes simultanément",
    "Tous les formateurs possèdent la compétence des matières enseignées",
    "Chaque TP est dans un atelier ou un espace pédagogique compatible",
    "Chaque cours théorique est dans une salle compatible",
    "Durées pédagogiques respectées (bloc continu pour 4h/6h)",
    "Pause 12h-14h et créneau après 18h réservés exclusivement aux TP Cuisine, Pâtisserie et Restaurant",
    "Disponibilités formateurs et salles respectées",
    "Plafonds horaires quotidiens et hebdomadaires respectés",
  ];

  return {
    assignments: placed.map((a) => ({
      teachingId: a.teachingId,
      day: a.day,
      startSlot: a.startSlot,
      hours: a.hours,
      kind: a.kind,
      groupId: a.groupId,
      subjectId: a.subjectId,
      instructorId: a.instructorId,
      roomId: a.roomId,
      source: a.source,
    })),
    unplaced,
    infeasible: unplaced.length > 0,
    blocking,
    score: total,
    breakdown,
    checks,
  };
}
