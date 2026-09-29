import { NextResponse } from "next/server";
import { db } from "@/db";
import * as S from "@/db/schema";
import type { PgTable } from "drizzle-orm/pg-core";
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
    name: (r) => `${r.name} (${r.level} ${r.year}e)` as string,
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

function pick(body: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

export async function GET(_req: Request, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;
  const def = TABLES[table];
  if (!def) return NextResponse.json({ error: "Table inconnue" }, { status: 400 });
  const rows = await db.select().from(def.table);
  return NextResponse.json(rows);
}

export async function POST(req: Request, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;
  const def = TABLES[table];
  if (!def) return NextResponse.json({ error: "Table inconnue" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const values = pick(body, def.fields);
  if (!Object.keys(values).length)
    return NextResponse.json({ error: "Aucun champ valide fourni" }, { status: 400 });
  const [row] = await db.insert(def.table).values(values as never).returning();
  await logAudit(body.author || "Ines Khrifech", table, String(row.id), "création", `${ENTITY_LABELS[table] ?? table} créé : ${def.name(row as never)}`);
  return NextResponse.json(row);
}
