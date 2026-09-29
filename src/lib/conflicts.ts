import type { Assignment, Conflict, Database, ScoreBreakdown } from "./types";
import { buildSlots, overlaps, type SlotInfo } from "./time";

export interface Ctx {
  data: Database;
  slots: SlotInfo[];
}

export interface Candidate {
  day: number;
  startSlot: number;
  hours: number;
  kind: "COURS" | "TP";
  groupId: number;
  subjectId: number;
  instructorId: number;
  roomId: number;
  teachingId?: number | null;
}

interface Interval {
  startMin: number;
  endMin: number;
  slotIdx: number[];
}

/** Intervalle temps (minutes) d'une séance, null si la fenêtre n'est pas continue/valide. */
export function windowInterval(slots: SlotInfo[], startSlot: number, hours: number): Interval | null {
  if (startSlot < 0 || startSlot >= slots.length) return null;
  let acc = 0;
  const idx: number[] = [];
  for (let i = startSlot; i < slots.length; i++) {
    if (i > startSlot && slots[i].startMin !== slots[i - 1].endMin) return null; // discontinuité
    idx.push(i);
    acc += slots[i].hours;
    if (acc === hours) return { startMin: slots[startSlot].startMin, endMin: slots[i].endMin, slotIdx: idx };
    if (acc > hours) return null;
  }
  return null;
}

export function ctxFor(data: Database): Ctx {
  return { data, slots: buildSlots(data.settings.boundaries) };
}

function nameInstructors(data: Database, id: number): string {
  const i = data.instructors.find((x) => x.id === id);
  return i ? `${i.firstName} ${i.lastName}` : `Formateur #${id}`;
}
function nameGroups(data: Database, id: number): string {
  const g = data.groups.find((x) => x.id === id);
  return g ? g.name : `Groupe #${id}`;
}
function nameSubjects(data: Database, id: number): string {
  const s = data.subjects.find((x) => x.id === id);
  return s ? s.name : `Matière #${id}`;
}
function nameRooms(data: Database, id: number): string {
  const r = data.rooms.find((x) => x.id === id);
  return r ? r.name : `Salle #${id}`;
}

function blockedSet(list: Array<{ day: number; slots: number[] }>): Set<string> {
  const s = new Set<string>();
  for (const b of list || []) for (const sl of b.slots) s.add(`${b.day}:${sl}`);
  return s;
}

export function isTpRoomCompatible(competenceKey: string, roomName: string): boolean {
  const norm = roomName.toUpperCase();
  const k = competenceKey.toLowerCase();
  if (k.includes("cuisine")) return norm.includes("CUISINE");
  if (k.includes("patisserie")) return norm.includes("PAT") || norm.includes("CUISINE");
  if (k.includes("reception")) return norm.includes("RECEPTION") || norm.includes("INFO") || norm.includes("AMEDEUS");
  if (k.includes("plateaux") || k.includes("service") || k.includes("restaurant") || k.includes("bar"))
    return norm.includes("RESTAU") || norm.includes("BAR") || norm.includes("HOTEL") || norm.includes("CUISINE");
  if (k.includes("hebergement") || k.includes("etage") || k.includes("lingerie"))
    return norm.includes("DORTOIR") || norm.includes("BUANDERIE");
  return true;
}

