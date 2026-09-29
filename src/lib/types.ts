export interface Settings {
  id: number;
  periodName: string;
  startDate: string;
  endDate: string;
  boundaries: string[];
  enabledDays: number[];
  coursDurations: number[];
  tpDurations: number[];
  weights: Record<string, number>;
  holidays: Array<{ date: string; label: string }>;
  specialRules?: {
    pause1214Enabled: boolean;
    after18Enabled: boolean;
    allowedSpecialties: string[];
  };
  activeVersionId: number | null;
  updatedAt?: string;
}

export interface Instructor {
  id: number;
  firstName: string;
  lastName: string;
  specialty: string;
  competences: string[];
  maxHoursPerWeek: number;
  maxHoursPerDay: number;
  blocked: Array<{ day: number; slots: number[] }>;
  preferences: Array<{ day: number; slots: number[] }>;
  active: boolean;
}

export interface Group {
  id: number;
  name: string;
  level: string;
  year: number;
  specialty: string;
  studentCount: number;
}

export interface Subject {
  id: number;
  name: string;
  competenceKey: string;
  kind: "COURS" | "TP";
  category: "generale" | "particuliere" | "enseignement";
}

export interface Teaching {
  id: number;
  groupId: number;
  subjectId: number;
  hoursPerWeek: number;
}

export interface Room {
  id: number;
  name: string;
  kind: "normale" | "atelier" | "pedagogique";
  capacity: number;
  allowedKinds: string[];
  blocked: Array<{ day: number; slots: number[] }>;
}

export interface ScheduleVersion {
  id: number;
  label: string;
  note: string;
  author: string;
  score: number;
  conflictCount: number;
  unplacedCount: number;
  createdAt: string;
}

export interface Assignment {
  id: number;
  versionId: number;
  teachingId: number | null;
  day: number;
  startSlot: number;
  hours: number;
  kind: "COURS" | "TP";
  groupId: number;
  subjectId: number;
  instructorId: number;
  roomId: number;
  source: "gen" | "manuel";
  createdAt?: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  author: string;
  entity: string;
  entityId: string;
  action: string;
  details: string;
}

export interface Database {
  settings: Settings;
  instructors: Instructor[];
  groups: Group[];
  subjects: Subject[];
  teachings: Teaching[];
  rooms: Room[];
  versions: ScheduleVersion[];
  assignments: Assignment[];
  audit: AuditEntry[];
}

export interface Conflict {
  code:
    | "INSTRUCTOR_OVERLAP"
    | "GROUP_OVERLAP"
    | "ROOM_OVERLAP"
    | "COMPETENCE_MISSING"
    | "ROOM_INCOMPATIBLE"
    | "ROOM_TOO_SMALL"
    | "TIME_EXCEEDED_DAY"
    | "TIME_EXCEEDED_WEEK"
    | "INSTRUCTOR_UNAVAILABLE"
    | "ROOM_UNAVAILABLE"
    | "DURATION_INVALID"
    | "VOLUME_EXCEEDED"
    | "SPECIAL_SCHEDULE_VIOLATION";
  message: string;
  assignmentId?: number;
}

export interface UnplacedSession {
  groupId: number;
  subjectId: number;
  hours: number;
  teachingId: number;
  reasons: string[];
}

export interface ScoreBreakdown {
  gaps: number;
  overload: number;
  balance: number;
  prefs: number;
  compact: number;
  total: number;
}

export interface SolveResult {
  assignments: Array<Omit<Assignment, "id" | "versionId" | "createdAt">>;
  unplaced: UnplacedSession[];
  infeasible: boolean;
  blocking: string[];
  score: number;
  breakdown: ScoreBreakdown;
  checks: string[];
}
