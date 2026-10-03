// Données de TEST uniquement (jamais utilisées par l'application).
import type { Assignment, Database, Group, Instructor, Room, Subject, Teaching } from "../src/lib/types";

export const BOUNDARIES = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
// créneaux : 0=08-10, 1=10-12, 2=12-14, 3=14-16, 4=16-18, 5=18-20

export function makeDb(over: Partial<Database> = {}): Database {
  const base: Database = {
    settings: {
      id: 1,
      periodName: "Test",
      startDate: "2025-10-06",
      endDate: "2026-01-23",
      boundaries: BOUNDARIES,
      enabledDays: [0, 1, 2, 3, 4],
      coursDurations: [2, 4],
      tpDurations: [4],
      weights: { gaps: 6, overload: 5, balance: 5, prefs: 3, compact: 8 },
      holidays: [],
      specialRules: {
        pause1214Enabled: true,
        after18Enabled: true,
        allowedSpecialties: ["Cuisine", "Pâtisserie", "Restaurant", "Restauration"],
      },
      activeVersionId: null,
    },
    instructors: [],
    groups: [],
    subjects: [],
    teachings: [],
    rooms: [],
    versions: [],
    assignments: [],
    audit: [],
  };
  return { ...base, ...over };
}

export const inst = (id: number, competences: string[], extra: Partial<Instructor> = {}): Instructor => ({
  id, firstName: `F${id}`, lastName: "Test", specialty: "", competences,
  maxHoursPerWeek: 30, maxHoursPerDay: 8, blocked: [], preferences: [], active: true, ...extra,
});
export const grp = (id: number, name: string, specialty = "", extra: Partial<Group> = {}): Group => ({
  id, name, level: "CAP", year: 1, specialty, studentCount: 15, ...extra,
});
export const subj = (id: number, name: string, competenceKey: string, kind: "COURS" | "TP"): Subject => ({
  id, name, competenceKey, kind, category: "generale",
});
export const room = (id: number, name: string, allowedKinds: string[], extra: Partial<Room> = {}): Room => ({
  id, name, kind: "normale", capacity: 30, allowedKinds, blocked: [], ...extra,
});
export const teach = (id: number, groupId: number, subjectId: number, hoursPerWeek: number): Teaching => ({
  id, groupId, subjectId, hoursPerWeek,
});
let seq = 1;
export const asg = (p: Partial<Assignment> & Pick<Assignment, "groupId" | "subjectId" | "instructorId" | "roomId">): Assignment => ({
  id: seq++, versionId: 1, teachingId: null, day: 0, startSlot: 0, hours: 2, kind: "COURS", source: "gen", ...p,
});
