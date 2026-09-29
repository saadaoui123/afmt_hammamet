import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

/** Ligne unique de configuration globale (période, créneaux, pondérations, version active). */
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  periodName: text("period_name").notNull().default("Semestre"),
  startDate: text("start_date").notNull().default("2025-10-06"),
  endDate: text("end_date").notNull().default("2026-01-23"),
  /** Bornes horaires "HH:MM" : chaque intervalle consécutif forme un créneau élémentaire (2h). */
  boundaries: jsonb("boundaries")
    .$type<string[]>()
    .notNull()
    .default(["08:00", "10:00", "12:00", "13:30", "15:30", "17:30"]),
  /** Jours actifs (0 = lundi … 4 = vendredi). */
  enabledDays: jsonb("enabled_days").$type<number[]>().notNull().default([0, 1, 2, 3, 4]),
  /** Durées de séance autorisées pour les cours théoriques. */
  coursDurations: jsonb("cours_durations").$type<number[]>().notNull().default([2, 4]),
  /** Durées de séance autorisées pour les TP. */
  tpDurations: jsonb("tp_durations").$type<number[]>().notNull().default([4]),
  /** Poids des contraintes souples (0 à 10). */
  weights: jsonb("weights")
    .$type<Record<string, number>>()
    .notNull()
    .default({ gaps: 6, overload: 5, balance: 5, prefs: 3, compact: 8 }),
  /** Jours fériés / vacances : [{ date: "2026-01-01", label: "Nouvel An" }] */
  holidays: jsonb("holidays")
    .$type<Array<{ date: string; label: string }>>()
    .notNull()
    .default([]),
  /** Règles spéciales des horaires (Pause 12h-14h et après 18h réservées aux TP Cuisine, Pâtisserie, Restaurant) */
  specialRules: jsonb("special_rules")
    .$type<{
      pause1214Enabled: boolean;
      after18Enabled: boolean;
      allowedSpecialties: string[];
    }>()
    .notNull()
    .default({
      pause1214Enabled: true,
      after18Enabled: true,
      allowedSpecialties: ["Cuisine", "Pâtisserie", "Restaurant", "Restauration"],
    }),
  /** Version du planning actuellement active (planning central unique). */
  activeVersionId: integer("active_version_id"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const instructors = pgTable("instructors", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  specialty: text("specialty").notNull().default(""),
  /** Clés de compétences (correspondent aux competenceKey des matières). */
  competences: jsonb("competences").$type<string[]>().notNull().default([]),
  maxHoursPerWeek: integer("max_hours_per_week").notNull().default(18),
  maxHoursPerDay: integer("max_hours_per_day").notNull().default(8),
  /** Créneaux bloqués : [{ day: 0-4, slots: [indices] }] */
  blocked: jsonb("blocked").$type<Array<{ day: number; slots: number[] }>>().notNull().default([]),
  /** Préférences de créneaux : [{ day: 0-4, slots: [indices] }] */
  preferences: jsonb("preferences").$type<Array<{ day: number; slots: number[] }>>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  level: text("level").notNull().default("CAP"), // CAP | BTP | BTS
  year: integer("year").notNull().default(1),
  specialty: text("specialty").notNull().default(""),
  studentCount: integer("student_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  competenceKey: text("competence_key").notNull(),
  kind: text("kind").notNull().default("COURS"), // COURS | TP
  category: text("category").notNull().default("generale"), // generale | particuliere | enseignement
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Volume horaire hebdomadaire demandé : groupe × matière. */
export const teachings = pgTable("teachings", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  hoursPerWeek: integer("hours_per_week").notNull().default(2),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("normale"), // normale | atelier | pedagogique
  capacity: integer("capacity").notNull().default(30),
  /** Types de séances autorisés : ["COURS","TP"] */
  allowedKinds: jsonb("allowed_kinds").$type<string[]>().notNull().default(["COURS"]),
  /** Créneaux bloqués : [{ day, slots }] */
  blocked: jsonb("blocked").$type<Array<{ day: number; slots: number[] }>>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const versions = pgTable("schedule_versions", {
  id: serial("id").primaryKey(),
  label: text("label").notNull().default("Version"),
  note: text("note").notNull().default(""),
  author: text("author").notNull().default("Ines Khrifech"),
  score: integer("score").notNull().default(0),
  conflictCount: integer("conflict_count").notNull().default(0),
  unplacedCount: integer("unplaced_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Affectations du planning central : une ligne par séance placée. */
export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  versionId: integer("version_id")
    .notNull()
    .references(() => versions.id, { onDelete: "cascade" }),
  teachingId: integer("teaching_id").references(() => teachings.id, {
    onDelete: "cascade",
  }),
  day: integer("day").notNull(), // 0 = lundi … 4 = vendredi
  startSlot: integer("start_slot").notNull(), // index du créneau de départ
  hours: integer("hours").notNull(),
  kind: text("kind").notNull().default("COURS"),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  instructorId: integer("instructor_id")
    .notNull()
    .references(() => instructors.id, { onDelete: "cascade" }),
  roomId: integer("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  source: text("source").notNull().default("gen"), // gen | manuel
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at").notNull().defaultNow(),
  author: text("author").notNull().default("Ines Khrifech"),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull().default(""),
  action: text("action").notNull(),
  details: text("details").notNull().default(""),
});
