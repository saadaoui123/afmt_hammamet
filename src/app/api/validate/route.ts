import { NextResponse } from "next/server";
import { loadDb } from "@/server/load";
import { checkCandidate, ctxFor, type Candidate } from "@/lib/conflicts";

export const dynamic = "force-dynamic";

/**
 * Revalidation immédiate : vérifie une affectation manuelle (ajout ou
 * modification) contre le planning actif AVANT toute persistance.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const a = body.assignment as (Candidate & { id?: number }) | undefined;
  if (!a) return NextResponse.json({ error: "Affectation manquante" }, { status: 400 });

  const data = await loadDb();
  if (!data) return NextResponse.json({ ok: false, error: "Aucune donnée chargée" });
  if (!data.settings.activeVersionId)
    return NextResponse.json({ ok: false, error: "Aucune version du planning n'est active. Générez d'abord un planning." });

  const active = data.assignments.filter(
    (x) => x.versionId === data.settings.activeVersionId && x.id !== a.id
  );
  const ctx = ctxFor(data);
  const err = checkCandidate(a, active, ctx);
  if (err) return NextResponse.json({ ok: false, conflicts: [err] });
  return NextResponse.json({ ok: true, conflicts: [] });
}
