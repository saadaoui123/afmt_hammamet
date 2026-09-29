import { NextResponse } from "next/server";
import { db } from "@/db";
import * as S from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/server/load";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(S.settings).limit(1);
  if (!rows.length) return NextResponse.json({ empty: true });
  return NextResponse.json(rows[0]);
}

const FIELDS = ["periodName", "startDate", "endDate", "boundaries", "enabledDays", "coursDurations", "tpDurations", "weights", "holidays", "specialRules", "activeVersionId"] as const;

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f];
  if (body.author !== undefined) {
    /* réservé pour l'audit */
  }
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
  patch.updatedAt = new Date();
  const rows = await db.update(S.settings).set(patch as never).where(eq(S.settings.id, 1)).returning();
  const changed = FIELDS.filter((f) => body[f] !== undefined);
  await logAudit(body.author || "Ines Khrifech", "settings", "1", "modification", `Réglages mis à jour : ${changed.join(", ")}`);
  return NextResponse.json(rows[0]);
}
