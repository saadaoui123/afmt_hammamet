export const GROUP_COLORS: Array<{ bg: string; border: string; text: string; dot: string }> = [
  { bg: "#E3EEEA", border: "#3E7A6D", text: "#1E4A41", dot: "#3E7A6D" },
  { bg: "#F6EBDA", border: "#B4762A", text: "#6E4613", dot: "#B4762A" },
  { bg: "#F5E3DC", border: "#B0543A", text: "#712F1D", dot: "#B0543A" },
  { bg: "#E3E8EE", border: "#4E6472", text: "#32424D", dot: "#4E6472" },
  { bg: "#EDEDD9", border: "#7A7A34", text: "#4E4E1D", dot: "#7A7A34" },
  { bg: "#EFE1EA", border: "#8A4A6C", text: "#5B2E46", dot: "#8A4A6C" },
  { bg: "#E2EBF0", border: "#456E86", text: "#2A4553", dot: "#456E86" },
  { bg: "#EFE9DF", border: "#8C6A45", text: "#57412A", dot: "#8C6A45" },
];

export function groupColor(id: number) {
  return GROUP_COLORS[id % GROUP_COLORS.length];
}

export const CATEGORY_LABELS: Record<string, string> = {
  generale: "Compétence générale",
  particuliere: "Compétence particulière",
  enseignement: "Enseignement",
};

export const ROOM_KIND_LABELS: Record<string, string> = {
  normale: "Salle normale",
  atelier: "Atelier",
  pedagogique: "Espace pédagogique",
};

export const LEVEL_LABELS: Record<string, string> = { CAP: "CAP", BTP: "BTP", BTS: "BTS" };

export function levelYearLabel(level: string, year: number): string {
  const y = ["1ère", "2ème", "3ème"];
  return `${level}${level === "BTS" || year > 1 ? " " + (y[year - 1] ?? `${year}ème`) : ""}`;
}

export function scoreTone(score: number): "good" | "ok" | "warn" {
  if (score >= 80) return "good";
  if (score >= 60) return "ok";
  return "warn";
}

export const WEIGHT_INFO: Array<{ key: string; label: string; desc: string }> = [
  { key: "gaps", label: "Heures creuses", desc: "Éviter les trous horaires inutiles dans la semaine des groupes." },
  { key: "overload", label: "Surcharges journalières", desc: "Éviter de surcharger un formateur sur une même journée." },
  { key: "balance", label: "Équilibre de charge", desc: "Répartir équitablement entre formateurs qualifiés d'une même compétence." },
  { key: "prefs", label: "Préférences de créneaux", desc: "Respecter les créneaux préférés des formateurs (si renseignés)." },
  { key: "compact", label: "Compacité", desc: "Regrouper les séances d'un même groupe sur le moins de jours possible." },
];

export const ENTITY_LABELS: Record<string, string> = {
  instructors: "Formateur",
  groups: "Groupe",
  subjects: "Matière",
  teachings: "Volume horaire",
  rooms: "Salle",
  assignments: "Séance",
  versions: "Version du planning",
  settings: "Réglages",
  planning: "Planning",
};

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
