import type { Group, Instructor, Room, Settings, Subject, Teaching } from "./types";

export const DEFAULT_SETTINGS: Omit<Settings, "id"> = {
  periodName: "Semestre 1 — 2025/2026",
  startDate: "2025-10-06",
  endDate: "2026-01-23",
  boundaries: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
  enabledDays: [0, 1, 2, 3, 4],
  coursDurations: [2, 4],
  tpDurations: [4],
  weights: { gaps: 6, overload: 5, balance: 5, prefs: 3, compact: 8 },
  holidays: [
    { date: "2025-11-09", label: "Fête du Martyr" },
    { date: "2026-01-01", label: "Nouvel An" },
  ],
  specialRules: {
    pause1214Enabled: true,
    after18Enabled: true,
    allowedSpecialties: ["Cuisine", "Pâtisserie", "Restaurant", "Restauration"],
  },
  activeVersionId: null,
};

export const SEED_INSTRUCTORS: Omit<Instructor, "id">[] = [
  {
    firstName: "Ahmed", lastName: "Ben Salah", specialty: "Hôtellerie restauration",
    competences: ["cuisine", "cuisine-internationale", "plateaux", "patisserie"],
    maxHoursPerWeek: 20, maxHoursPerDay: 8,
    blocked: [{ day: 4, slots: [2, 3] }],
    preferences: [{ day: 0, slots: [0, 1] }, { day: 2, slots: [0, 1] }], active: true,
  },
  {
    firstName: "Nadia", lastName: "Bouazizi", specialty: "Cuisine & approvisionnement",
    competences: ["cuisine", "cuisine-internationale", "stocks", "patisserie"],
    maxHoursPerWeek: 24, maxHoursPerDay: 8,
    blocked: [], preferences: [], active: true,
  },
  {
    firstName: "Mohamed", lastName: "Gharbi", specialty: "Réception & langues",
    competences: ["reception", "anglais", "comptabilite", "amadeus"],
    maxHoursPerWeek: 20, maxHoursPerDay: 8,
    blocked: [{ day: 2, slots: [0, 1] }],
    preferences: [{ day: 1, slots: [2, 3] }], active: true,
  },
  {
    firstName: "Leïla", lastName: "Trabelsi", specialty: "Langues & communication",
    competences: ["francais", "anglais", "communication"],
    maxHoursPerWeek: 16, maxHoursPerDay: 6,
    blocked: [],
    preferences: [{ day: 0, slots: [0, 1] }, { day: 1, slots: [0, 1] }], active: true,
  },
  {
    firstName: "Sonia", lastName: "Mansouri", specialty: "Gestion & comptabilité",
    competences: ["comptabilite", "management", "stocks"],
    maxHoursPerWeek: 20, maxHoursPerDay: 8,
    blocked: [], preferences: [], active: true,
  },
  {
    firstName: "Karim", lastName: "Jlassi", specialty: "Sciences du tourisme",
    competences: ["droit", "geographie", "tourisme", "amadeus"],
    maxHoursPerWeek: 16, maxHoursPerDay: 8,
    blocked: [{ day: 3, slots: [3] }],
    preferences: [], active: true,
  },
  {
    firstName: "Farouk", lastName: "Hamdi", specialty: "Tourisme & guidage",
    competences: ["tourisme", "geographie", "reception"],
    maxHoursPerWeek: 14, maxHoursPerDay: 8,
    blocked: [], preferences: [], active: true,
  },
  {
    firstName: "Amel", lastName: "Chatti", specialty: "Hôtellerie & service",
    competences: ["reception", "plateaux", "communication", "service-bar", "hebergement"],
    maxHoursPerWeek: 14, maxHoursPerDay: 8,
    blocked: [{ day: 1, slots: [2, 3] }],
    preferences: [], active: true,
  },
];

export const SEED_GROUPS: Omit<Group, "id">[] = [
  { name: "CAP Cuisine 2A", level: "CAP", year: 2, specialty: "Cuisine", studentCount: 22 },
  { name: "CAP Réception 3A", level: "CAP", year: 3, specialty: "Réception", studentCount: 18 },
  { name: "BTP Hôtellerie 1A", level: "BTP", year: 1, specialty: "Hôtellerie", studentCount: 24 },
  { name: "BTP Restauration 2A", level: "BTP", year: 2, specialty: "Restauration", studentCount: 20 },
  { name: "BTS Réception 1A", level: "BTS", year: 1, specialty: "Réception", studentCount: 16 },
  { name: "BTS Cuisine 1A", level: "BTS", year: 1, specialty: "Cuisine", studentCount: 15 },
];

export const SEED_SUBJECTS: Omit<Subject, "id">[] = [
  { name: "Cuisine hôtelière", competenceKey: "cuisine", kind: "TP", category: "particuliere" },
  { name: "Aménagement de plateaux", competenceKey: "plateaux", kind: "TP", category: "particuliere" },
  { name: "Réception hôtelière", competenceKey: "reception", kind: "TP", category: "particuliere" },
  { name: "Cuisine internationale", competenceKey: "cuisine-internationale", kind: "COURS", category: "generale" },
  { name: "Comptabilité hôtelière", competenceKey: "comptabilite", kind: "COURS", category: "generale" },
  { name: "Gestion des stocks", competenceKey: "stocks", kind: "COURS", category: "particuliere" },
  { name: "Français professionnel", competenceKey: "francais", kind: "COURS", category: "generale" },
  { name: "Anglais hôtelier", competenceKey: "anglais", kind: "COURS", category: "generale" },
  { name: "Droit du tourisme", competenceKey: "droit", kind: "COURS", category: "enseignement" },
  { name: "Géographie du tourisme", competenceKey: "geographie", kind: "COURS", category: "enseignement" },
  { name: "Management hôtelier", competenceKey: "management", kind: "COURS", category: "generale" },
  { name: "Techniques de communication", competenceKey: "communication", kind: "COURS", category: "generale" },
];