export function isSpecialtyAllowedForExtendedHours(
  competenceKey: string,
  subjectName: string,
  groupSpecialty: string,
  groupName: string,
  allowedList?: string[]
): boolean {
  const allowed = allowedList && allowedList.length > 0 ? allowedList : ["Cuisine", "Pâtisserie", "Restaurant", "Restauration"];
  const text = `${competenceKey} ${subjectName} ${groupSpecialty} ${groupName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return allowed.some((s) => {
    const norm = s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return text.includes(norm);
  });
}

/**
 * Vérifie une affectation unique (candidat) contre le reste du planning.
 * Retourne null si valide, sinon le code du conflit + message.
 */
export function checkCandidate(
  cand: Candidate,
  others: Assignment[],
  ctx: Ctx
): { code: Conflict["code"]; message: string } | null {
  const { data, slots } = ctx;
  const subject = data.subjects.find((s) => s.id === cand.subjectId);
  const instructor = data.instructors.find((i) => i.id === cand.instructorId);
  const room = data.rooms.find((r) => r.id === cand.roomId);
  const group = data.groups.find((g) => g.id === cand.groupId);
  if (!subject || !instructor || !room || !group)
    return { code: "ROOM_INCOMPATIBLE", message: "Élément inconnu (matière, formateur, salle ou groupe supprimé)" };

  const allowedDurations = subject.kind === "TP" ? data.settings.tpDurations : data.settings.coursDurations;
  if (!allowedDurations.includes(cand.hours))
    return {
      code: "DURATION_INVALID",
      message: `Durée de ${cand.hours}h non autorisée pour une séance ${subject.kind} (durées autorisées : ${allowedDurations.join("h / ")}h)`,
    };

  const w = windowInterval(slots, cand.startSlot, cand.hours);
  if (!w)
    return {
      code: "DURATION_INVALID",
      message: `Bloc de ${cand.hours}h non continu à ce créneau (règle du bloc continu)`,
    };
  if (!data.settings.enabledDays.includes(cand.day))
    return { code: "DURATION_INVALID", message: "Jour hors calendrier de formation" };

  // Compétence
  if (!instructor.active)
    return { code: "COMPETENCE_MISSING", message: `Formateur ${nameInstructors(data, instructor.id)} inactif` };
  if (!instructor.competences.includes(subject.competenceKey))
    return {
      code: "COMPETENCE_MISSING",
      message: `${nameInstructors(data, instructor.id)} ne possède pas la compétence « ${subject.competenceKey} » requise pour ${subject.name}`,
    };

  // -------------------------------------------------------------------------
  // RÈGLES SPÉCIALES DES HORAIRES (CONTRAINTES OBLIGATOIRES / HARD CONSTRAINTS)
  // 1. Pause 12h00 -> 14h00 (Seuls TP Cuisine, Pâtisserie, Restaurant autorisés)
  // 2. Après 18h00 -> 20h00 (Seuls TP Cuisine, Pâtisserie, Restaurant autorisés)
  // -------------------------------------------------------------------------
  const pauseActive = data.settings.specialRules?.pause1214Enabled !== false;
  const after18Active = data.settings.specialRules?.after18Enabled !== false;
  const allowedSpecialties = data.settings.specialRules?.allowedSpecialties || ["Cuisine", "Pâtisserie", "Restaurant", "Restauration"];

  const isSpecialtyQualifying = isSpecialtyAllowedForExtendedHours(
    subject.competenceKey,
    subject.name,
    group.specialty,
    group.name,
    allowedSpecialties
  );

  // Règle 1 : Pause 12h00 - 14h00 (créneau [720, 840] minutes)
  if (pauseActive && overlaps(w.startMin, w.endMin, 720, 840)) {
    if (subject.kind === "COURS") {
      return {
        code: "SPECIAL_SCHEDULE_VIOLATION",
        message: `Pause 12h00–14h00 obligatoire : aucun cours théorique (${subject.name}) n'est autorisé entre 12h00 et 14h00.`,
      };
    }
    if (subject.kind === "TP" && !isSpecialtyQualifying) {
      return {
        code: "SPECIAL_SCHEDULE_VIOLATION",
        message: `Pause 12h00–14h00 obligatoire : seuls les TP des spécialités Cuisine, Pâtisserie et Restaurant sont autorisés entre 12h00 et 14h00 (${subject.name} pour ${group.name} interdit).`,
      };
    }
  }

  // Règle 2 : Après 18h00 (créneau [1080, 1200] minutes)
  if (after18Active && w.endMin > 1080) {
    if (subject.kind === "COURS") {
      return {
        code: "SPECIAL_SCHEDULE_VIOLATION",
        message: `Créneau après 18h00 interdit pour les cours théoriques : aucun cours théorique (${subject.name}) après 18h00.`,
      };
    }
    if (subject.kind === "TP" && !isSpecialtyQualifying) {
      return {
        code: "SPECIAL_SCHEDULE_VIOLATION",
        message: `Créneau après 18h00 réservé exclusivement aux activités pratiques (TP) de Cuisine, Pâtisserie et Restaurant (${subject.name} pour ${group.name} interdit).`,
      };
    }
  }

  // Salle
  if (!room.allowedKinds.includes(subject.kind))
    return {
      code: "ROOM_INCOMPATIBLE",
      message: `Salle « ${room.name} » incompatible : un ${subject.kind} exige ${
        subject.kind === "TP" ? "un atelier ou un espace pédagogique" : "une salle compatible"
      }`,
    };
  if (subject.kind === "TP" && !isTpRoomCompatible(subject.competenceKey, room.name))
    return {
      code: "ROOM_INCOMPATIBLE",
      message: `Espace « ${room.name} » non conforme pour la séance pratique de ${subject.name}`,
    };
  if (group.studentCount > room.capacity)
    return {
      code: "ROOM_TOO_SMALL",
      message: `Salle « ${room.name} » trop petite (capacité ${room.capacity} < ${group.studentCount} apprenants)`,
    };

  // Disponibilités
  const iBlocked = blockedSet(instructor.blocked);
  for (const sl of w.slotIdx)
    if (iBlocked.has(`${cand.day}:${sl}`))
      return {
        code: "INSTRUCTOR_UNAVAILABLE",
        message: `${nameInstructors(data, instructor.id)} est indisponible à ce créneau`,
      };
  const rBlocked = blockedSet(room.blocked);
  for (const sl of w.slotIdx)
    if (rBlocked.has(`${cand.day}:${sl}`))
      return { code: "ROOM_UNAVAILABLE", message: `Salle « ${room.name} » indisponible à ce créneau` };

  // Chevauchements + charges
  const sameDay = others.filter((a) => a.day === cand.day);
  let dayHoursInstructor = 0;
  for (const a of sameDay) {
    const aw = windowInterval(slots, a.startSlot, a.hours);
    if (!aw) continue;
    if (!overlaps(w.startMin, w.endMin, aw.startMin, aw.endMin)) continue;
    if (a.instructorId === cand.instructorId)
      return {
        code: "INSTRUCTOR_OVERLAP",
        message: `Conflit formateur : ${nameInstructors(data, cand.instructorId)} est déjà affecté(e) à ${nameGroups(
          data,
          a.groupId
        )} sur ce créneau`,
      };
    if (a.groupId === cand.groupId)
      return {
        code: "GROUP_OVERLAP",
        message: `Conflit groupe : ${nameGroups(data, cand.groupId)} a déjà une séance en parallèle (${
          nameSubjects(data, a.subjectId)
        })`,
      };
    if (a.roomId === cand.roomId)
      return {
        code: "ROOM_OVERLAP",
        message: `Conflit salle : « ${room.name} » est déjà occupée par ${nameGroups(data, a.groupId)}`,
      };
  }
  // Charge journalière formateur
  for (const a of sameDay)
    if (a.instructorId === cand.instructorId) dayHoursInstructor += a.hours;
  if (dayHoursInstructor + cand.hours > instructor.maxHoursPerDay)
    return {
      code: "TIME_EXCEEDED_DAY",
      message: `Dépassement horaire : ${nameInstructors(data, cand.instructorId)} dépasse ${instructor.maxHoursPerDay}h/jour ce jour-là (${dayHoursInstructor + cand.hours}h)`,
    };

  // Charge hebdomadaire formateur
  const weekHours = others.filter((a) => a.instructorId === cand.instructorId).reduce((s, a) => s + a.hours, 0);
  if (weekHours + cand.hours > instructor.maxHoursPerWeek)
    return {
      code: "TIME_EXCEEDED_WEEK",
      message: `Dépassement horaire : ${nameInstructors(data, cand.instructorId)} dépasse son plafond de ${instructor.maxHoursPerWeek}h/semaine`,
    };

  // Volume horaire demandé (groupe × matière)
  const teaching = data.teachings.find((t) => t.groupId === cand.groupId && t.subjectId === cand.subjectId);
  if (teaching) {
    const placed = others
      .filter((a) => a.groupId === cand.groupId && a.subjectId === cand.subjectId)
      .reduce((s, a) => s + a.hours, 0);
    if (placed + cand.hours > teaching.hoursPerWeek)
      return {
        code: "VOLUME_EXCEEDED",
        message: `Volume horaire dépassé : ${nameGroups(data, cand.groupId)} × ${subject.name} est déjà complet (${placed}h / ${teaching.hoursPerWeek}h)`,
      };
  }
  return null;
}

