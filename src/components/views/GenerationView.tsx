"use client";
import React, { useState } from "react";
import { useApp } from "@/components/AppShell";
import { Badge, Bar, Btn, Card, EmptyState, Field, I, Input, Modal, ScoreRing } from "@/components/ui";
import { api } from "@/lib/api";
import { DAYS_FR, toHHMM, buildSlots } from "@/lib/time";
import { diffAssignments, type VersionDiff } from "@/lib/diff";
import type { Assignment, ScheduleVersion, SolveResult } from "@/lib/types";
import { fmtDateTime, WEIGHT_INFO } from "@/lib/format";

interface Result {
  version: ScheduleVersion;
  result: SolveResult;
  ms: number;
}

export default function GenerationView() {
  const { db, active, hasPlanning, setView, refresh, toast, author } = useApp();
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [keepCurrent, setKeepCurrent] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [diffV, setDiffV] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  if (!db) return null;

  const generate = async () => {
    setRunning(true);
    try {
      const r = await api<Result>("/api/generate", "POST", { label, note, keepCurrent, author });
      setResult(r);
      await refresh();
      if (r.result.infeasible) toast("Planning partiel : des séances n'ont pas pu être placées. Causes listées ci-dessous.", "warn");
      else toast(`Planning généré — score ${r.result.score}/100, aucune contrainte obligatoire violée.`, "good");
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setRunning(false);
      setLabel("");
      setNote("");
    }
  };

  const activate = async (id: number) => {
    try {
      await api("/api/versions", "POST", { action: "activate", id, author });
      await refresh();
      toast("Version réactivée comme planning central (repli sur l'historique).", "good");
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  };

  const del = async (id: number) => {
    try {
      await api("/api/versions", "POST", { action: "delete", id, author });
      await refresh();
      toast("Version supprimée de l'historique.", "warn");
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  };

  const version = db.versions.find((v) => v.id === db.settings.activeVersionId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold">Génération du planning</h1>
        <p className="text-sm text-inksoft">
          Moteur de contraintes déterministe : formateur + groupe + matière + salle + créneau, validé contrainte par contrainte
          avant chaque insertion. Optimisation des contraintes souples pondérées.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {/* Formulaire */}
        <Card title="Nouvelle génération" sub="le planning central sera remplacé par la nouvelle version (l'ancienne reste dans l'historique)" className="lg:col-span-2">
          <div className="space-y-3">
            <Field label="Libellé de la version">
              <Input placeholder={`Génération du ${new Date().toLocaleDateString("fr-FR")}`} value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Field label="Note (facultatif)">
              <Input placeholder="Ex. : rattrapage semaine du 3 novembre, remplacement de Nadia…" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex items-center gap-2 rounded-md bg-petrol-50/80 px-2.5 py-1.5 text-xs text-inksoft border border-petrol-200/50">
              <I.user className="h-3.5 w-3.5 text-petrol-700 shrink-0" />
              <span>Signataire de la version : <b>{author}</b> (Directrice des études)</span>
            </div>
            {hasPlanning && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-petrol-50 px-3 py-2.5 text-[13px]">
                <input type="checkbox" checked={keepCurrent} onChange={(e) => setKeepCurrent(e.target.checked)} className="mt-0.5" />
                <span>
                  <b>Régénération incrémentale</b>
                  <br />
                  <span className="text-inksoft">
                    Privilégier le maintien des séances déjà planifiées (utile après ajout/retrait d'un formateur, d'une salle ou d'un
                    groupe).
                  </span>
                </span>
              </label>
            )}
            <Btn onClick={generate} disabled={running} className="w-full justify-center">
              {running ? <I.refresh className="h-4 w-4 animate-spin" /> : <I.wand className="h-4 w-4" />}
              {running ? "Résolution en cours…" : "Générer le planning"}
            </Btn>
            <p className="text-[11px] leading-snug text-inkfaint">
              Aucune donnée manquante ? Vérifiez <b>Données</b>. Les poids des contraintes souples se règlent dans <b>Réglages</b>
              sans toucher au code.
            </p>
          </div>
        </Card>

        {/* Résultat */}
        <div className="lg:col-span-3">
          {!result ? (
            <Card title="Résultat de la dernière génération">
              {version ? (
                <div className="flex items-center gap-4">
                  <ScoreRing score={version.score} size={64} />
                  <div className="text-sm text-inksoft">
                    <p>
                      <b>{version.label}</b> — {fmtDateTime(version.createdAt)} par {version.author}
                    </p>
                    <p className="mt-1">
                      Score de qualité : <b>{version.score}/100</b> · {version.unplacedCount} séance(s) non placée(s) ·{" "}
                      {version.conflictCount} conflit(s) obligatoire(s)
                    </p>
                    <p className="text-xs text-inkfaint">Générez une nouvelle version pour voir le détail des vérifications.</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-inksoft">Aucune génération effectuée pour le moment.</p>
              )}
            </Card>
          ) : (
            <Card
              title={
                <span className="flex items-center gap-2">
                  {result.result.infeasible ? (
                    <>
                      <I.alert className="h-4 w-4 text-danger-600" /> Planning impossible avec les contraintes actuelles
                    </>
                  ) : (
                    <>
                      <I.check className="h-4 w-4 text-good-600" /> Planning généré sans aucune violation
                    </>
                  )}
                </span>
              }
              sub={`${result.version.label} · ${result.result.assignments.length} séances · ${result.ms} ms`}
            >
              {result.result.blocking.length > 0 && (
                <div className="mb-3 rounded-lg border border-danger-600 bg-danger-50 p-3 text-[13px] text-danger-700">
                  <p className="font-bold">Contraintes bloquantes :</p>
                  <ul className="ml-5 mt-1 list-disc">
                    {result.result.blocking.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.result.infeasible && (
                <p className="mb-3 rounded-lg border border-warn-600 bg-warn-50 p-2.5 text-[13px] text-warn-700">
                  <b>Meilleur planning partiel conservé</b> — les séances non plaçables sont listées ci-dessous avec la raison
                  exacte de chaque blocage.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-4 rounded-lg border border-line bg-petrol-50/60 p-3">
                  <ScoreRing score={result.result.score} size={64} />
                  <div>
                    <p className="text-[11px] font-bold uppercase text-inksoft">Score de qualité</p>
                    <p className="text-xs text-inksoft">contraintes souples pondérées</p>
                  </div>
                  <div className="ml-auto space-y-1.5">
                    {WEIGHT_INFO.map((w) => (
                      <div key={w.key} className="flex items-center gap-2">
                        <span className="w-28 text-right text-[11px] font-semibold text-inksoft">{w.label}</span>
                        <div className="w-24">
                          <Bar value={result.result.breakdown[w.key as keyof typeof result.result.breakdown] || 0} max={100} tone={w.key === "compact" ? "petrol" : "brass"} />
                        </div>
                        <span className="w-7 tabular-nums text-[11px] font-bold">{result.result.breakdown[w.key as keyof typeof result.result.breakdown]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase text-inksoft">Contraintes obligatoires vérifiées</p>
                  <ul className="space-y-1 text-[12px] text-inksoft">
                    {result.result.checks.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <I.check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good-600" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {result.result.unplaced.length > 0 && (
                <div className="mt-3 rounded-lg border border-warn-600 bg-warn-50 p-3">
                  <p className="text-[13px] font-bold text-warn-700">
                    Séances non plaçables ({result.result.unplaced.length}) — causes du blocage
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {result.result.unplaced.map((u, i) => {
                      const g = db.groups.find((x) => x.id === u.groupId);
                      const s = db.subjects.find((x) => x.id === u.subjectId);
                      return (
                        <li key={i} className="rounded-md bg-card px-2.5 py-1.5 text-[12px]">
                          <b>
                            {g?.name} × {s?.name}
                          </b>{" "}
                          ({u.hours}h) — <span className="text-warn-700">{u.reasons.join(" · ")}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <Btn size="sm" variant="ghost" onClick={() => setView("planning")}>
                  <I.grid className="h-4 w-4" /> Voir le planning
                </Btn>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Historique */}
      <Card
        title="Historique des versions"
        sub="chaque version du planning central est conservée — comparaison avant/après et repli possibles à tout moment"
        pad={false}
      >
        {db.versions.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Aucune version" text="L'historique apparaîtra après la première génération." />
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-linesoft/50 text-left text-[11px] font-bold uppercase tracking-wide text-inksoft">
                <th className="px-4 py-2.5">Version</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Auteur</th>
                <th className="px-4 py-2.5 text-center">Score</th>
                <th className="px-4 py-2.5 text-center">Non placées</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...db.versions].reverse().map((v) => (
                <tr key={v.id} className={`border-b border-linesoft ${v.id === db.settings.activeVersionId ? "bg-petrol-50" : ""}`}>
                  <td className="px-4 py-2.5 font-semibold">
                    {v.label}
                    {v.id === db.settings.activeVersionId && <Badge tone="petrol" className="ml-2">active</Badge>}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-inksoft">{fmtDateTime(v.createdAt)}</td>
                  <td className="px-4 py-2.5 text-inksoft">{v.author}</td>
                  <td className="px-4 py-2.5 text-center font-bold tabular-nums">{v.score}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{v.unplacedCount}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <Btn size="sm" variant="ghost" onClick={() => setDiffV(v.id)} title="Comparer avec la version active">
                        <I.compare className="h-3.5 w-3.5" /> Diff
                      </Btn>
                      {v.id !== db.settings.activeVersionId && (
                        <Btn size="sm" variant="ghost" onClick={() => activate(v.id)} title="Réactiver cette version comme planning central">
                          <I.refresh className="h-3.5 w-3.5" /> Activer
                        </Btn>
                      )}
                      <Btn size="sm" variant={confirmDel === v.id ? "danger" : "ghost"} onClick={() => (confirmDel === v.id ? del(v.id) : setConfirmDel(v.id))} title="Supprimer cette version" className={confirmDel === v.id ? "" : "!text-danger-700"}>
                        <I.trash className="h-3.5 w-3.5" /> {confirmDel === v.id ? "Confirmer ?" : ""}
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {diffV !== null && <DiffModal versionId={diffV} onClose={() => setDiffV(null)} />}
    </div>
  );
}

function DiffModal({ versionId, onClose }: { versionId: number; onClose: () => void }) {
  const { db } = useApp();
  const slots = buildSlots(db!.settings.boundaries);
  const activeVersionId = db!.settings.activeVersionId;
  const target = db!.versions.find((v) => v.id === versionId);
  const other = versionId === activeVersionId ? db!.versions.find((v) => v.id !== activeVersionId) : target!;
  const beforeList = db!.assignments.filter((a) => a.versionId === (activeVersionId ?? -1)) as Assignment[];
  const afterList = db!.assignments.filter((a) => a.versionId === versionId) as Assignment[];
  const [a, b] = versionId === activeVersionId ? [beforeList, afterList] : [afterList, beforeList];
  const d: VersionDiff = diffAssignments(a, b);
  const name = (id: string, ids: number[]) => {
    if (id === "g") return db!.groups.find((x) => x.id === (ids as number[])[0])?.name ?? "";
    return "";
  };
  const label = (x: Assignment) => {
    const g = db!.groups.find((z) => z.id === x.groupId)?.name;
    const s = db!.subjects.find((z) => z.id === x.subjectId)?.name;
    const f = db!.instructors.find((z) => z.id === x.instructorId);
    const r = db!.rooms.find((z) => z.id === x.roomId);
    const w = a && buildSlots(db!.settings.boundaries);
    const slots2 = w;
    let time = "";
    for (let i = 0; i < slots2.length; i++) {
      let acc = 0;
      let run = 0;
      for (let j = i; j < slots2.length; j++) {
        if (j > i && slots2[j].startMin !== slots2[j - 1].endMin) break;
        acc += slots2[j].hours;
        run = j;
        if (acc === x.hours) {
          time = `${toHHMM(slots2[i].startMin)}–${toHHMM(slots2[run].endMin)}`;
          break;
        }
        if (acc > x.hours) break;
      }
    }
    return { g, s, f: f ? `${f.firstName} ${f.lastName}` : "", r: r?.name ?? "", time };
  };
  if (!db || !target) return null;
  return (
    <Modal
      wide
      title={
        versionId === activeVersionId
          ? `Diff : ${target.label} (active) contre la version précédente`
          : `Diff : « ${target.label} » contre la version active`
      }
      sub="Comparaison avant/après issue du même planning central"
      onClose={onClose}
      footer={<Btn size="sm" variant="ghost" onClick={onClose}>Fermer</Btn>}
    >
      <div className="mb-3 flex gap-2">
        <Badge tone="good">+ {d.added.length} séance(s) ajoutée(s)</Badge>
        <Badge tone="danger">− {d.removed.length} séance(s) retirée(s)</Badge>
        <Badge tone="brass">↔ {d.moved.length} séance(s) déplacée(s)</Badge>
      </div>
      {(d.added.length === 0 && d.removed.length === 0 && d.moved.length === 0) && (
        <p className="text-sm text-inksoft">Les deux versions sont identiques séance par séance.</p>
      )}
      <div className="space-y-3 text-[13px]">
        {d.added.length > 0 && (
          <div>
            <p className="mb-1 font-bold text-good-700">Ajoutées</p>
            <ul className="space-y-1">
              {d.added.map((x, i) => {
                const l = label(x);
                return (
                  <li key={i} className="rounded-md bg-good-50 px-2.5 py-1.5">
                    {DAYS_FR[x.day]} {l.time} — <b>{l.g}</b> × {l.s} avec {l.f} en {l.r}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {d.removed.length > 0 && (
          <div>
            <p className="mb-1 font-bold text-danger-700">Retirées</p>
            <ul className="space-y-1">
              {d.removed.map((x, i) => {
                const l = label(x);
                return (
                  <li key={i} className="rounded-md bg-danger-50 px-2.5 py-1.5">
                    {DAYS_FR[x.day]} {l.time} — <b>{l.g}</b> × {l.s} avec {l.f} en {l.r}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {d.moved.length > 0 && (
          <div>
            <p className="mb-1 font-bold text-brass-700">Déplacées / réattribuées</p>
            <ul className="space-y-1">
              {d.moved.map(({ from, to }, i) => {
                const lf = label(from);
                const lt = label(to);
                return (
                  <li key={i} className="rounded-md bg-brass-50 px-2.5 py-1.5">
                    <b>{lt.g}</b> × {lt.s} : {DAYS_FR[from.day]} {lf.time} → <b>{DAYS_FR[to.day]} {lt.time}</b>
                    {lf.f !== lt.f && (
                      <>
                        {" "}
                        · {lf.f} → <b>{lt.f}</b>
                      </>
                    )}
                    {lf.r !== lt.r && (
                      <>
                        {" "}
                        · {lf.r} → <b>{lt.r}</b>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
