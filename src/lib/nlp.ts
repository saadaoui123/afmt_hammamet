import { toHHMM, type SlotInfo } from "./time";
import type { Instructor } from "./types";

export interface NlpRule {
  ok: boolean;
  summary: string;
  instructorId?: number;
  instructorName?: string;
  day: number; // 0-4, -1 = tous les jours, -2 = non détecté
  slots: number[]; // indices de créneaux concernés
  mode: "block" | "free";
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Saisie assistée en langage naturel des disponibilités (deterministe, sans LLM).
 * Ex. : « Ahmed n'est pas disponible le vendredi après-midi »
 *       « Leila est disponible le mercredi matin »
 *       « Karim est indisponible tous les jours de 15h30 à 17h30 »
 */
export function parseAvailability(text: string, instructors: Instructor[], slots: SlotInfo[]): NlpRule {
  const t = stripAccents(text.trim().toLowerCase());

  const mode: "block" | "free" = /pas\s+disponible|indisponible|non\s+disponible|absent|impossible/.test(t)
    ? "block"
    : /disponible|dispo|peut|libre/.test(t)
      ? "free"
      : "block";

  // Nom du formateur (prénom ou nom, correspondance la plus longue d'abord)
  let best: { id: number; name: string; len: number } | null = null;
  for (const i of instructors) {
    for (const part of [i.firstName, i.lastName]) {
      const p = stripAccents(part.toLowerCase());
      if (p.length >= 3 && t.includes(p) && (!best || p.length > best.len))
        best = { id: i.id, name: `${i.firstName} ${i.lastName}`, len: p.length };
    }
  }
  if (!best)
    return {
      ok: false,
      mode,
      day: -2,
      slots: [],
      summary: "Nom de formateur introuvable. Précisez le nom d'un formateur existant (ex. : « Ahmed n'est pas disponible le vendredi après-midi »).",
    };

  // Jour
  const dayNames = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
  let day = -2;
  if (/tous les jours|chaque jour|toute la semaine/.test(t)) day = -1;
  else {
    const found: number[] = [];
    for (let d = 0; d < 5; d++) {
      if (new RegExp(`\\b${dayNames[d]}`).test(t)) found.push(d);
    }
    day = found.length === 1 ? found[0] : found.length > 1 ? -1 : -2;
  }
  if (day === -2)
    return {
      ok: false,
      mode,
      day,
      slots: [],
      instructorId: best.id,
      instructorName: best.name,
      summary: "Jour introuvable. Précisez un jour (lundi → vendredi) ou « tous les jours ».",
    };

  // Créneaux concernés
  const all = Array.from({ length: slots.length }, (_, i) => i);
  let slotIdx: number[] = all;
  let periodLabel = "toute la journée";
  const range = t.match(/de\s+(\d{1,2})[h]?\s*(?:a|a|-|jusqu[' ]?a)\s*(\d{1,2})[h]?\s*(?:30)?/);
  if (range) {
    const from = parseInt(range[1], 10) * 60;
    const to = parseInt(range[2], 10) * 60 + (range[3] ? 30 : 0);
    slotIdx = all.filter((i) => slots[i].startMin < to && slots[i].endMin > from);
    periodLabel = `de ${from / 60}h${from % 60 ? "30" : ""} à ${to / 60}h${to % 60 ? "30" : ""}`;
  } else {
    const morning = /\bmatin\b/.test(t);
    const afternoon = /apres[- ]?midi/.test(t);
    if (morning && !afternoon) {
      slotIdx = all.filter((i) => slots[i].endMin <= 720);
      periodLabel = "le matin";
    } else if (afternoon) {
      slotIdx = all.filter((i) => slots[i].startMin >= 720);
      periodLabel = "l'après-midi";
    }
  }
  if (slotIdx.length === 0)
    return {
      ok: false,
      mode,
      day,
      slots: [],
      instructorId: best.id,
      instructorName: best.name,
      summary: "Aucun créneau de la grille ne correspond à cette période. Vérifiez les horaires de l'établissement.",
    };

  const summary =
    `${best.name} — ${day === -1 ? "tous les jours" : dayNames[day]} — ${periodLabel} — ` +
    (mode === "block" ? "indisponible (créneaux bloqués)" : "disponible uniquement sur ces créneaux");

  return { ok: true, mode, day, slots: slotIdx, instructorId: best.id, instructorName: best.name, summary };
}

/** Bornes « HH:MM » d'un créneau (utilisé par les apercus). */
export function slotLabel(slots: SlotInfo[], idx: number): string {
  const s = slots[idx];
  return `${toHHMM(s.startMin)}–${toHHMM(s.endMin)}`;
}
