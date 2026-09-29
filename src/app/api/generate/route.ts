import { NextResponse } from "next/server";
import { db } from "@/db";
import * as S from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadDb, logAudit } from "@/server/load";
import { solve } from "@/lib/solver";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { label = "", note = "", keepCurrent = false, author = "Ines Khrifech" } = body as {
    label?: string;
    note?: string;
    keepCurrent?: boolean;
    author?: string;
  };
  const data = await loadDb();
  if (!data) return NextResponse.json({ error: "Aucune donnée chargée. Chargez d'abord les données." }, { status: 400 });

  const keep = keepCurrent && data.settings.activeVersionId
    ? data.assignments.filter((a) => a.versionId === data.settings.activeVersionId)
    : undefined;

  const t0 = Date.now();
  const res = solve(data, keep);
  const ms = Date.now() - t0;

  const stamp = new Date().toLocaleDateString("fr-FR") + " " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const [v] = await db
    .insert(S.versions)
    .values({
      label: label || `Génération du ${stamp}`,
      note,
      author,
      score: res.score,
      conflictCount: 0,
      unplacedCount: res.unplaced.length,
    })
    .returning();

  if (res.assignments.length)
    await db.insert(S.assignments).values(
      res.assignments.map((a) => ({ ...a, versionId: v.id }))
    );

  const st = await db.select().from(S.settings).limit(1);
  await db.update(S.settings).set({ activeVersionId: v.id, updatedAt: new Date() }).where(eq(S.settings.id, st[0].id));

  await logAudit(
    author,
    "planning",
    String(v.id),
    "generation",
    `Nouvelle version « ${v.label} » — score ${res.score}/100, ${res.assignments.length} séances placées, ${res.unplaced.length} non placées, en ${ms} ms${keepCurrent ? " (régénération incrémentale)" : ""}`
  );

  return NextResponse.json({ version: v, result: res, ms });
}
