/**
 * VALIDATEUR INDÉPENDANT du moteur de génération.
 *
 * Ce module n'importe NI solver.ts NI conflicts.ts : il recalcule tout lui-même
 * à partir des données brutes (réglages, formateurs, groupes, salles, matières,
 * besoins pédagogiques) et d'une liste d'affectations. Il est utilisé :
 *  - après chaque génération (le planning n'est pas validé s'il y a une erreur),
 *  - avant chaque déplacement manuel / drag & drop (validateMove).
 */
import type { Assignment, Database } from "./types";

export type ViolationCode =
  | "INSTRUCTOR_OVERLAP"
  | "GROUP_OVERLAP"
  | "ROOM_OVERLAP"
  | "INSTRUCTOR_UNAVAILABLE"
  | "ROOM_UNAVAILABLE"
  | "COMPETENCE_MISSING"
  | "ROOM_KIND_MISMATCH"
  | "ROOM_NOT_SUITABLE"
  | "ROOM_TOO_SMALL"
  | "DURATION_NOT_ALLOWED"
  | "GRID_INVALID"
  | "DAY_DISABLED"
  | "FORBIDDEN_HOURS"
  | "OVERTIME"
  | "VOLUME_EXCEEDED"
  | "VOLUME_INCOMPLETE"
  | "UNKNOWN_REFERENCE";

export interface Violation {
  code: ViolationCode;
  severity: "error" | "warning";
  message: string;
  assignmentIds: number[];
}

export interface ValidationReport {
  /** Aucune contrainte obligatoire violée. */
  valid: boolean;
  /** Valide ET tous les volumes horaires demandés sont placés. */
  complete: boolean;
  violations: Violation[];
  errors: Violation[];
  warnings: Violation[];
  /** Heures par formateur : normales (≤ plafond) et supplémentaires (> plafond). */
  overtime: Array<{ instructorId: number; assigned: number; normal: number; overtime: number }>;
}

/* ------------------------------ utilitaires ------------------------------ */

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const toMin = (s: string) => {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
};
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

interface Span {
  start: number;
  end: number;
  slots: number[];
}

/** Intervalle réel d'une séance sur la grille, ou null si le bloc n'est pas continu / n'existe pas. */
function spanOf(boundaries: string[], startSlot: number, hours: number): Span | null {
  const b = boundaries.map(toMin);
  if (startSlot < 0 || startSlot >= b.length - 1) return null;
  const slots: number[] = [];
  let acc = 0;
  for (let i = startSlot; i < b.length - 1; i++) {
    const len = (b[i + 1] - b[i]) / 60;
    if (len <= 0) return null;
    slots.push(i);
    acc += len;
    if (Math.abs(acc - hours) < 1e-9) return { start: b[startSlot], end: b[i + 1], slots };
    if (acc > hours) return null;
  }
  return null;
}

const intersects = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

function isBlocked(list: Array<{ day: number; slots: number[] }>, day: number, slots: number[]): boolean {
  return (list || []).some((x) => x.day === day && x.slots.some((s) => slots.includes(s)));
}

/** Salle conforme pour un TP, d'après la compétence (règle propre au validateur). */
function tpRoomSuitable(competenceKey: string, roomName: string): boolean {
  const r = roomName.toUpperCase();
  const k = norm(competenceKey);
  if (k.includes("cuisine")) return r.includes("CUISINE");
  if (k.includes("patisserie")) return r.includes("PAT") || r.includes("CUISINE");
  if (k.includes("reception")) return r.includes("RECEPTION") || r.includes("INFO") || r.includes("AMEDEUS");
  if (/plateaux|service|restaurant|bar/.test(k)) return /RESTAU|BAR|HOTEL|CUISINE/.test(r);
  if (/hebergement|etage|lingerie/.test(k)) return r.includes("DORTOIR") || r.includes("BUANDERIE");
  return true;
}

/* ------------------------------ validation ------------------------------ */

