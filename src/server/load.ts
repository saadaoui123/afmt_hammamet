import { db } from "@/db";
import * as S from "@/db/schema";
import type { Database } from "@/lib/types";

/** Charge l'intégralité de l'état applicatif (source unique). */
export async function loadDb(): Promise<Database | null> {
  const settingsRows = await db.select().from(S.settings).limit(1);
  if (!settingsRows.length) return null;
  const [instructors, groups, subjects, teachings, rooms, versions, assignments, audit] =
    await Promise.all([
      db.select().from(S.instructors).orderBy(S.instructors.id),
      db.select().from(S.groups).orderBy(S.groups.id),
      db.select().from(S.subjects).orderBy(S.subjects.id),
      db.select().from(S.teachings).orderBy(S.teachings.id),
      db.select().from(S.rooms).orderBy(S.rooms.id),
      db.select().from(S.versions).orderBy(S.versions.id),
      db.select().from(S.assignments).orderBy(S.assignments.id),
      db.select().from(S.auditLog).orderBy(S.auditLog.id).limit(200),
    ]);
  return {
    settings: settingsRows[0] as unknown as Database["settings"],
    instructors: instructors as unknown as Database["instructors"],
    groups: groups as unknown as Database["groups"],
    subjects: subjects as unknown as Database["subjects"],
    teachings: teachings as unknown as Database["teachings"],
    rooms: rooms as unknown as Database["rooms"],
    versions: versions as unknown as Database["versions"],
    assignments: assignments as unknown as Database["assignments"],
    audit: (audit.slice(-80) as unknown as Database["audit"]),
  };
}

export async function logAudit(
  author: string,
  entity: string,
  entityId: string,
  action: string,
  details: string
) {
  await db
    .insert(S.auditLog)
    .values({ author: author || "Ines Khrifech", entity, entityId, action, details })
    .catch(() => undefined);
}