/** [groupeIndex, matièreIndex, heures/semaine] */
const T: Array<[number, number, number]> = [
  [0, 0, 4], [0, 1, 4], [0, 3, 4], [0, 7, 2], [0, 6, 2], [0, 5, 2],
  [1, 2, 4], [1, 6, 4], [1, 7, 2], [1, 4, 2], [1, 11, 2],
  [2, 2, 4], [2, 0, 4], [2, 4, 4], [2, 7, 2], [2, 6, 2], [2, 10, 2],
  [3, 0, 4], [3, 3, 4], [3, 5, 4], [3, 8, 2], [3, 9, 2],
  [4, 2, 4], [4, 7, 4], [4, 8, 4], [4, 9, 2], [4, 10, 4], [4, 4, 2],
  [5, 0, 4], [5, 3, 4], [5, 5, 2], [5, 11, 2], [5, 10, 2],
];

export function buildSeedTeachings(groupIds: number[], subjectIds: number[]): Omit<Teaching, "id">[] {
  return T.map(([g, s, h]) => ({ groupId: groupIds[g], subjectId: subjectIds[s], hoursPerWeek: h }));
}

/**
 * SALLES ET ESPACES PÉDAGOGIQUES OFFICIELS DE L'IFMT HAMMAMET
 * Correspond exactement aux 25 colonnes du "TABLEAU RECAP FORMATION" (document client original) :
 * S1, S2, S3, S4, S5, S6, S7, S8, S9, S10
 * S INFO 1, S INFO 2, S AMEDEUS, S 3 S, S JK
 * DORTOIR JK, BUANDERIE
 * CUISINE P 1, CUISINE P 2, LABO PAT 1, LABO PAT 2
 * RESTAU P 1, RESTAU P 2, TA BAR, RECEPTION
 */
export const OFFICIAL_ROOM_NAMES = [
  "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10",
  "S INFO 1", "S INFO 2", "S AMEDEUS", "S 3 S", "S JK",
  "DORTOIR JK", "BUANDERIE",
  "CUISINE P 1", "CUISINE P 2",
  "LABO PAT 1", "LABO PAT 2",
  "RESTAU P 1", "RESTAU P 2",
  "TA BAR", "RECEPTION"
];

export const SEED_ROOMS: Omit<Room, "id">[] = [
  // Salles de cours normales (S1 à S10)
  { name: "S1", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },
  { name: "S2", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },
  { name: "S3", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },
  { name: "S4", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },
  { name: "S5", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },
  { name: "S6", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },
  { name: "S7", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },
  { name: "S8", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },
  { name: "S9", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },
  { name: "S10", kind: "normale", capacity: 30, allowedKinds: ["COURS"], blocked: [] },

  // Salles informatiques et spécialisées (enseignement théorique et pratique informatisée)
  { name: "S INFO 1", kind: "pedagogique", capacity: 25, allowedKinds: ["COURS"], blocked: [] },
  { name: "S INFO 2", kind: "pedagogique", capacity: 25, allowedKinds: ["COURS"], blocked: [] },
  { name: "S AMEDEUS", kind: "pedagogique", capacity: 25, allowedKinds: ["COURS"], blocked: [] },
  { name: "S 3 S", kind: "pedagogique", capacity: 25, allowedKinds: ["COURS"], blocked: [] },
  { name: "S JK", kind: "pedagogique", capacity: 25, allowedKinds: ["COURS"], blocked: [] },

  // Hébergement et entretien
  { name: "DORTOIR JK", kind: "atelier", capacity: 25, allowedKinds: ["TP"], blocked: [] },
  { name: "BUANDERIE", kind: "atelier", capacity: 25, allowedKinds: ["TP"], blocked: [] },

  // Ateliers de cuisine et laboratoires de pâtisserie
  { name: "CUISINE P 1", kind: "atelier", capacity: 28, allowedKinds: ["TP"], blocked: [] },
  { name: "CUISINE P 2", kind: "atelier", capacity: 28, allowedKinds: ["TP"], blocked: [] },
  { name: "LABO PAT 1", kind: "atelier", capacity: 25, allowedKinds: ["TP"], blocked: [] },
  { name: "LABO PAT 2", kind: "atelier", capacity: 25, allowedKinds: ["TP"], blocked: [] },

  // Restaurants d'application, bar et réception
  { name: "RESTAU P 1", kind: "atelier", capacity: 30, allowedKinds: ["TP", "COURS"], blocked: [] },
  { name: "RESTAU P 2", kind: "atelier", capacity: 30, allowedKinds: ["TP", "COURS"], blocked: [] },
  { name: "TA BAR", kind: "atelier", capacity: 25, allowedKinds: ["TP", "COURS"], blocked: [] },
  { name: "RECEPTION", kind: "atelier", capacity: 28, allowedKinds: ["TP", "COURS"], blocked: [] },
];
