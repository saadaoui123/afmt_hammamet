import { NextResponse } from "next/server";
import { db } from "@/db";
import * as S from "@/db/schema";
import type { PgTable } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { logAudit } from "@/server/load";
import { ENTITY_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

type TableDef = { table: PgTable; fields: string[]; name: (r: Record<string, unknown>) => string };

const TABLES: Record<string, TableDef> = {
  instructors: {
    table: S.instructors as PgTable,
    fields: ["firstName", "lastName", "specialty", "competences", "maxHoursPerWeek", "maxHoursPerDay", "blocked", "preferences", "active"],
    name: (r) => `${r.firstName} ${r.lastName}`.trim(),
  },
  groups: {
    table: S.groups as PgTable,
    fields: ["name", "level", "year", "specialty", "studentCount"],
    name: (r) => r.name as string,
  },
  subjects: {
    table: S.subjects as PgTable,
    fields: ["name", "competenceKey", "kind", "category"],
    name: (r) => `${r.name} (${r.kind})` as string,
  },
  teachings: {
    table: S.teachings as PgTable,
    fields: ["groupId", "subjectId", "hoursPerWeek"],
    name: (r) => `${r.groupId}×${r.subjectId} ${r.hoursPerWeek}h` as string,
  },
  rooms: {
    table: S.rooms as PgTable,
    fields: ["name", "kind", "capacity", "allowedKinds", "blocked"],
    name: (r) => r.name as string,
  },
  assignments: {
    table: S.assignments as PgTable,
    fields: ["versionId", "teachingId", "day", "startSlot", "hours", "kind", "groupId", "subjectId", "instructorId", "roomId", "source"],
    name: (r) => `Séance j${r.day} c${r.startSlot} ${r.hours}h` as string,
  },
};

const idOf = (t: PgTable) => (t as unknown as { id: never }).id;

export async function GET(_req: Request, ctx: { params: Promise<{ table: string; id: string }> }) {
  const { table, id } = await ctx.params;
  const def = TABLES[table];
  if (!def) return NextResponse.json({ error: "Table inconnue" }, { status: 400 });
  const rows = await db.select().from(def.table).where(eq(idOf(def.table), Number(id)));
  if (!rows.length) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(req: Request, ctx: { params: Promise<{ table: string; id: string }> }) {
  const { table, id } = await ctx.params;
  const def = TABLES[table];
  if (!def) return NextResponse.json({ error: "Table inconnue" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const values = Object.fromEntries(Object.entries(body).filter(([k]) => def.fields.includes(k)));
  if (!Object.keys(values).length)
    return NextResponse.json({ error: "Aucun champ valide fourni" }, { status: 400 });
  const rows = await db.update(def.table).set(values as never).where(eq(idOf(def.table), Number(id))).returning();
  if (!rows.length) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  await logAudit(
    body.author || "Ines Khrifech",
    table,
    id,
    "modification",
    `${ENTITY_LABELS[table] ?? table} « ${def.name(rows[0] as never)} » modifié (${Object.keys(values).join(", ")})`
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ table: string; id: string }> }) {
  const { table, id } = await ctx.params;
  const def = TABLES[table];
  if (!def) return NextResponse.json({ error: "Table inconnue" }, { status: 400 });
  const before = await db.select().from(def.table).where(eq(idOf(def.table), Number(id)));
  if (!before.length) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  await db.delete(def.table).where(eq(idOf(def.table), Number(id)));
  const body = await req.json().catch(() => ({}));
  const author = (body as { author?: string }).author || "Ines Khrifech";
  await logAudit(author, table, id, "suppression", `${ENTITY_LABELS[table] ?? table} « ${def.name(before[0] as never)} » supprimé`);
  return NextResponse.json({ ok: true });
}
