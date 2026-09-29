import { NextResponse } from "next/server";
import { loadDb } from "@/server/load";
import { solve } from "@/lib/solver";
import { computeScore, ctxFor } from "@/lib/conflicts";
import { diffAssignments } from "@/lib/diff";
import type { Assignment, Database } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Mode simulation : évalue l'impact d'un changement de données
 * (ajout/retrait formateur, salle, groupe) sur le planning actuel,
 * SANS rien persister.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Partial<Database>;
  const data = await loadDb();
  if (!data) return NextResponse.json({ error: "Aucune donnée chargée" }, { status: 400 });

  const modified: Database = {
    ...data,
    instructors: body.instructors ?? data.instructors,
    groups: body.groups ?? data.groups,
    rooms: body.rooms ?? data.rooms,
    teachings: body.teachings ?? data.teachings,
    subjects: body.subjects ?? data.subjects,
  };

  const current = data.settings.activeVersionId
    ? data.assignments.filter((a) => a.versionId === data.settings.activeVersionId)
    : [];
  const currentScore = current.length ? computeScore(current, ctxFor(data)).total : 0;

  const res = solve(modified, current);
  const d = diffAssignments(current, res.assignments as unknown as Assignment[]);
  return NextResponse.json({
    score: res.score,
    currentScore,
    infeasible: res.infeasible,
    blocking: res.blocking,
    unplaced: res.unplaced,
    checks: res.checks,
    diff: {
      added: d.added.length,
      removed: d.removed.length,
      moved: d.moved.length,
    },
    placedCount: res.assignments.length,
  });
}
