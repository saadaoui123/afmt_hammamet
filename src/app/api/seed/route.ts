import { NextResponse } from "next/server";
import { db } from "@/db";
import * as S from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadDb, logAudit } from "@/server/load";
import { solve } from "@/lib/solver";
import {
  DEFAULT_SETTINGS,
  SEED_INSTRUCTORS,
  SEED_GROUPS,
  SEED_SUBJECTS,
  SEED_ROOMS,
  buildSeedTeachings,
} from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { generate?: boolean; author?: string };
  const author = body.author || "Ines Khrifech";

  // Purge (ordre des FK)
  await db.delete(S.assignments);
  await db.delete(S.versions);
  await db.delete(S.teachings);
  await db.delete(S.rooms);
  await db.delete(S.subjects);
  await db.delete(S.groups);
  await db.delete(S.instructors);
  await db.delete(S.settings);

  const [st] = await db.insert(S.settings).values(DEFAULT_SETTINGS as never).returning();
  const instructors = await db.insert(S.instructors).values(SEED_INSTRUCTORS).returning();
  const groups = await db.insert(S.groups).values(SEED_GROUPS).returning();
  const subjects = await db.insert(S.subjects).values(SEED_SUBJECTS).returning();
  await db
    .insert(S.teachings)
    .values(buildSeedTeachings(groups.map((g) => g.id), subjects.map((s) => s.id)));
  await db.insert(S.rooms).values(SEED_ROOMS);

  let generated = false;
  if (body.generate) {
    const data = await loadDb();
    if (data) {
      const res = solve(data);
      const [v] = await db
        .insert(S.versions)
        .values({
          label: `Génération initiale — ${new Date().toLocaleDateString("fr-FR")}`,
          note: "Planning de démonstration généré automatiquement",
          author,
          score: res.score,
          conflictCount: 0,
          unplacedCount: res.unplaced.length,
        })
        .returning();
      if (res.assignments.length)
        await db.insert(S.assignments).values(res.assignments.map((a) => ({ ...a, versionId: v.id })));
      await db.update(S.settings).set({ activeVersionId: v.id, updatedAt: new Date() }).where(eq(S.settings.id, st.id));
      await logAudit(author, "planning", String(v.id), "generation", `Planning de démonstration généré — score ${res.score}/100, ${res.assignments.length} séances`);
      generated = true;
    }
  }
  await logAudit(author, "données", "-", "import", "Données de démonstration IFMT chargées (8 formateurs, 6 groupes, 12 matières, 8 salles)");
  return NextResponse.json({ ok: true, generated });
}