/** Moteur de contrôle des conflits : revalide un planning complet. */
export function findConflicts(assns: Assignment[], ctx: Ctx): Conflict[] {
  const out: Conflict[] = [];
  for (const a of assns) {
    const res = checkCandidate(
      {
        day: a.day,
        startSlot: a.startSlot,
        hours: a.hours,
        kind: a.kind,
        groupId: a.groupId,
        subjectId: a.subjectId,
        instructorId: a.instructorId,
        roomId: a.roomId,
        teachingId: a.teachingId,
      },
      assns.filter((x) => x.id !== a.id),
      ctx
    );
    if (res) out.push({ code: res.code, message: res.message, assignmentId: a.id });
  }
  return out;
}

/* ---------------------------- Score de qualité ---------------------------- */

function bandsOf(slots: SlotInfo[]): number[][] {
  const bands: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (i > 0 && slots[i].startMin !== slots[i - 1].endMin) {
      if (cur.length) bands.push(cur);
      cur = [];
    }
    cur.push(i);
  }
  if (cur.length) bands.push(cur);
  return bands;
}

export function computeScore(assns: Assignment[], ctx: Ctx): { total: number; breakdown: ScoreBreakdown } {
  const { data, slots } = ctx;
  const w = data.settings.weights;
  const D = data.settings.enabledDays.length;
  const bands = bandsOf(slots);
  const bandOfSlot = (slotIdx: number) => bands.findIndex((b) => b.includes(slotIdx));

  const totalUnits = assns.reduce((s, a) => s + a.hours, 0);

  // 1. Heures creuses (gaps)
  let gapUnits = 0;
  const byGroupDay = new Map<string, Assignment[]>();
  for (const a of assns) {
    const k = `${a.groupId}:${a.day}`;
    if (!byGroupDay.has(k)) byGroupDay.set(k, []);
    byGroupDay.get(k)!.push(a);
  }
  for (const list of byGroupDay.values()) {
    list.sort((x, y) => x.startSlot - y.startSlot);
    for (let i = 1; i < list.length; i++) {
      const prev = windowInterval(slots, list[i - 1].startSlot, list[i - 1].hours);
      const cur = windowInterval(slots, list[i].startSlot, list[i].hours);
      if (!prev || !cur) continue;
      if (bandOfSlot(list[i - 1].startSlot) !== bandOfSlot(list[i].startSlot)) continue;
      gapUnits += (cur.startMin - prev.endMin) / 120;
    }
  }
  const gapsScore = totalUnits > 0 ? Math.max(0, 1 - gapUnits / (totalUnits / 2)) : 1;

  // 2. Surcharges journalières
  let overSum = 0;
  let overCount = 0;
  const byInstrDay = new Map<string, number>();
  for (const a of assns) {
    const k = `${a.instructorId}:${a.day}`;
    byInstrDay.set(k, (byInstrDay.get(k) || 0) + a.hours);
  }
  for (const [k, h] of byInstrDay) {
    const id = parseInt(k.split(":")[0], 10);
    const inst = data.instructors.find((x) => x.id === id);
    if (!inst) continue;
    const threshold = Math.min(8, inst.maxHoursPerDay);
    if (h > threshold) {
      overSum += (h - threshold) / h;
      overCount++;
    }
  }
  const overloadScore = overCount > 0 ? Math.max(0, 1 - overSum / overCount) : 1;

  // 3. Équilibre de charge entre formateurs qualifiés
  const loadByCompInstr = new Map<string, number>();
  for (const a of assns) {
    const subj = data.subjects.find((s) => s.id === a.subjectId);
    if (!subj) continue;
    loadByCompInstr.set(`${subj.competenceKey}:${a.instructorId}`, (loadByCompInstr.get(`${subj.competenceKey}:${a.instructorId}`) || 0) + a.hours);
  }
  const byComp = new Map<string, Map<number, number>>();
  for (const [k, v] of loadByCompInstr) {
    const [comp, id] = k.split(":");
    if (!byComp.has(comp)) byComp.set(comp, new Map());
    byComp.get(comp)!.set(parseInt(id, 10), v);
  }
  let balPen = 0;
  let balCount = 0;
  for (const [comp, loads] of byComp) {
    const qualified = data.instructors.filter(
      (i) => i.active && i.competences.includes(comp)
    ).length;
    if (qualified < 2) continue;
    const vals = [...loads.values()];
    const total = vals.reduce((s, x) => s + x, 0);
    if (total <= 0) continue;
    balPen += (Math.max(...vals) - Math.min(...vals)) / total;
    balCount++;
  }
  const balanceScore = balCount > 0 ? Math.max(0, 1 - balPen / balCount) : 1;

  // 4. Préférences de créneaux
  let prefMatch = 0;
  let prefTotal = 0;
  for (const a of assns) {
    const inst = data.instructors.find((i) => i.id === a.instructorId);
    if (!inst || !inst.preferences.length) continue;
    prefTotal++;
    const wInt = windowInterval(slots, a.startSlot, a.hours);
    const ok = inst.preferences.some(
      (p) => p.day === a.day && p.slots.some((s) => wInt?.slotIdx.includes(s))
    );
    if (ok) prefMatch++;
  }
  const prefsScore = prefTotal > 0 ? prefMatch / prefTotal : 1;

  // 5. Compacité (jours mobilisés par groupe)
  const daysByGroup = new Map<number, Set<number>>();
  for (const a of assns) {
    if (!daysByGroup.has(a.groupId)) daysByGroup.set(a.groupId, new Set());
    daysByGroup.get(a.groupId)!.add(a.day);
  }
  let compPen = 0;
  let compCount = 0;
  if (D > 1)
    for (const days of daysByGroup.values()) {
      compPen += (days.size - 1) / (D - 1);
      compCount++;
    }
  const compactScore = compCount > 0 ? Math.max(0, 1 - compPen / compCount) : 1;

  const breakdown: ScoreBreakdown = {
    gaps: Math.round(gapsScore * 100),
    overload: Math.round(overloadScore * 100),
    balance: Math.round(balanceScore * 100),
    prefs: Math.round(prefsScore * 100),
    compact: Math.round(compactScore * 100),
    total: 0,
  };
  const ws = [w.gaps || 0, w.overload || 0, w.balance || 0, w.prefs || 0, w.compact || 0];
  const sumW = ws.reduce((s, x) => s + x, 0);
  const raw =
    sumW > 0
      ? (gapsScore * ws[0] + overloadScore * ws[1] + balanceScore * ws[2] + prefsScore * ws[3] + compactScore * ws[4]) / sumW
      : 1;
  breakdown.total = Math.round(raw * 100);
  return { total: breakdown.total, breakdown };
}

/* ------------------------- Restes de volume (non atteint) ------------------------- */

export function volumeGaps(assns: Assignment[], data: Database): Array<{ teaching: (typeof data.teachings)[number]; placed: number; missing: number }> {
  const out = [];
  for (const t of data.teachings) {
    const placed = assns
      .filter((a) => a.groupId === t.groupId && a.subjectId === t.subjectId)
      .reduce((s, a) => s + a.hours, 0);
    if (placed < t.hoursPerWeek)
      out.push({ teaching: t, placed, missing: t.hoursPerWeek - placed });
  }
  return out;
}
