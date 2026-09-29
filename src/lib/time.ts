export const DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
export const DAYS_FR_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const DAYS_ALIASES: Record<string, number> = {
  lundi: 0,
  mardi: 1,
  mercredi: 2,
  jeudi: 3,
  vendredi: 4,
  lun: 0,
  mar: 1,
  mer: 2,
  jeu: 3,
  ven: 4,
  samedi: 5,
  sam: 5,
  dimanche: 6,
  dim: 6,
};

export function parseDay(label: string): number | null {
  const key = label.toLowerCase().trim();
  for (const [k, v] of Object.entries(DAYS_ALIASES)) {
    if (key === k || key.startsWith(k)) return v;
  }
  return null;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface SlotInfo {
  index: number;
  startMin: number;
  endMin: number;
  hours: number;
}

/** Construit les créneaux élémentaires à partir des bornes horaires. */
export function buildSlots(boundaries: string[]): SlotInfo[] {
  const slots: SlotInfo[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startMin = toMinutes(boundaries[i]);
    const endMin = toMinutes(boundaries[i + 1]);
    if (endMin <= startMin) continue;
    slots.push({ index: i, startMin, endMin, hours: (endMin - startMin) / 60 });
  }
  return slots;
}

/** Fenêtres continues (créneaux adjacents) d'une durée totale exacte. */
export function windowsFor(slots: SlotInfo[], hours: number): SlotInfo[][] {
  const out: SlotInfo[][] = [];
  for (let i = 0; i < slots.length; i++) {
    let total = 0;
    let run: SlotInfo[] = [];
    for (let j = i; j < slots.length; j++) {
      if (j > i && slots[j].startMin !== slots[j - 1].endMin) break; // discontinuité (pause)
      run.push(slots[j]);
      total += slots[j].hours;
      if (total === hours) {
        out.push([...run]);
        break;
      }
      if (total > hours) break;
    }
  }
  return out;
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Décompose un volume horaire en blocs de durées autorisées (déterministe, blocs larges d'abord). */
export function decomposeHours(total: number, allowed: number[]): number[] | null {
  if (total <= 0) return null;
  const sorted = [...new Set(allowed)].sort((a, b) => b - a);
  const out: number[] = [];
  let rest = total;
  while (rest > 0) {
    const d = sorted.find((x) => x <= rest);
    if (!d) return null;
    out.push(d);
    rest -= d;
  }
  return out;
}

/** Jours travaillés entre deux dates (excluant les week-ends et les jours fériés donnés). */
export function workingDaysBetween(startISO: string, endISO: string, holidayISOs: string[]): number {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  const holidays = new Set(holidayISOs);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const iso = d.toISOString().slice(0, 10);
    if (holidays.has(iso)) continue;
    count++;
  }
  return count;
}

export function weeksBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
