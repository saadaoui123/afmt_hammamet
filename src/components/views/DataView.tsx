"use client";
import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppShell";
import { Badge, Btn, Card, EmptyState, Field, I, Input, Modal, NumInput, SegTabs, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { buildSlots, DAYS_FR, toHHMM, workingDaysBetween } from "@/lib/time";
import { parseAvailability, type NlpRule } from "@/lib/nlp";
import type { Database, Group, Instructor, Room, Subject } from "@/lib/types";
import { CATEGORY_LABELS, ROOM_KIND_LABELS } from "@/lib/format";
import { OFFICIAL_ROOM_NAMES } from "@/lib/seed-data";

type Tab = "instructors" | "groups" | "subjects" | "rooms" | "calendar";

interface SimResult {
  score: number;
  currentScore: number;
  infeasible: boolean;
  blocking: string[];
  unplaced: Array<{ groupId: number; subjectId: number; hours: number; reasons: string[] }>;
  diff: { added: number; removed: number; moved: number };
  placedCount: number;
}

export default function DataView() {
  const { db, hasPlanning, refresh, toast, author } = useApp();
  const [tab, setTab] = useState<Tab>("instructors");
  const [impact, setImpact] = useState<{ sim: SimResult; label: string; apply: () => Promise<void>; regen: boolean } | null>(null);

  if (!db) return null;
  const slots = buildSlots(db.settings.boundaries);

  /** Tout changement structurel passe par la simulation si un planning est actif. */
  const withSimulation = async (
    patch: Partial<Pick<Database, "instructors" | "groups" | "rooms">>,
    label: string,
    apply: () => Promise<void>
  ) => {
    if (!hasPlanning) {
      await apply();
      return;
    }
    try {
      const sim = await api<SimResult>("/api/simulate", "POST", { ...patch });
      setImpact({ sim, label, apply, regen: true });
    } catch (e) {
      toast(`Simulation impossible : ${(e as Error).message}`, "danger");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold">Données de l'établissement</h1>
        <p className="text-sm text-inksoft">
          Saisie et import des données avant génération. {hasPlanning && (
            <span className="text-petrol-800">
              <b>Mode simulation actif</b> : tout ajout/retrait de formateur, salle ou groupe affiche l'impact prévu avant validation.
            </span>
          )}
        </p>
      </div>

      <SegTabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "instructors", label: "Formateurs", icon: <I.user className="h-3.5 w-3.5" /> },
          { id: "groups", label: "Groupes & volumes", icon: <I.users className="h-3.5 w-3.5" /> },
          { id: "subjects", label: "Matières & compétences", icon: <I.book className="h-3.5 w-3.5" /> },
          { id: "rooms", label: "Salles", icon: <I.room className="h-3.5 w-3.5" /> },
          { id: "calendar", label: "Calendrier & période", icon: <I.clock className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === "instructors" && <InstructorsTab withSimulation={withSimulation} slots={slots.length} />}
      {tab === "groups" && <GroupsTab withSimulation={withSimulation} />}
      {tab === "subjects" && <SubjectsTab />}
      {tab === "rooms" && <RoomsTab withSimulation={withSimulation} slots={slots.length} />}
      {tab === "calendar" && <CalendarTab />}

      {impact && (
        <ImpactModal
          data={impact}
          onClose={() => setImpact(null)}
          onConfirm={async (regen: boolean) => {
            const { apply, label } = impact;
            setImpact(null);
            await apply();
            if (regen) {
              const r = await api<{ result: { infeasible: boolean; score: number } }>("/api/generate", "POST", {
                label: `Régénération après ${label}`,
                note: "Régénération incrémentale suite à un changement de données",
                keepCurrent: true,
                author,
              });
              await refresh();
              toast(
                r.result.infeasible
                  ? "Changement validé et régénération terminée — attention, certaines séances ne sont pas plaçables (voir Génération)."
                  : `Changement validé — planning régénéré, score ${r.result.score}/100.`,
                r.result.infeasible ? "warn" : "good"
              );
            } else {
              toast("Changement validé sans régénération (les heures concernées redeviennent non planifiées).", "warn");
            }
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------- Modal d'impact ----------------------------- */

function ImpactModal({
  data,
  onClose,
  onConfirm,
}: {
  data: { sim: SimResult; label: string; regen: boolean };
  onClose: () => void;
  onConfirm: (regen: boolean) => Promise<void>;
}) {
  const { db } = useApp();
  const s = data.sim;
  const name = (k: "g" | "s", id: number) =>
    k === "g" ? db?.groups.find((x) => x.id === id)?.name : db?.subjects.find((x) => x.id === id)?.name;
  return (
    <Modal
      wide
      title={`Mode simulation — impact prévu : ${data.label}`}
      sub="Le moteur a recalculé le planning en mémoire. Rien n'a été modifié : validez pour appliquer."
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => onConfirm(false)}>
            Valider sans régénérer
          </Btn>
          <Btn size="sm" onClick={() => onConfirm(true)}>
            <I.wand className="h-4 w-4" /> Valider et régénérer
          </Btn>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-line bg-petrol-50 px-4 py-2 text-center">
          <p className="text-[10px] font-bold uppercase text-inksoft">Score actuel</p>
          <p className="font-display text-xl font-bold tabular-nums text-petrol-800">{s.currentScore}</p>
        </div>
        <span className="text-xl text-inkfaint">→</span>
        <div className="rounded-lg border border-line bg-card px-4 py-2 text-center">
          <p className="text-[10px] font-bold uppercase text-inksoft">Score prévu</p>
          <p className={`font-display text-xl font-bold tabular-nums ${s.score >= s.currentScore ? "text-good-700" : "text-danger-700"}`}>{s.score}</p>
        </div>
        <Badge tone="good">+{s.diff.added} ajoutée(s)</Badge>
        <Badge tone="danger">−{s.diff.removed} retirée(s)</Badge>
        <Badge tone="brass">↔{s.diff.moved} déplacée(s)</Badge>
        <Badge>{s.placedCount} séances au total</Badge>
      </div>
      {s.blocking.length > 0 && (
        <div className="mb-3 rounded-lg border border-danger-600 bg-danger-50 p-3 text-[13px] text-danger-700">
          <p className="font-bold">Contraintes bloquantes détectées :</p>
          <ul className="ml-5 mt-1 list-disc">{s.blocking.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      )}
      {s.unplaced.length > 0 && (
        <div className="rounded-lg border border-warn-600 bg-warn-50 p-3 text-[13px] text-warn-700">
          <p className="font-bold">Séances qui deviendraient non plaçables :</p>
          <ul className="mt-1 space-y-1">
            {s.unplaced.map((u, i) => (
              <li key={i}>
                <b>{name("g", u.groupId)} × {name("s", u.subjectId)}</b> ({u.hours}h) — {u.reasons[0]}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!s.blocking.length && !s.unplaced.length && (
        <p className="rounded-lg border border-good-600 bg-good-50 p-3 text-[13px] font-semibold text-good-700">
          Aucun blocage : le planning complet reste réalisable après ce changement.
        </p>
      )}
    </Modal>
  );
}

/* ------------------------------ Grille créneaux ------------------------------ */

function SlotGrid({
  value,
  onChange,
  slots,
  title,
  tone,
}: {
  value: Array<{ day: number; slots: number[] }>;
  onChange: (v: Array<{ day: number; slots: number[] }>) => void;
  slots: number;
  title: string;
  tone: "danger" | "brass";
}) {
  const { db } = useApp();
  const days = db?.settings.enabledDays ?? [0, 1, 2, 3, 4];
  const slotInfos = buildSlots(db?.settings.boundaries ?? []);
  const isOn = (day: number, slot: number) => value.some((v) => v.day === day && v.slots.includes(slot));
  const toggle = (day: number, slot: number) => {
    let list = value.map((v) => ({ ...v, slots: [...v.slots] }));
    const found = list.find((v) => v.day === day);
    if (isOn(day, slot)) {
      if (found) found.slots = found.slots.filter((s) => s !== slot);
      list = list.filter((v) => v.slots.length > 0);
    } else {
      if (found) found.slots.push(slot);
      else list.push({ day, slots: [slot] });
    }
    onChange(list);
  };
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-inksoft">{title}</p>
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="grid" style={{ gridTemplateColumns: `52px repeat(${slots}, 1fr)` }}>
          <div className="bg-linesoft/60" />
          {slotInfos.map((s) => (
            <div key={s.index} className="border-l border-linesoft bg-linesoft/40 px-0.5 py-1 text-center text-[10px] font-bold tabular-nums text-inksoft">
              {toHHMM(s.startMin)}
            </div>
          ))}
          {days.map((d) => (
            <React.Fragment key={d}>
              <div className="border-t border-linesoft bg-linesoft/60 px-1 py-1 text-center text-[10px] font-bold text-inksoft">{DAYS_FR[d].slice(0, 3)}</div>
              {Array.from({ length: slots }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggle(d, i)}
                  className={`m-0.5 rounded border transition ${
                    isOn(d, i)
                      ? tone === "danger"
                        ? "border-danger-600 bg-danger-100"
                        : "border-brass-600 bg-brass-100"
                      : "border-line bg-card hover:border-petrol-600"
                  }`}
                  aria-label={`${DAYS_FR[d]} ${slotInfos[i] ? toHHMM(slotInfos[i].startMin) : i}`}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Formateurs ------------------------------ */

function InstructorsTab({ withSimulation, slots }: { withSimulation: DataViewWithSim; slots: number }) {
  const { db, refresh, toast, author } = useApp();
  const [sel, setSel] = useState<Instructor | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [nlText, setNlText] = useState("");
  const [nl, setNl] = useState<NlpRule | null>(null);

  const allCompetences = useMemo(() => {
    const set = new Set<string>();
    for (const s of db?.subjects ?? []) set.add(s.competenceKey);
    for (const i of db?.instructors ?? []) for (const c of i.competences) set.add(c);
    return [...set].sort();
  }, [db]);

  const applyNl = async () => {
    if (!nl?.ok || nl.day === -2) return;
    const inst = db!.instructors.find((i) => i.id === nl.instructorId)!;
    const days = nl.day === -1 ? [0, 1, 2, 3, 4] : [nl.day];
    let blocked = inst.blocked.map((b) => ({ ...b, slots: [...b.slots] }));
    if (nl.mode === "block") {
      for (const d of days) {
        const f = blocked.find((b) => b.day === d);
        if (f) f.slots = [...new Set([...f.slots, ...nl.slots])];
        else blocked.push({ day: d, slots: [...nl.slots] });
      }
    } else {
      // "disponible uniquement sur X" → on bloque tout le reste sur ces jours
      const allSlots = Array.from({ length: slots }, (_, i) => i);
      for (const d of days) {
        const f = blocked.find((b) => b.day === d);
        if (f) f.slots = [...new Set([...f.slots, ...allSlots.filter((s) => !nl.slots.includes(s))])];
        else blocked.push({ day: d, slots: allSlots.filter((s) => !nl.slots.includes(s)) });
      }
    }
    await withSimulation(
      { instructors: db!.instructors.map((i) => (i.id === inst.id ? { ...i, blocked } : i)) },
      `modification des disponibilités de ${inst.firstName} ${inst.lastName}`,
      async () => {
        await api(`/api/resource/instructors/${inst.id}`, "PUT", { blocked, author });
        await refresh();
      }
    );
    setNl(null);
    setNlText("");
  };

  const del = async (id: number) => {
    const inst = db!.instructors.find((x) => x.id === id)!;
    await withSimulation(
      { instructors: db!.instructors.filter((x) => x.id !== id) },
      `retrait du formateur ${inst.firstName} ${inst.lastName}`,
      async () => {
        await api(`/api/resource/instructors/${id}`, "DELETE", { author });
        await refresh();
        toast("Formateur supprimé (ses séances sont retirées du planning central).", "warn");
      }
    );
  };

  return (
    <div className="space-y-3">
      <ImportExcelCard />
      <Card
        title="Saisie assistée en langage naturel"
        sub="Ex. : « Ahmed n'est pas disponible le vendredi après-midi » — converti automatiquement en règle structurée"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Ex. : Leila est disponible le mercredi matin · Karim est indisponible tous les jours de 15h30 à 17h30"
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            className="flex-1 min-w-64"
          />
          <Btn variant="ghost" onClick={() => setNl(parseAvailability(nlText, db!.instructors, buildSlots(db!.settings.boundaries)))}>
            <I.spark className="h-4 w-4" /> Analyser
          </Btn>
        </div>
        {nl && (
          <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-[13px] ${nl.ok ? "border-petrol-600 bg-petrol-50 text-petrol-900" : "border-warn-600 bg-warn-50 text-warn-700"}`}>
            <p className="font-semibold">{nl.summary}</p>
            {nl.ok && (
              <Btn size="sm" onClick={applyNl}>
                <I.check className="h-4 w-4" /> Appliquer la règle
              </Btn>
            )}
          </div>
        )}
      </Card>

      <Card
        title="Formateurs"
        sub="compétences, plafonds horaires, disponibilités et préférences de créneaux"
        actions={
          <Btn size="sm" onClick={() => setCreating(true)}>
            <I.plus className="h-4 w-4" /> Ajouter un formateur
          </Btn>
        }
        pad={false}
      >
        <div className="nice-scroll overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-line bg-linesoft/50 text-left text-[11px] font-bold uppercase tracking-wide text-inksoft">
                <th className="px-4 py-2.5">Formateur</th>
                <th className="px-4 py-2.5">Spécialité</th>
                <th className="px-4 py-2.5">Compétences</th>
                <th className="px-4 py-2.5 text-center">Max / sem.</th>
                <th className="px-4 py-2.5 text-center">Max / jour</th>
                <th className="px-4 py-2.5">Indisponibilités</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {db!.instructors.map((i) => (
                <tr key={i.id} className="border-b border-linesoft hover:bg-petrol-50/60">
                  <td className="px-4 py-2.5 font-semibold">
                    {i.firstName} {i.lastName}
                    {!i.active && <Badge tone="warn" className="ml-1.5">inactif</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-inksoft">{i.specialty || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {i.competences.map((c) => (
                        <Badge key={c} tone="petrol">{c}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{i.maxHoursPerWeek}h</td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{i.maxHoursPerDay}h</td>
                  <td className="px-4 py-2.5 text-[12px] text-inksoft">
                    {i.blocked.length
                      ? i.blocked.map((b) => `${DAYS_FR[b.day].slice(0, 3)} : ${b.slots.map((s) => slotTime(db!.settings.boundaries, s)).join(", ")}`).join(" · ")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => setSel(i)}>
                        <I.edit className="h-3.5 w-3.5" />
                      </Btn>
                      <Btn
                        size="sm"
                        variant={confirmDel === i.id ? "danger" : "ghost"}
                        className={confirmDel === i.id ? "" : "!text-danger-700"}
                        onClick={() => {
                          if (confirmDel === i.id) del(i.id);
                          else setConfirmDel(i.id);
                        }}
                      >
                        <I.trash className="h-3.5 w-3.5" />
                        {confirmDel === i.id ? " ?" : ""}
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(sel || creating) && (
        <InstructorModal
          instructor={sel}
          allCompetences={allCompetences}
          onClose={() => {
            setSel(null);
            setCreating(false);
          }}
          onSave={async (i) => {
            const isNew = !i.id;
            await withSimulation(
              {
                instructors: isNew
                  ? [...db!.instructors, { ...i, id: -1 } as Instructor]
                  : db!.instructors.map((x) => (x.id === i.id ? i : x)),
              },
              isNew ? `ajout du formateur ${i.firstName} ${i.lastName}` : `modification de ${i.firstName} ${i.lastName}`,
              async () => {
                if (isNew) await api("/api/resource/instructors", "POST", { ...i, author });
                else await api(`/api/resource/instructors/${i.id}`, "PUT", { ...i, author });
                await refresh();
              }
            );
            setSel(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

type DataViewWithSim = (
  patch: Partial<Pick<Database, "instructors" | "groups" | "rooms">>,
  label: string,
  apply: () => Promise<void>
) => Promise<void>;

/* ------------------------- Import Excel (mappage) ------------------------- */

const IMPORT_FIELDS = [
  { key: "firstName", label: "Prénom", required: true },
  { key: "lastName", label: "Nom", required: true },
  { key: "specialty", label: "Spécialité", required: false },
  { key: "competences", label: "Compétences (séparées par ; , ou /)", required: false },
  { key: "maxHoursPerWeek", label: "Heures max / semaine", required: false },
  { key: "maxHoursPerDay", label: "Heures max / jour", required: false },
] as const;

function guessColumn(headers: string[], field: string): number {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const h = headers.map(norm);
  if (field === "firstName") return h.findIndex((x) => x.includes("prenom"));
  if (field === "lastName") return h.findIndex((x) => x.includes("nom") && !x.includes("prenom"));
  if (field === "specialty") return h.findIndex((x) => x.includes("specialite"));
  if (field === "competences") return h.findIndex((x) => x.includes("competence"));
  if (field === "maxHoursPerWeek") return h.findIndex((x) => x.includes("semaine") || x.includes("maxhsem"));
  if (field === "maxHoursPerDay") return h.findIndex((x) => x.includes("jour"));
  return -1;
}

function ImportExcelCard() {
  const { db, refresh, toast, author } = useApp();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Array<string | number>>>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1, defval: "" });
      const nonEmpty = json.filter((r) => r.some((c) => String(c).trim() !== ""));
      if (nonEmpty.length < 2) {
        toast("Le fichier ne contient pas de données exploitables (en-têtes + lignes).", "danger");
        return;
      }
      const h = nonEmpty[0].map((x) => String(x));
      const m: Record<string, number> = {};
      for (const f of IMPORT_FIELDS) m[f.key] = guessColumn(h, f.key);
      setHeaders(h);
      setRows(nonEmpty.slice(1));
      setMapping(m);
      setFileName(file.name);
    } catch (e) {
      toast(`Lecture du fichier impossible : ${(e as Error).message}`, "danger");
    }
  };

  const parsedRows = useMemo(() => {
    return rows
      .map((r) => ({
        firstName: String(r[mapping.firstName] ?? "").trim(),
        lastName: String(r[mapping.lastName] ?? "").trim(),
        specialty: String(r[mapping.specialty] ?? "").trim(),
        competences: String(r[mapping.competences] ?? "")
          .split(/[;\/,]+/)
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean),
        maxHoursPerWeek: Number(r[mapping.maxHoursPerWeek]) || 18,
        maxHoursPerDay: Number(r[mapping.maxHoursPerDay]) || 8,
      }))
      .filter((r) => r.firstName && r.lastName);
  }, [rows, mapping]);

  const runImport = async () => {
    setImporting(true);
    try {
      let created = 0;
      let updated = 0;
      for (const p of parsedRows) {
        const existing = db!.instructors.find(
          (i) =>
            i.firstName.toLowerCase() === p.firstName.toLowerCase() &&
            i.lastName.toLowerCase() === p.lastName.toLowerCase()
        );
        if (existing) {
          await api(`/api/resource/instructors/${existing.id}`, "PUT", { ...p, author });
          updated++;
        } else {
          await api(
            "/api/resource/instructors",
            "POST",
            { ...p, blocked: [], preferences: [], active: true, author }
          );
          created++;
        }
      }
      await refresh();
      toast(`Import terminé : ${created} formateur(s) créé(s), ${updated} mis à jour. Pensez à régénérer le planning si besoin.`, "good");
      setHeaders([]);
      setRows([]);
      setFileName("");
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card
      title="Import assisté depuis Excel / CSV"
      sub="Sélectionnez le fichier, vérifiez le mappage des colonnes vers le modèle de données, puis importez"
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <Btn variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
          <I.download className="h-4 w-4 rotate-180" /> Choisir un fichier…
        </Btn>
        {fileName && <span className="text-xs font-semibold text-inksoft">{fileName}</span>}
        {!fileName && (
          <span className="text-xs text-inkfaint">
            Colonnes attendues : Prénom, Nom, Spécialité, Compétences, Max h/sem, Max h/jour (ordre libre — le mappage est guidé).
          </span>
        )}
      </div>
      {headers.length > 0 && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {IMPORT_FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
                <Select value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}>
                  <option value={-1}>— non mappé —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Colonne ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-linesoft/60 text-left text-[10px] font-bold uppercase text-inksoft">
                  <th className="px-2 py-1.5">Prévisualisation ({parsedRows.length} ligne(s) valide(s))</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 3).map((r, i) => (
                  <tr key={i} className="border-t border-linesoft">
                    <td className="px-2 py-1.5 text-inksoft">
                      <b className="text-ink">
                        {r.firstName} {r.lastName}
                      </b>{" "}
                      · {r.specialty || "—"} · {r.competences.join(", ") || "—"} · {r.maxHoursPerWeek}h/sem · {r.maxHoursPerDay}h/j
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" size="sm" onClick={() => { setHeaders([]); setRows([]); setFileName(""); }}>
              Annuler
            </Btn>
            <Btn size="sm" onClick={runImport} disabled={importing || parsedRows.length === 0}>
              {importing ? <I.refresh className="h-4 w-4 animate-spin" /> : <I.check className="h-4 w-4" />}
              Importer {parsedRows.length} formateur(s)
            </Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

function slotTime(boundaries: string[], slotIdx: number): string {
  const b = boundaries[slotIdx];
  return b ? `à partir de ${b}` : `${slotIdx}`;
}

function InstructorModal({
  instructor,
  allCompetences,
  onClose,
  onSave,
}: {
  instructor: Instructor | null;
  allCompetences: string[];
  onClose: () => void;
  onSave: (i: Instructor) => Promise<void>;
}) {
  const [f, setF] = useState<Instructor>(
    instructor ?? {
      id: 0,
      firstName: "",
      lastName: "",
      specialty: "",
      competences: [],
      maxHoursPerWeek: 16,
      maxHoursPerDay: 8,
      blocked: [],
      preferences: [],
      active: true,
    }
  );
  const [newComp, setNewComp] = useState("");
  const [err, setErr] = useState("");
  const save = async () => {
    if (!f.firstName.trim() || !f.lastName.trim()) {
      setErr("Le prénom et le nom sont obligatoires.");
      return;
    }
    await onSave({ ...f, firstName: f.firstName.trim(), lastName: f.lastName.trim() });
  };
  return (
    <Modal
      wide
      title={instructor ? `Modifier ${instructor.firstName} ${instructor.lastName}` : "Nouveau formateur"}
      sub="Les compétences correspondent aux clés des matières — un formateur n'enseigne que les matières de ses compétences."
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" size="sm" onClick={onClose}>Annuler</Btn>
          <Btn size="sm" onClick={save}><I.check className="h-4 w-4" /> Enregistrer</Btn>
        </>
      }
    >
      {err && <p className="mb-3 rounded-lg border border-danger-600 bg-danger-50 p-2 text-[13px] font-semibold text-danger-700">{err}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Prénom"><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
        <Field label="Nom"><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
        <Field label="Spécialité"><Input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></Field>
        <Field label="Statut">
          <Select value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}>
            <option value="1">Actif</option>
            <option value="0">Inactif (remplacé)</option>
          </Select>
        </Field>
        <Field label="Heures max / semaine"><NumInput value={f.maxHoursPerWeek} onChange={(e) => setF({ ...f, maxHoursPerWeek: Number(e.target.value) || 0 })} /></Field>
        <Field label="Heures max / jour"><NumInput value={f.maxHoursPerDay} onChange={(e) => setF({ ...f, maxHoursPerDay: Number(e.target.value) || 0 })} /></Field>
      </div>
      <div className="mt-3">
        <Field label="Compétences (matières et TP autorisés)">
          <div className="flex flex-wrap gap-1.5">
            {allCompetences.map((c) => {
              const on = f.competences.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setF({ ...f, competences: on ? f.competences.filter((x) => x !== c) : [...f.competences, c] })}
                  className={`rounded-md border px-2 py-1 text-[12px] font-semibold transition ${
                    on ? "border-petrol-700 bg-petrol-100 text-petrol-900" : "border-line bg-card text-inksoft hover:border-petrol-600"
                  }`}
                >
                  {c}
                </button>
              );
            })}
            {f.competences.filter((c) => !allCompetences.includes(c)).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setF({ ...f, competences: f.competences.filter((x) => x !== c) })}
                className="rounded-md border border-petrol-700 bg-petrol-100 px-2 py-1 text-[12px] font-semibold text-petrol-900"
              >
                {c} ×
              </button>
            ))}
          </div>
        </Field>
        <div className="mt-2 flex gap-2">
          <Input placeholder="Ajouter une compétence transversale / remplacement (ex. : cuisine)" value={newComp} onChange={(e) => setNewComp(e.target.value)} />
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => {
              const v = newComp.trim().toLowerCase().replace(/\s+/g, "-");
              if (v && !f.competences.includes(v)) setF({ ...f, competences: [...f.competences, v] });
              setNewComp("");
            }}
          >
            <I.plus className="h-4 w-4" />
          </Btn>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SlotGrid title="Indisponibilités (bloquant)" value={f.blocked} onChange={(v) => setF({ ...f, blocked: v })} slots={buildSlots(useAppDbBoundaries()).length} tone="danger" />
        <SlotGrid title="Préférences de créneaux (souplex)" value={f.preferences} onChange={(v) => setF({ ...f, preferences: v })} slots={buildSlots(useAppDbBoundaries()).length} tone="brass" />
      </div>
    </Modal>
  );
}

function useAppDbBoundaries(): string[] {
  const { db } = useApp();
  return db?.settings.boundaries ?? ["08:00", "10:00", "12:00", "13:30", "15:30", "17:30"];
}

/* ------------------------------ Groupes & volumes ------------------------------ */

function GroupsTab({ withSimulation }: { withSimulation: DataViewWithSim }) {
  const { db, refresh, toast, author, hasPlanning } = useApp();
  const [sel, setSel] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);
  const [addSub, setAddSub] = useState<Record<number, { subjectId: number; hours: number }>>({});

  const saveGroup = (g: Group) =>
    withSimulation(
      { groups: g.id ? db!.groups.map((x) => (x.id === g.id ? g : x)) : [...db!.groups, { ...g, id: -1 } as Group] },
      g.id ? `modification du groupe ${g.name}` : `ajout du groupe ${g.name}`,
      async () => {
        if (g.id) await api(`/api/resource/groups/${g.id}`, "PUT", { ...g, author });
        else await api("/api/resource/groups", "POST", { ...g, author });
        await refresh();
      }
    );

  const del = async (id: number) => {
    const g = db!.groups.find((x) => x.id === id)!;
    await withSimulation({ groups: db!.groups.filter((x) => x.id !== id) }, `retrait du groupe ${g.name}`, async () => {
      await api(`/api/resource/groups/${id}`, "DELETE", { author });
      await refresh();
      toast("Groupe supprimé (ses séances et volumes sont retirés).", "warn");
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Btn size="sm" onClick={() => setCreating(true)}>
          <I.plus className="h-4 w-4" /> Ajouter un groupe
        </Btn>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {db!.groups.map((g) => {
          const ts = db!.teachings.filter((t) => t.groupId === g.id);
          const total = ts.reduce((s, t) => s + t.hoursPerWeek, 0);
          return (
            <Card
              key={g.id}
              title={
                <span className="flex items-center gap-2">
                  {g.name}
                  <Badge tone="petrol">{g.level} {g.year}ème</Badge>
                  <Badge>{g.specialty}</Badge>
                </span>
              }
              sub={`${g.studentCount} apprenants · ${total}h/semaine demandées`}
              actions={
                <div className="flex gap-1">
                  <Btn size="sm" variant="ghost" onClick={() => setSel(g)}><I.edit className="h-3.5 w-3.5" /></Btn>
                  <DelBtn onDelete={() => del(g.id)} />
                </div>
              }
            >
              <ul className="mb-3 divide-y divide-linesoft">
                {ts.map((t) => {
                  const s = db!.subjects.find((x) => x.id === t.subjectId);
                  return (
                    <li key={t.id} className="flex items-center justify-between py-1.5 text-[13px]">
                      <span className="font-semibold">
                        {s?.name} <Badge className="ml-1">{s?.kind}</Badge>
                        <span className="ml-1 text-[11px] text-inkfaint">{s ? CATEGORY_LABELS[s.category] : ""}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums font-bold">{t.hoursPerWeek}h</span>
                        <Btn
                          size="sm"
                          variant="ghost"
                          className="!text-danger-700 !px-1.5"
                          title="Retirer ce volume (ses séances redeviendront non planifiées)"
                          onClick={async () => {
                            await api(`/api/resource/teachings/${t.id}`, "DELETE", { author });
                            await refresh();
                            toast(`Volume ${t.hoursPerWeek}h de ${s?.name} retiré de ${g.name}.`, "warn");
                          }}
                        >
                          <I.trash className="h-3.5 w-3.5" />
                        </Btn>
                      </span>
                    </li>
                  );
                })}
                {!ts.length && <li className="py-2 text-sm text-inkfaint">Aucune matière affectée à ce groupe.</li>}
              </ul>
              <div className="flex gap-2">
                <Select
                  className="flex-1 !py-1.5 text-xs"
                  value={addSub[g.id]?.subjectId ?? ""}
                  onChange={(e) => setAddSub({ ...addSub, [g.id]: { subjectId: Number(e.target.value) || 0, hours: addSub[g.id]?.hours ?? 2 } })}
                >
                  <option value="">+ Ajouter une matière…</option>
                  {db!.subjects
                    .filter((s) => !ts.some((t) => t.subjectId === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.kind})</option>
                    ))}
                </Select>
                <NumInput
                  className="!w-16 !py-1.5 text-xs"
                  min={1}
                  value={addSub[g.id]?.hours ?? 2}
                  onChange={(e) => setAddSub({ ...addSub, [g.id]: { subjectId: addSub[g.id]?.subjectId ?? 0, hours: Number(e.target.value) || 1 } })}
                />
                <Btn
                  size="sm"
                  variant="ghost"
                  disabled={!addSub[g.id]?.subjectId}
                  onClick={async () => {
                    const { subjectId, hours } = addSub[g.id];
                    await api("/api/resource/teachings", "POST", { groupId: g.id, subjectId, hoursPerWeek: hours, author });
                    await refresh();
                    setAddSub({ ...addSub, [g.id]: { subjectId: 0, hours: 2 } });
                    toast(`Volume de ${hours}h ajouté à ${g.name}. Une régénération est nécessaire pour le placer.`, hasPlanning ? "warn" : "good");
                  }}
                >
                  <I.plus className="h-4 w-4" />
                </Btn>
              </div>
            </Card>
          );
        })}
      </div>
      {(sel || creating) && (
        <GroupModal
          group={sel}
          onClose={() => {
            setSel(null);
            setCreating(false);
          }}
          onSave={async (g) => {
            await saveGroup(g);
            setSel(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function DelBtn({ onDelete }: { onDelete: () => void }) {
  const [c, setC] = useState(false);
  return (
    <Btn size="sm" variant={c ? "danger" : "ghost"} className={c ? "" : "!text-danger-700"} onClick={() => (c ? onDelete() : setC(true))} title="Supprimer">
      <I.trash className="h-3.5 w-3.5" /> {c ? "?" : ""}
    </Btn>
  );
}

function GroupModal({ group, onClose, onSave }: { group: Group | null; onClose: () => void; onSave: (g: Group) => Promise<void> }) {
  const [f, setF] = useState<Group>(
    group ?? { id: 0, name: "", level: "CAP", year: 1, specialty: "", studentCount: 20 }
  );
  return (
    <Modal
      title={group ? `Modifier ${group.name}` : "Nouveau groupe"}
      sub="Niveau (CAP / BTP / BTS), année, spécialité et effectif — la capacité des salles en tient compte."
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" size="sm" onClick={onClose}>Annuler</Btn>
          <Btn
            size="sm"
            onClick={async () => {
              if (!f.name.trim()) return;
              await onSave(f);
            }}
          >
            <I.check className="h-4 w-4" /> Enregistrer
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Nom du groupe"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : BTS Réception 2A" /></Field>
        </div>
        <Field label="Niveau">
          <Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value, year: e.target.value === "CAP" ? Math.min(3, Math.max(1, f.year)) : 1 })}>
            <option>CAP</option>
            <option>BTP</option>
            <option>BTS</option>
          </Select>
        </Field>
        <Field label="Année">
          <NumInput min={1} max={3} value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) || 1 })} />
        </Field>
        <Field label="Spécialité"><Input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="Hôtellerie, Cuisine, Réception…" /></Field>
        <Field label="Nombre d'apprenants"><NumInput min={0} value={f.studentCount} onChange={(e) => setF({ ...f, studentCount: Number(e.target.value) || 0 })} /></Field>
      </div>
    </Modal>
  );
}

/* ------------------------------ Matières ------------------------------ */

function SubjectsTab() {
  const { db, refresh, toast, author } = useApp();
  const [sel, setSel] = useState<Subject | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <Card
        title="Matières / compétences"
        sub="type de séance (COURS / TP), catégorie et clé de compétence (liée aux formateurs)"
        actions={
          <Btn size="sm" onClick={() => setCreating(true)}>
            <I.plus className="h-4 w-4" /> Ajouter une matière
          </Btn>
        }
        pad={false}
      >
        <div className="nice-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line bg-linesoft/50 text-left text-[11px] font-bold uppercase tracking-wide text-inksoft">
                <th className="px-4 py-2.5">Matière</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Catégorie</th>
                <th className="px-4 py-2.5">Clé de compétence</th>
                <th className="px-4 py-2.5 text-center">Formateurs qualifiés</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {db!.subjects.map((s) => {
                const qual = db!.instructors.filter((i) => i.active && i.competences.includes(s.competenceKey));
                return (
                  <tr key={s.id} className="border-b border-linesoft hover:bg-petrol-50/60">
                    <td className="px-4 py-2.5 font-semibold">{s.name}</td>
                    <td className="px-4 py-2.5"><Badge tone={s.kind === "TP" ? "brass" : "petrol"}>{s.kind}</Badge></td>
                    <td className="px-4 py-2.5 text-inksoft">{CATEGORY_LABELS[s.category]}</td>
                    <td className="px-4 py-2.5"><Badge>{s.competenceKey}</Badge></td>
                    <td className="px-4 py-2.5 text-center">
                      {qual.length ? (
                        <span className="text-[12px] text-inksoft">{qual.map((q) => q.firstName).join(", ")}</span>
                      ) : (
                        <Badge tone="danger">aucun</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Btn size="sm" variant="ghost" onClick={() => setSel(s)}><I.edit className="h-3.5 w-3.5" /></Btn>
                        <DelBtn
                          onDelete={async () => {
                            await api(`/api/resource/subjects/${s.id}`, "DELETE", { author });
                            await refresh();
                            toast("Matière supprimée (volumes et séances associés retirés).", "warn");
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {(sel || creating) && (
        <Modal
          title={sel ? `Modifier ${sel.name}` : "Nouvelle matière"}
          onClose={() => {
            setSel(null);
            setCreating(false);
          }}
          footer={
            <>
              <Btn variant="ghost" size="sm" onClick={() => { setSel(null); setCreating(false); }}>Annuler</Btn>
              <Btn
                size="sm"
                onClick={async () => {
                  if (!sel?.name?.trim()) return;
                  if (sel.id) await api(`/api/resource/subjects/${sel.id}`, "PUT", { ...sel, author });
                  else await api("/api/resource/subjects", "POST", { ...sel, author });
                  await refresh();
                  setSel(null);
                  setCreating(false);
                }}
              >
                <I.check className="h-4 w-4" /> Enregistrer
              </Btn>
            </>
          }
        >
          {sel && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Nom"><Input value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} /></Field>
              </div>
              <Field label="Type de séance">
                <Select value={sel.kind} onChange={(e) => setSel({ ...sel, kind: e.target.value as Subject["kind"] })}>
                  <option>COURS</option>
                  <option>TP</option>
                </Select>
              </Field>
              <Field label="Catégorie">
                <Select value={sel.category} onChange={(e) => setSel({ ...sel, category: e.target.value as Subject["category"] })}>
                  <option value="generale">Compétence générale</option>
                  <option value="particuliere">Compétence particulière</option>
                  <option value="enseignement">Enseignement</option>
                </Select>
              </Field>
              <div className="col-span-2">
                <Field label="Clé de compétence" hint="doit correspondre à une compétence d'au moins un formateur">
                  <Input value={sel.competenceKey} onChange={(e) => setSel({ ...sel, competenceKey: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------ Salles ------------------------------ */

function RoomsTab({ withSimulation, slots }: { withSimulation: DataViewWithSim; slots: number }) {
  const { db, refresh, toast, author } = useApp();
  const [sel, setSel] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);

  const save = async (r: Room) => {
    const isNew = !r.id;
    await withSimulation(
      { rooms: isNew ? [...db!.rooms, { ...r, id: -1 } as Room] : db!.rooms.map((x) => (x.id === r.id ? r : x)) },
      isNew ? `ajout de la salle ${r.name}` : `modification de la salle ${r.name}`,
      async () => {
        if (isNew) await api("/api/resource/rooms", "POST", { ...r, author });
        else await api(`/api/resource/rooms/${r.id}`, "PUT", { ...r, author });
        await refresh();
      }
    );
    setSel(null);
    setCreating(false);
  };

  const del = async (r: Room) => {
    await withSimulation({ rooms: db!.rooms.filter((x) => x.id !== r.id) }, `retrait de la salle ${r.name}`, async () => {
      await api(`/api/resource/rooms/${r.id}`, "DELETE", { author });
      await refresh();
      toast(`Salle « ${r.name} » supprimée (ses séances sont retirées du planning).`, "warn");
    });
  };

  return (
    <div className="space-y-3">
      <Card
        title="Salles & ateliers"
        sub="un TP exige un atelier ou un espace pédagogique compatible ; la capacité doit accueillir le groupe"
        actions={
          <Btn size="sm" onClick={() => setCreating(true)}>
            <I.plus className="h-4 w-4" /> Ajouter une salle
          </Btn>
        }
        pad={false}
      >
        <div className="nice-scroll overflow-x-auto">
          <table className="w-full min-w-[680px] text-[13px]">
            <thead>
              <tr className="border-b border-line bg-linesoft/50 text-left text-[11px] font-bold uppercase tracking-wide text-inksoft">
                <th className="px-4 py-2.5">Salle</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-center">Capacité</th>
                <th className="px-4 py-2.5">Séances autorisées</th>
                <th className="px-4 py-2.5">Indisponibilités</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...db!.rooms]
                .sort((a, b) => {
                  const idxA = OFFICIAL_ROOM_NAMES.indexOf(a.name);
                  const idxB = OFFICIAL_ROOM_NAMES.indexOf(b.name);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return a.id - b.id;
                })
                .map((r) => (
                <tr key={r.id} className="border-b border-linesoft hover:bg-petrol-50/60">
                  <td className="px-4 py-2.5 font-semibold">{r.name}</td>
                  <td className="px-4 py-2.5 text-inksoft">{ROOM_KIND_LABELS[r.kind]}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{r.capacity}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {r.allowedKinds.map((k) => (
                        <Badge key={k} tone={k === "TP" ? "brass" : "petrol"}>{k}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-inksoft">
                    {r.blocked.length
                      ? r.blocked.map((b) => `${DAYS_FR[b.day].slice(0, 3)} : ${b.slots.map((s) => slotTime(db!.settings.boundaries, s)).join(", ")}`).join(" · ")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => setSel(r)}><I.edit className="h-3.5 w-3.5" /></Btn>
                      <DelBtn onDelete={() => del(r)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {(sel || creating) && (
        <RoomModal
          room={sel}
          onClose={() => {
            setSel(null);
            setCreating(false);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function RoomModal({ room, onClose, onSave }: { room: Room | null; onClose: () => void; onSave: (r: Room) => Promise<void> }) {
  const [f, setF] = useState<Room>(
    room ?? { id: 0, name: "", kind: "normale", capacity: 25, allowedKinds: ["COURS"], blocked: [] }
  );
  return (
    <Modal
      wide
      title={room ? `Modifier ${room.name}` : "Nouvelle salle"}
      sub="Le type de séance autorisé et la capacité sont des contraintes obligatoires du générateur."
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" size="sm" onClick={onClose}>Annuler</Btn>
          <Btn size="sm" onClick={() => (f.name.trim() ? onSave(f) : undefined)}>
            <I.check className="h-4 w-4" /> Enregistrer
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <Field label="Nom"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : Atelier cuisine 3" /></Field>
        </div>
        <Field label="Type">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Room["kind"] })}>
            <option value="normale">Salle normale</option>
            <option value="atelier">Atelier</option>
            <option value="pedagogique">Espace pédagogique</option>
          </Select>
        </Field>
        <Field label="Capacité"><NumInput min={0} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) || 0 })} /></Field>
        <div className="col-span-2">
          <Field label="Types de séances autorisées">
            <div className="flex gap-2">
              {(["COURS", "TP"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setF({
                      ...f,
                      allowedKinds: f.allowedKinds.includes(k) ? f.allowedKinds.filter((x) => x !== k) : [...f.allowedKinds, k],
                    })
                  }
                  className={`rounded-md border px-3 py-1.5 text-[12px] font-bold ${
                    f.allowedKinds.includes(k) ? "border-petrol-700 bg-petrol-100 text-petrol-900" : "border-line bg-card text-inksoft"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>
      <div className="mt-4">
        <SlotGrid title="Indisponibilités de la salle" value={f.blocked} onChange={(v) => setF({ ...f, blocked: v })} slots={buildSlots(useAppDbBoundaries()).length} tone="danger" />
      </div>
    </Modal>
  );
}

/* ------------------------------ Calendrier ------------------------------ */

function CalendarTab() {
  const { db, refresh, toast, author } = useApp();
  const [f, setF] = useState(() => ({ ...db!.settings, boundaries: [...db!.settings.boundaries], holidays: [...db!.settings.holidays] }));
  const [newHoli, setNewHoli] = useState({ date: "", label: "" });

  const days = workingDaysBetween(f.startDate, f.endDate, f.holidays.map((h) => h.date));

  const save = async () => {
    try {
      await api("/api/settings", "PUT", { ...f, author });
      await refresh();
      toast("Calendrier et période mis à jour. Une régénération est nécessaire pour appliquer ces changements au planning.", "good");
    } catch (e) {
      toast((e as Error).message, "danger");
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="Période de planification" sub="semestre, trimestre ou période partielle (rattrapage, remplacement temporaire)">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Nom de la période"><Input value={f.periodName} onChange={(e) => setF({ ...f, periodName: e.target.value })} /></Field>
          </div>
          <Field label="Date de début">
            <Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </Field>
          <Field label="Date de fin">
            <Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 rounded-lg border border-line bg-petrol-50/60 p-3 text-[13px]">
          <p><b>{days}</b> jours ouvrables · <b>{f.boundaries.length - 1}</b> créneaux de {(f.boundaries[1] ? (parseInt(f.boundaries[1].slice(0, 2)) * 60 + parseInt(f.boundaries[1].slice(3)) - parseInt(f.boundaries[0].slice(0, 2)) * 60 - parseInt(f.boundaries[0].slice(3))) / 60 : 2)}h par jour</p>
          <p className="mt-1 text-xs text-inksoft">Les week-ends et les jours fériés listés ci-contre sont exclus automatiquement de la génération.</p>
        </div>
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-inksoft">Jours de formation</p>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  setF({
                    ...f,
                    enabledDays: f.enabledDays.includes(d) ? f.enabledDays.filter((x) => x !== d) : [...f.enabledDays, d].sort(),
                  })
                }
                className={`rounded-md border px-3 py-1.5 text-[12px] font-bold ${
                  f.enabledDays.includes(d) ? "border-petrol-700 bg-petrol-100 text-petrol-900" : "border-line bg-card text-inkfaint"
                }`}
              >
                {DAYS_FR[d].slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Grille horaire & durées pédagogiques" sub="créneaux élémentaires (2h) et durées de séance autorisées (bloc continu pour 4h/6h)">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-inksoft">Bornes horaires (HH:MM)</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {f.boundaries.map((b, i) => (
            <React.Fragment key={i}>
              <Input
                type="time"
                value={b}
                className="!w-28 !py-1.5 text-xs tabular-nums"
                onChange={(e) => {
                  const arr = [...f.boundaries];
                  arr[i] = e.target.value;
                  setF({ ...f, boundaries: arr });
                }}
              />
              {i < f.boundaries.length - 1 && (
                <button
                  type="button"
                  className="text-inkfaint hover:text-danger-600"
                  title="Retirer cette borne"
                  onClick={() => setF({ ...f, boundaries: f.boundaries.filter((_, j) => j !== i) })}
                >
                  <I.x className="h-3.5 w-3.5" />
                </button>
              )}
              {i < f.boundaries.length - 1 && <span className="text-inkfaint">→</span>}
            </React.Fragment>
          ))}
          <Btn size="sm" variant="ghost" onClick={() => setF({ ...f, boundaries: [...f.boundaries, "19:30"] })}>
            <I.plus className="h-4 w-4" />
          </Btn>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-inksoft">Cours théorique</p>
            <div className="flex gap-1.5">
              {[2, 4, 6].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setF({
                      ...f,
                      coursDurations: f.coursDurations.includes(d) ? f.coursDurations.filter((x) => x !== d) : [...f.coursDurations, d].sort(),
                    })
                  }
                  className={`rounded-md border px-3 py-1.5 text-[12px] font-bold ${
                    f.coursDurations.includes(d) ? "border-petrol-700 bg-petrol-100 text-petrol-900" : "border-line bg-card text-inkfaint"
                  }`}
                >
                  {d}h
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-inksoft">TP / atelier</p>
            <div className="flex gap-1.5">
              {[2, 4, 6].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setF({
                      ...f,
                      tpDurations: f.tpDurations.includes(d) ? f.tpDurations.filter((x) => x !== d) : [...f.tpDurations, d].sort(),
                    })
                  }
                  className={`rounded-md border px-3 py-1.5 text-[12px] font-bold ${
                    f.tpDurations.includes(d) ? "border-brass-600 bg-brass-100 text-brass-700" : "border-line bg-card text-inkfaint"
                  }`}
                >
                  {d}h
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Jours fériés & vacances (calendrier tunisien)" sub="exclus automatiquement de la génération" className="lg:col-span-2">
        <ul className="mb-3 divide-y divide-linesoft">
          {f.holidays.map((h, i) => (
            <li key={i} className="flex items-center justify-between py-1.5 text-[13px]">
              <span className="font-semibold tabular-nums">{h.date}</span>
              <span className="text-inksoft">{h.label}</span>
              <Btn size="sm" variant="ghost" className="!text-danger-700 !px-1.5" onClick={() => setF({ ...f, holidays: f.holidays.filter((_, j) => j !== i) })}>
                <I.trash className="h-3.5 w-3.5" />
              </Btn>
            </li>
          ))}
          {!f.holidays.length && <li className="py-2 text-sm text-inkfaint">Aucun jour férié enregistré.</li>}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Date">
            <Input type="date" value={newHoli.date} onChange={(e) => setNewHoli({ ...newHoli, date: e.target.value })} className="!w-40" />
          </Field>
          <Field label="Intitulé">
            <Input placeholder="Ex. : Aïd El Fitr, vacances d'hiver…" value={newHoli.label} onChange={(e) => setNewHoli({ ...newHoli, label: e.target.value })} className="!w-64" />
          </Field>
          <Btn
            size="sm"
            variant="ghost"
            disabled={!newHoli.date}
            onClick={() => {
              setF({ ...f, holidays: [...f.holidays, newHoli].sort((a, b) => a.date.localeCompare(b.date)) });
              setNewHoli({ date: "", label: "" });
            }}
          >
            <I.plus className="h-4 w-4" /> Ajouter
          </Btn>
        </div>
        <div className="mt-4 flex justify-end">
          <Btn onClick={save}>
            <I.save className="h-4 w-4" /> Enregistrer le calendrier
          </Btn>
        </div>
      </Card>
    </div>
  );
}