export function validatePlanning(db: Database, assignments: Assignment[]): ValidationReport {
  const out: Violation[] = [];
  const add = (code: ViolationCode, message: string, ids: number[], severity: "error" | "warning" = "error") =>
    out.push({ code, severity, message, assignmentIds: ids });

  const { settings } = db;
  const iName = (id: number) => {
    const i = db.instructors.find((x) => x.id === id);
    return i ? `${i.firstName} ${i.lastName}` : `Formateur #${id}`;
  };
  const gName = (id: number) => db.groups.find((x) => x.id === id)?.name ?? `Groupe #${id}`;
  const rName = (id: number) => db.rooms.find((x) => x.id === id)?.name ?? `Salle #${id}`;
  const sName = (id: number) => db.subjects.find((x) => x.id === id)?.name ?? `Matière #${id}`;

  const pauseOn = settings.specialRules?.pause1214Enabled !== false;
  const after18On = settings.specialRules?.after18Enabled !== false;
  const allowedSpecs = (settings.specialRules?.allowedSpecialties?.length
    ? settings.specialRules.allowedSpecialties
    : ["Cuisine", "Pâtisserie", "Restaurant", "Restauration"]
  ).map(norm);

  const spans = new Map<number, Span>();

  for (const a of assignments) {
    const subject = db.subjects.find((s) => s.id === a.subjectId);
    const instructor = db.instructors.find((i) => i.id === a.instructorId);
    const room = db.rooms.find((r) => r.id === a.roomId);
    const group = db.groups.find((g) => g.id === a.groupId);
    if (!subject || !instructor || !room || !group) {
      add("UNKNOWN_REFERENCE", `Séance #${a.id} : formateur, groupe, salle ou matière inexistant`, [a.id]);
      continue;
    }
    const label = `${gName(a.groupId)} × ${sName(a.subjectId)}`;

    // Grille officielle : jour actif, créneau existant, bloc continu
    if (!settings.enabledDays.includes(a.day)) add("DAY_DISABLED", `${label} : jour hors du calendrier de formation`, [a.id]);
    const span = spanOf(settings.boundaries, a.startSlot, a.hours);
    if (!span) {
      add("GRID_INVALID", `${label} : ${a.hours}h ne forme pas un bloc continu sur la grille à partir du créneau ${a.startSlot + 1}`, [a.id]);
      continue;
    }
    spans.set(a.id, span);

    // Durées autorisées
    const durations = subject.kind === "TP" ? settings.tpDurations : settings.coursDurations;
    if (a.kind !== subject.kind) add("DURATION_NOT_ALLOWED", `${label} : type de séance ${a.kind} différent du type de la matière (${subject.kind})`, [a.id]);
    if (!durations.includes(a.hours))
      add("DURATION_NOT_ALLOWED", `${label} : durée ${a.hours}h non autorisée pour un ${subject.kind} (autorisées : ${durations.join("h, ")}h)`, [a.id]);

    // Compétence
    if (!instructor.active) add("COMPETENCE_MISSING", `${label} : ${iName(a.instructorId)} est inactif`, [a.id]);
    if (!instructor.competences.includes(subject.competenceKey))
      add("COMPETENCE_MISSING", `${label} : ${iName(a.instructorId)} n'a pas la compétence « ${subject.competenceKey} »`, [a.id]);

    // Salle : type, conformité, capacité
    if (!room.allowedKinds.includes(subject.kind))
      add("ROOM_KIND_MISMATCH", `${label} : la salle « ${room.name} » n'accepte pas les séances ${subject.kind}`, [a.id]);
    if (subject.kind === "TP" && !tpRoomSuitable(subject.competenceKey, room.name))
      add("ROOM_NOT_SUITABLE", `${label} : « ${room.name} » n'est pas un atelier conforme pour ce TP`, [a.id]);
    if (group.studentCount > room.capacity)
      add("ROOM_TOO_SMALL", `${label} : « ${room.name} » (capacité ${room.capacity}) trop petite pour ${group.studentCount} apprenants`, [a.id]);

    // Disponibilités
    if (isBlocked(instructor.blocked, a.day, span.slots))
      add("INSTRUCTOR_UNAVAILABLE", `${label} : ${iName(a.instructorId)} est indisponible (${hhmm(span.start)}–${hhmm(span.end)})`, [a.id]);
    if (isBlocked(room.blocked, a.day, span.slots))
      add("ROOM_UNAVAILABLE", `${label} : « ${room.name} » est indisponible (${hhmm(span.start)}–${hhmm(span.end)})`, [a.id]);

    // Horaires interdits (12h–14h, après 18h, plafond 20h)
    const text = norm(`${subject.competenceKey} ${subject.name} ${group.specialty} ${group.name}`);
    const practicalSpecialty = allowedSpecs.some((s) => text.includes(s));
    const practicalOk = subject.kind === "TP" && practicalSpecialty;
    if (pauseOn && intersects(span, { start: 720, end: 840, slots: [] }) && !practicalOk)
      add(
        "FORBIDDEN_HOURS",
        `${label} : ${subject.kind === "COURS" ? "aucun cours théorique" : "TP non autorisé"} entre 12:00 et 14:00 (${hhmm(span.start)}–${hhmm(span.end)})`,
        [a.id]
      );
    if (after18On && span.end > 1080) {
      if (!practicalOk)
        add("FORBIDDEN_HOURS", `${label} : ${subject.kind === "COURS" ? "aucun cours théorique" : "TP non autorisé"} après 18:00 (fin ${hhmm(span.end)})`, [a.id]);
      else if (span.end > 1200) add("FORBIDDEN_HOURS", `${label} : un TP ne peut pas dépasser 20:00 (fin ${hhmm(span.end)})`, [a.id]);
    }
  }

  // Chevauchements (toute la durée de la séance) : formateur, groupe, salle
  const list = assignments.filter((a) => spans.has(a.id));
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.day !== b.day || !intersects(spans.get(a.id)!, spans.get(b.id)!)) continue;
      const when = `${hhmm(Math.max(spans.get(a.id)!.start, spans.get(b.id)!.start))}`;
      if (a.instructorId === b.instructorId)
        add("INSTRUCTOR_OVERLAP", `${iName(a.instructorId)} enseigne ${gName(a.groupId)} et ${gName(b.groupId)} en même temps (vers ${when})`, [a.id, b.id]);
      if (a.groupId === b.groupId)
        add("GROUP_OVERLAP", `${gName(a.groupId)} a deux séances simultanées : ${sName(a.subjectId)} et ${sName(b.subjectId)} (vers ${when})`, [a.id, b.id]);
      if (a.roomId === b.roomId)
        add("ROOM_OVERLAP", `« ${rName(a.roomId)} » accueille ${gName(a.groupId)} et ${gName(b.groupId)} en même temps (vers ${when})`, [a.id, b.id]);
    }

  // Volumes horaires par groupe × matière
  for (const t of db.teachings) {
    const mine = assignments.filter((a) => a.groupId === t.groupId && a.subjectId === t.subjectId);
    const placed = mine.reduce((s, a) => s + a.hours, 0);
    if (placed > t.hoursPerWeek)
      add("VOLUME_EXCEEDED", `${gName(t.groupId)} × ${sName(t.subjectId)} : ${placed}h placées pour ${t.hoursPerWeek}h demandées`, mine.map((a) => a.id));
    else if (placed < t.hoursPerWeek)
      add("VOLUME_INCOMPLETE", `${gName(t.groupId)} × ${sName(t.subjectId)} : ${placed}h placées sur ${t.hoursPerWeek}h demandées`, mine.map((a) => a.id), "warning");
  }

  // Heures normales / supplémentaires par formateur (plafond = maxHoursPerWeek)
  const overtime: ValidationReport["overtime"] = [];
  for (const inst of db.instructors) {
    const mine = assignments.filter((a) => a.instructorId === inst.id);
    if (!mine.length) continue;
    const assigned = mine.reduce((s, a) => s + a.hours, 0);
    const normal = Math.min(assigned, inst.maxHoursPerWeek);
    const extra = Math.max(0, assigned - inst.maxHoursPerWeek);
    overtime.push({ instructorId: inst.id, assigned, normal, overtime: extra });
    if (extra > 0)
      add("OVERTIME", `${iName(inst.id)} : ${assigned}h/semaine, soit ${extra}h au-delà de son plafond de ${inst.maxHoursPerWeek}h`, mine.map((a) => a.id));
    for (const day of new Set(mine.map((a) => a.day))) {
      const dayH = mine.filter((a) => a.day === day).reduce((s, a) => s + a.hours, 0);
      if (dayH > inst.maxHoursPerDay)
        add("OVERTIME", `${iName(inst.id)} : ${dayH}h le même jour, plafond journalier ${inst.maxHoursPerDay}h`, mine.filter((a) => a.day === day).map((a) => a.id));
    }
  }

  const errors = out.filter((v) => v.severity === "error");
  const warnings = out.filter((v) => v.severity === "warning");
  return { valid: errors.length === 0, complete: out.length === 0, violations: out, errors, warnings, overtime };
}

/**
 * Valide le déplacement d'une séance : retourne le rapport du planning APRÈS
 * déplacement, limité aux violations qui concernent la séance déplacée.
 */
export function validateMove(
  db: Database,
  assignments: Assignment[],
  moved: Pick<Assignment, "id" | "day" | "startSlot" | "roomId"> & Partial<Pick<Assignment, "instructorId" | "groupId">>
): { ok: boolean; reasons: string[] } {
  const current = assignments.find((a) => a.id === moved.id);
  if (!current) return { ok: false, reasons: ["Séance introuvable"] };
  const next: Assignment[] = assignments.map((a) =>
    a.id === moved.id
      ? {
          ...a,
          day: moved.day,
          startSlot: moved.startSlot,
          roomId: moved.roomId,
          instructorId: moved.instructorId ?? a.instructorId,
          groupId: moved.groupId ?? a.groupId,
        }
      : a
  );
  const before = validatePlanning(db, assignments).errors.map((v) => v.message);
  const after = validatePlanning(db, next).errors.filter((v) => v.assignmentIds.includes(moved.id));
  // Ne reproche au déplacement que ce qui est nouveau
  const reasons = after.map((v) => v.message).filter((m) => !before.includes(m));
  return { ok: reasons.length === 0, reasons };
}
