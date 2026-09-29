"use client";
import React, { useMemo } from "react";
import { useApp } from "@/components/AppShell";
import { Badge, Bar, Btn, Card, EmptyState, I, ScoreRing, Stat } from "@/components/ui";
import { ctxFor, findConflicts, volumeGaps } from "@/lib/conflicts";
import { fmtDate, weeksBetween, workingDaysBetween } from "@/lib/time";
import { ROOM_KIND_LABELS, scoreTone } from "@/lib/format";

export default function RecapView() {
  const { db, active, setView, hasPlanning } = useApp();
  const computed = useMemo(() => {
    if (!db) return null;
    const reqByGroup = new Map<number, number>();
    const reqBySubject = new Map<number, number>();
    for (const t of db.teachings) {
      reqByGroup.set(t.groupId, (reqByGroup.get(t.groupId) || 0) + t.hoursPerWeek);
      reqBySubject.set(t.subjectId, (reqBySubject.get(t.subjectId) || 0) + t.hoursPerWeek);
    }
    const placedByInstr = new Map<number, number>();
    const placedByGroup = new Map<number, number>();
    const placedBySubject = new Map<number, number>();
    const placedByRoom = new Map<number, number>();
    for (const a of active) {
      placedByInstr.set(a.instructorId, (placedByInstr.get(a.instructorId) || 0) + a.hours);
      placedByGroup.set(a.groupId, (placedByGroup.get(a.groupId) || 0) + a.hours);
      placedBySubject.set(a.subjectId, (placedBySubject.get(a.subjectId) || 0) + a.hours);
      placedByRoom.set(a.roomId, (placedByRoom.get(a.roomId) || 0) + a.hours);
    }
    const totalReq = [...reqByGroup.values()].reduce((s, x) => s + x, 0);
    const totalPlaced = active.reduce((s, a) => s + a.hours, 0);
    const conflicts = findConflicts(active, ctxFor(db));
    const gaps = volumeGaps(active, db);
    return { reqByGroup, reqBySubject, placedByInstr, placedByGroup, placedBySubject, placedByRoom, totalReq, totalPlaced, conflicts, gaps };
  }, [db, active]);

  if (!db || !computed) return null;
  const version = db.versions.find((v) => v.id === db.settings.activeVersionId);
  const weeks = weeksBetween(db.settings.startDate, db.settings.endDate);
  const workingDays = workingDaysBetween(db.settings.startDate, db.settings.endDate, db.settings.holidays.map((h) => h.date));
  const holidaysInRange = db.settings.holidays.filter(
    (h) => h.date >= db.settings.startDate && h.date <= db.settings.endDate
  );
  const tone = scoreTone(version?.score ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
              IFMT Hammamet
            </span>
            <span className="text-xs text-inkfaint">· Direction des Études : <b>Ines Khrifech</b></span>
          </div>
          <h1 className="font-display text-xl font-bold">Récapitulatif du planning</h1>
          <p className="text-sm text-inksoft">
            {db.settings.periodName} · {fmtDate(db.settings.startDate)} → {fmtDate(db.settings.endDate)} ·{" "}
            {version ? version.label : "aucune version active"}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" onClick={() => setView("planning")}>
            <I.grid className="h-4 w-4" /> Voir le planning
          </Btn>
          <Btn size="sm" onClick={() => setView("generate")}>
            <I.wand className="h-4 w-4" /> Nouvelle génération
          </Btn>
        </div>
      </div>

      {!hasPlanning ? (
        <EmptyState
          icon={<I.dash className="h-10 w-10" />}
          title="Aucun planning actif"
          text="Chargez les données puis générez un premier planning : toutes les statistiques de cette page proviennent du planning central unique."
        >
          <Btn onClick={() => setView("generate")}>
            <I.wand className="h-4 w-4" /> Ouvrir la génération
          </Btn>
        </EmptyState>
      ) : (
        <>
          {/* Cartes clés */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
              <ScoreRing score={version?.score ?? 0} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-inksoft">Score de qualité</p>
                <p className="text-xs text-inkfaint">contraintes souples pondérées</p>
              </div>
            </div>
            <Stat label="Heures planifiées" value={`${computed.totalPlaced}h`} sub={`sur ${computed.totalReq}h demandées / semaine`} tone="petrol" />
            <Stat
              label="Heures restantes"
              value={`${computed.gaps.reduce((s, g) => s + g.missing, 0)}h`}
              sub={`${computed.gaps.length} ligne(s) de volume non atteinte(s)`}
              tone={computed.gaps.length ? "warn" : "good"}
            />
            <Stat
              label="Conflits détectés"
              value={computed.conflicts.length}
              sub={computed.conflicts.length ? "à corriger en urgence" : "aucune contrainte obligatoire violée"}
              tone={computed.conflicts.length ? "danger" : "good"}
            />
            <Stat label="Séances du planning" value={active.length} sub={`réparti(e)s sur ${workingDays} jours ouvrables de la période`} />
          </div>

          {/* Barres de charge */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Heures par formateur" sub="planifiées / plafond hebdomadaire">
              <ul className="space-y-2.5">
                {db.instructors.map((i) => {
                  const h = computed.placedByInstr.get(i.id) || 0;
                  return (
                    <li key={i.id}>
                      <div className="mb-1 flex items-center justify-between text-[13px]">
                        <span className="font-semibold">
                          {i.firstName} {i.lastName}
                          {!i.active && <Badge tone="warn" className="ml-1.5">inactif</Badge>}
                        </span>
                        <span className="tabular-nums text-inksoft flex items-center gap-1.5">
                          <span>{h}h / {i.maxHoursPerWeek}h</span>
                          {h > i.maxHoursPerWeek && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                              +{h - i.maxHoursPerWeek}h sup
                            </span>
                          )}
                        </span>
                      </div>
                      <Bar value={h} max={i.maxHoursPerWeek} tone={h > i.maxHoursPerWeek ? "brass" : "petrol"} />
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Heures par groupe" sub="planifiées / volume demandé">
              <ul className="space-y-2.5">
                {db.groups.map((g) => {
                  const req = computed.reqByGroup.get(g.id) || 0;
                  const h = computed.placedByGroup.get(g.id) || 0;
                  return (
                    <li key={g.id}>
                      <div className="mb-1 flex items-center justify-between text-[13px]">
                        <span className="font-semibold">{g.name}</span>
                        <span className="tabular-nums text-inksoft">
                          {h}h / {req}h
                        </span>
                      </div>
                      <Bar value={h} max={req} tone={h < req ? "warn" : "good"} />
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Heures par matière" sub="tous groupes confondus">
              <ul className="space-y-2.5">
                {[...computed.reqBySubject.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([sid, req]) => {
                    const s = db.subjects.find((x) => x.id === sid)!;
                    const h = computed.placedBySubject.get(sid) || 0;
                    return (
                      <li key={sid}>
                        <div className="mb-1 flex items-center justify-between text-[13px]">
                          <span className="font-semibold">
                            {s.name} <Badge className="ml-1">{s.kind}</Badge>
                          </span>
                          <span className="tabular-nums text-inksoft">
                            {h}h / {req}h
                          </span>
                        </div>
                        <Bar value={h} max={req} tone={h < req ? "warn" : "good"} />
                      </li>
                    );
                  })}
              </ul>
            </Card>
            <Card title="Utilisation des salles" sub="heures d'occupation et part de la semaine">
              <ul className="space-y-2.5">
                {db.rooms.map((r) => {
                  const h = computed.placedByRoom.get(r.id) || 0;
                  const max = db.settings.enabledDays.length * (db.settings.boundaries.length - 1) * 2;
                  return (
                    <li key={r.id}>
                      <div className="mb-1 flex items-center justify-between text-[13px]">
                        <span className="font-semibold">
                          {r.name} <span className="text-[11px] text-inkfaint">· {ROOM_KIND_LABELS[r.kind]} · {r.capacity} pl.</span>
                        </span>
                        <span className="tabular-nums text-inksoft">
                          {h}h · {max ? Math.round((h / max) * 100) : 0}%
                        </span>
                      </div>
                      <Bar value={h} max={max} tone="brass" />
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          {/* Volumes non atteints */}
          {computed.gaps.length > 0 && (
            <Card title="Séances non planifiées / volume horaire non atteint" sub="heures restantes par groupe et compétence — cause : blocage du générateur ou retrait manuel">
              <ul className="divide-y divide-linesoft">
                {computed.gaps.map((g) => {
                  const grp = db.groups.find((x) => x.id === g.teaching.groupId);
                  const sub = db.subjects.find((x) => x.id === g.teaching.subjectId);
                  return (
                    <li key={g.teaching.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                      <span className="font-semibold">
                        {grp?.name} <span className="text-inkfaint">×</span> {sub?.name} <Badge>{sub?.kind}</Badge>
                      </span>
                      <Badge tone="warn">
                        {g.placed}h / {g.teaching.hoursPerWeek}h — {g.missing}h restantes
                      </Badge>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex justify-end">
                <Btn size="sm" variant="brass" onClick={() => setView("generate")}>
                  <I.wand className="h-4 w-4" /> Tenter une régénération
                </Btn>
              </div>
            </Card>
          )}

          {/* Période */}
          <Card title="Période de planification" sub="début/fin configurables — jours fériés et week-ends exclus automatiquement">
            <div className="grid gap-4 text-[13px] sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-bold uppercase text-inksoft">Semaine type</p>
                <p className="font-semibold">{db.settings.enabledDays.length} jours · {(db.settings.boundaries.length - 1) * 2}h de créneaux</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-inksoft">Jours ouvrables</p>
                <p className="font-semibold tabular-nums">{workingDays} jours sur la période</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-inksoft">Semaines de formation</p>
                <p className="font-semibold tabular-nums">{weeks} semaines</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-inksoft">Jours exclus (fériés)</p>
                <p className="font-semibold">
                  {holidaysInRange.length
                    ? holidaysInRange.map((h) => `${fmtDate(h.date)} (${h.label})`).join(", ")
                    : "aucun sur la période"}
                </p>
              </div>
            </div>
            {version && (
              <p className="mt-3 text-xs text-inkfaint">
                Volume total estimé sur la période : <b>{computed.totalReq * Math.max(1, Math.floor(weeks * 5 / 7))}h</b>{" "}
                (heures hebdomadaires × semaines, fériés exclus) · score actuel :{" "}
                <b className={tone === "good" ? "text-good-700" : tone === "ok" ? "text-warn-700" : "text-danger-700"}>
                  {version.score}/100
                </b>
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
