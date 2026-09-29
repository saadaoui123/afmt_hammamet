import type { Assignment } from "./types";

export interface VersionDiff {
  added: Assignment[];
  removed: Assignment[];
  moved: Array<{ from: Assignment; to: Assignment }>;
}

function key(a: Assignment): string {
  return `${a.groupId}|${a.subjectId}|${a.hours}`;
}

/** Comparaison avant/après entre deux plannings (même source centrale). */
export function diffAssignments(before: Assignment[], after: Assignment[]): VersionDiff {
  const byKey = (list: Assignment[]) => {
    const m = new Map<string, Assignment[]>();
    for (const a of [...list].sort((x, y) => x.day - y.day || x.startSlot - y.startSlot)) {
      const k = key(a);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  };
  const A = byKey(before);
  const B = byKey(after);
  const added: Assignment[] = [];
  const removed: Assignment[] = [];
  const moved: VersionDiff["moved"] = [];

  for (const [k, listA] of A) {
    const listB = B.get(k) || [];
    const n = Math.min(listA.length, listB.length);
    for (let i = 0; i < n; i++) {
      const a = listA[i];
      const b = listB[i];
      if (a.day !== b.day || a.startSlot !== b.startSlot || a.instructorId !== b.instructorId || a.roomId !== b.roomId)
        moved.push({ from: a, to: b });
      B.set(k, listB.slice(n));
    }
    for (let i = n; i < listA.length; i++) removed.push(listA[i]);
  }
  for (const listB of B.values()) for (const b of listB) added.push(b);
  return { added, removed, moved };
}
