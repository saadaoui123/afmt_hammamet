import { NextResponse } from "next/server";
import { db } from "@/db";
import * as S from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadDb, logAudit } from "@/server/load";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(S.versions).orderBy(S.versions.id);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { action, id, author = "Ines Khrifech" } = body as { action?: string; id?: number; author?: string };
  if (!id) return NextResponse.json({ error: "Version inconnue" }, { status: 400 });
  const data = await loadDb();
  if (!data) return NextResponse.json({ error: "Aucune donnée chargée" }, { status: 400 });
  const v = data.versions.find((x) => x.id === id);
  if (!v) return NextResponse.json({ error: "Version introuvable" }, { status: 404 });

  if (action === "activate") {
    const st = await db.select().from(S.settings).limit(1);
    await db.update(S.settings).set({ activeVersionId: id, updatedAt: new Date() }).where(eq(S.settings.id, st[0].id));
    await logAudit(author, "planning", String(id), "activation", `Version « ${v.label} » réactivée comme planning central`);
    return NextResponse.json({ ok: true });
  }
  if (action === "delete") {
    await db.delete(S.versions).where(eq(S.versions.id, id));
    if (data.settings.activeVersionId === id) {
      const st = await db.select().from(S.settings).limit(1);
      await db.update(S.settings).set({ activeVersionId: null, updatedAt: new Date() }).where(eq(S.settings.id, st[0].id));
    }
    await logAudit(author, "planning", String(id), "suppression", `Version « ${v.label} » supprimée de l'historique`);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
