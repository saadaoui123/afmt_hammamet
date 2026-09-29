"use client";
import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppShell";
import { Badge, Btn, EmptyState, Field, I, Input, Modal, ScoreRing, SegTabs, Select } from "@/components/ui";
import { buildSlots, DAYS_FR, toHHMM, type SlotInfo } from "@/lib/time";
import { ctxFor, findConflicts, volumeGaps, windowInterval } from "@/lib/conflicts";
import type { Assignment, Group, Instructor, Room } from "@/lib/types";
import { groupColor, levelYearLabel, ROOM_KIND_LABELS } from "@/lib/format";
import { exportExcel, printPDF, type Sheet } from "@/lib/export";
import { api } from "@/lib/api";
import { OFFICIAL_ROOM_NAMES } from "@/lib/seed-data";

export type Tab = "principal" | "formateur" | "salle" | "groupe";
type DisplayMode = "capture_client" | "tableau_liste" | "fiche_individuelle";
type RoomCategoryFilter = "all" | "cours" | "info" | "cuisine" | "service" | "hebergement";

export const OFFICIAL_ROOM_ORDER = OFFICIAL_ROOM_NAMES;

export function shortGroup(name: string): string {
  const m = name.match(/^(CAP|BTP|BTS)\s+([A-Za-zÀ-ÿ]+)\s+(\d)A?$/i);
  if (m) {
    return `${m[1]} ${m[2].slice(0, 4)} ${m[3]}A`;
  }
  return name.length > 11 ? name.slice(0, 10) + "." : name;
}

export function shortInstructor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
  }
  return name;
}

export function shortSubject(name: string): string {
  const map: Record<string, string> = {
    "Cuisine hôtelière": "Cuisine",
    "Aménagement de plateaux": "Plateaux",
    "Réception hôtelière": "Réception",
    "Cuisine internationale": "Cuis. Int.",
    "Comptabilité hôtelière": "Compta",
    "Gestion des stocks": "Stocks",
    "Français professionnel": "Français",
    "Anglais hôtelier": "Anglais",
    "Droit du tourisme": "Droit",
    "Géographie du tourisme": "Géo",
    "Management hôtelier": "Management",
    "Techniques de communication": "Comm.",
  };
  return map[name] || name.split(" ")[0] || name;
}

export default function PlanningView() {
  const { db, active, toast, setView, refresh } = useApp();
  const [tab, setTab] = useState<Tab>("principal");
  const [mode, setMode] = useState<DisplayMode>("capture_client");
  const [roomCat, setRoomCat] = useState<RoomCategoryFilter>("all");
  const [selectedIndividualId, setSelectedIndividualId] = useState<number | "all">("all");
  const [highlightGroup, setHighlightGroup] = useState<number | "all">("all");
  const [highlightInstructor, setHighlightInstructor] = useState<number | "all">("all");
  const [compactMode, setCompactMode] = useState<boolean>(true);
  const [filterF, setFilterF] = useState<string>("all");
  const [filterR, setFilterR] = useState<string>("all");
  const [filterG, setFilterG] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<Assignment | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingCoords, setCreatingCoords] = useState<{ day?: number; slot?: number; roomId?: number } | null>(null);

  // Seuil statutaire global par défaut (ex: 18h)
  const [statutoryBaseOverride, setStatutoryBaseOverride] = useState<number | null>(null);

  if (!db) return null;
  const slots = buildSlots(db.settings.boundaries);
  const version = db.versions.find((v) => v.id === db.settings.activeVersionId);
  const conflicts = useMemo(() => findConflicts(active, ctxFor(db)), [db, active]);
  const volume = useMemo(() => volumeGaps(active, db), [db, active]);

  // Salles triées selon la feuille originale du client
  const sortedRooms = useMemo(() => {
    return [...db.rooms].sort((a, b) => {
      const idxA = OFFICIAL_ROOM_ORDER.indexOf(a.name);
      const idxB = OFFICIAL_ROOM_ORDER.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.id - b.id;
    });
  }, [db.rooms]);

  // Filtrage des salles selon la catégorie sélectionnée
  const filteredRooms = useMemo(() => {
    if (roomCat === "all") return sortedRooms;
    if (roomCat === "cours") return sortedRooms.filter((r) => /^S\d+$/.test(r.name));
    if (roomCat === "info")
      return sortedRooms.filter(
        (r) =>
          r.name.includes("INFO") ||
          r.name.includes("AMEDEUS") ||
          r.name.includes("3 S") ||
          (r.name.includes("JK") && !r.name.includes("DORTOIR"))
      );
    if (roomCat === "cuisine")
      return sortedRooms.filter((r) => r.name.includes("CUISINE") || r.name.includes("PAT"));
    if (roomCat === "service")
      return sortedRooms.filter(
        (r) => r.name.includes("RESTAU") || r.name.includes("BAR") || r.name.includes("RECEPTION")
      );
    if (roomCat === "hebergement")
      return sortedRooms.filter((r) => r.name.includes("DORTOIR") || r.name.includes("BUANDERIE"));
    return sortedRooms;
  }, [sortedRooms, roomCat]);

  // Dictionnaire des noms
  const name = {
    f: (id: number) => {
      const i = db.instructors.find((x) => x.id === id);
      return i ? `${i.firstName} ${i.lastName}` : "—";
    },
    g: (id: number) => db.groups.find((x) => x.id === id)?.name ?? "—",
    s: (id: number) => db.subjects.find((x) => x.id === id)?.name ?? "—",
    r: (id: number) => db.rooms.find((x) => x.id === id)?.name ?? "—",
  };

  const timeLabel = (a: Assignment) => {
    const w = windowInterval(slots, a.startSlot, a.hours);
    return w ? `${toHHMM(w.startMin)} – ${toHHMM(w.endMin)}` : `Créneau ${a.startSlot + 1}`;
  };

  // Calcul automatique du nombre d'heures supplémentaires
  const instructorHoursStats = useMemo(() => {
    const stats = new Map<
      number,
      { assigned: number; statutory: number; overtime: number; instructor: Instructor }
    >();

    for (const inst of db.instructors) {
      const assigned = active
        .filter((a) => a.instructorId === inst.id)
        .reduce((sum, a) => sum + a.hours, 0);
      const statutory = statutoryBaseOverride !== null ? statutoryBaseOverride : inst.maxHoursPerWeek;
      const overtime = Math.max(0, assigned - statutory);
      stats.set(inst.id, { assigned, statutory, overtime, instructor: inst });
    }
    return stats;
  }, [db.instructors, active, statutoryBaseOverride]);

  const totalOvertimeAll = useMemo(() => {
    let tot = 0;
    for (const stat of instructorHoursStats.values()) {
      tot += stat.overtime;
    }
    return tot;
  }, [instructorHoursStats]);

  // Filtre général
  const matches = (a: Assignment) => {
    if (tab === "formateur" && filterF !== "all" && a.instructorId !== Number(filterF)) return false;
    if (tab === "salle" && filterR !== "all" && a.roomId !== Number(filterR)) return false;
    if (tab === "groupe" && filterG !== "all" && a.groupId !== Number(filterG)) return false;
    if (tab === "principal") {
      if (filterF !== "all" && a.instructorId !== Number(filterF)) return false;
      if (filterG !== "all" && a.groupId !== Number(filterG)) return false;
      if (filterR !== "all" && a.roomId !== Number(filterR)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = `${DAYS_FR[a.day]} ${name.f(a.instructorId)} ${name.g(a.groupId)} ${name.s(
        a.subjectId
      )} ${name.r(a.roomId)} ${a.kind}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const filtered = active.filter(matches);

  // -------------------------------------------------------------
  // EXPORT EXCEL OFFICIEL SELON LA STRUCTURE EXACTE DES CAPTURES
  // -------------------------------------------------------------
  const onExport = () => {
    const recapRows: Array<Array<string | number>> = [];
    recapRows.push(["TABLEAU RECAP FORMATION — INSTITUT DE FORMATION DANS LES MÉTIERS DU TOURISME (IFMT) HAMMAMET"]);
    recapRows.push([
      `PÉRIODE : ${db.settings.periodName} | Direction des Études : Ines Khrifech | Tutelle : AFMT / Ministère du Tourisme`,
    ]);

    // En-têtes : Colonnes Salles avec 3 sous-lignes GR | F | COMP
    // ou En-têtes Jours x Horaires
    const headerDayRow: string[] = ["SALLES / ESPACES", "INDICATEUR"];
    const headerSlotRow: string[] = ["", ""];
    const recapMerges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 + db.settings.enabledDays.length * slots.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 + db.settings.enabledDays.length * slots.length - 1 } },
    ];

    let colCursor = 2;
    db.settings.enabledDays.forEach((d) => {
      const dayStartCol = colCursor;
      slots.forEach((sl) => {
        headerDayRow.push(DAYS_FR[d]);
        headerSlotRow.push(`${toHHMM(sl.startMin)}--${toHHMM(sl.endMin)}`);
        colCursor++;
      });
      const dayEndCol = colCursor - 1;
      recapMerges.push({
        s: { r: 2, c: dayStartCol },
        e: { r: 2, c: dayEndCol },
      });
    });
    recapRows.push(headerDayRow);
    recapRows.push(headerSlotRow);

    // Lignes par Salle (3 sous-lignes GR, F, COMP par salle)
    let curRowIdx = 4;
    sortedRooms.forEach((r) => {
      const startR = curRowIdx;
      const grRow: string[] = [r.name, "GR"];
      const fRow: string[] = [r.name, "F"];
      const compRow: string[] = [r.name, "COMP"];

      db.settings.enabledDays.forEach((d) => {
        slots.forEach((sl, slotIdx) => {
          const a = active.find(
            (x) =>
              x.roomId === r.id &&
              x.day === d &&
              x.startSlot <= slotIdx &&
              x.startSlot + Math.max(1, Math.round(x.hours / 2)) > slotIdx
          );
          if (a) {
            grRow.push(shortGroup(name.g(a.groupId)));
            fRow.push(shortInstructor(name.f(a.instructorId)));
            compRow.push(shortSubject(name.s(a.subjectId)));
          } else {
            grRow.push("");
            fRow.push("");
            compRow.push("");
          }
        });
      });

      recapRows.push(grRow);
      recapRows.push(fRow);
      recapRows.push(compRow);
      recapMerges.push({ s: { r: startR, c: 0 }, e: { r: startR + 2, c: 0 } });
      curRowIdx += 3;
    });

    // 2. Feuille Tableau 1 : Formateur
    const formateurRows = active
      .slice()
      .sort((a, b) => a.instructorId - b.instructorId || a.day - b.day || a.startSlot - b.startSlot)
      .map((a) => {
        const stat = instructorHoursStats.get(a.instructorId);
        const overtime = stat ? stat.overtime : 0;
        return [
          name.f(a.instructorId),
          DAYS_FR[a.day],
          timeLabel(a),
          name.g(a.groupId),
          name.s(a.subjectId),
          name.r(a.roomId),
          overtime > 0 ? `${overtime} h` : "0 h",
        ];
      });

    // 3. Feuille Tableau 2 : Salle
    const salleRows = active
      .slice()
      .sort((a, b) => a.roomId - b.roomId || a.day - b.day || a.startSlot - b.startSlot)
      .map((a) => [
        name.r(a.roomId),
        DAYS_FR[a.day],
        timeLabel(a),
        name.g(a.groupId),
        levelYearLabel(
          db.groups.find((g) => g.id === a.groupId)?.level ?? "CAP",
          db.groups.find((g) => g.id === a.groupId)?.year ?? 1
        ),
        name.f(a.instructorId),
        name.s(a.subjectId),
        a.kind,
      ]);

    // 4. Feuille Tableau 3 : Groupe
    const groupeRows = active
      .slice()
      .sort((a, b) => a.groupId - b.groupId || a.day - b.day || a.startSlot - b.startSlot)
      .map((a) => {
        const g = db.groups.find((x) => x.id === a.groupId);
        return [
          name.g(a.groupId),
          DAYS_FR[a.day],
          timeLabel(a),
          levelYearLabel(g?.level ?? "CAP", g?.year ?? 1),
          g?.specialty ?? "—",
          name.s(a.subjectId),
          a.kind,
          name.f(a.instructorId),
          name.r(a.roomId),
        ];
      });

    // 5. Feuille Bilan Heures Supp
    const overtimeSummaryRows = db.instructors.map((i) => {
      const st = instructorHoursStats.get(i.id);
      return [
        `${i.firstName} ${i.lastName}`,
        i.specialty || "Général",
        st ? st.statutory : i.maxHoursPerWeek,
        st ? st.assigned : 0,
        st ? st.overtime : 0,
      ];
    });

    const sheets: Sheet[] = [
      {
        name: "Tableau Recap (Capture)",
        rows: recapRows,
        merges: recapMerges,
      },
      {
        name: "Tableau 1 - Formateur",
        rows: [
          [
            "Formateur",
            "Jour",
            "Horaire",
            "Groupe",
            "Matière",
            "Salle",
            "Nombre d'heures supplémentaires",
          ],
          ...formateurRows,
        ],
      },
      {
        name: "Tableau 2 - Salle",
        rows: [
          ["Salle", "Jour", "Horaire", "Groupe", "Niveau", "Formateur", "Matière", "Type"],
          ...salleRows,
        ],
      },
      {
        name: "Tableau 3 - Groupe",
        rows: [
          ["Groupe", "Jour", "Horaire", "Niveau", "Spécialité", "Matière", "Type", "Formateur", "Salle"],
          ...groupeRows,
        ],
      },
      {
        name: "Bilan Heures Supp",
        rows: [
          ["Formateur", "Spécialité", "Quota Statutaire (h)", "Heures Assurées (h)", "Heures Supplémentaires (h)"],
          ...overtimeSummaryRows,
        ],
      },
    ];

    exportExcel(sheets, `IFMT-Planning-Officiel-${version?.label.replace(/\s+/g, "-") ?? "export"}.xlsx`);
    toast("Export Excel officiel (Tableau Récap + 3 Vues Dérivées) généré avec succès.", "good");
  };

  const openSlotForAdd = (day: number, slotIdx: number, roomId: number) => {
    setCreatingCoords({ day, slot: slotIdx, roomId });
    setCreating(true);
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* En-tête officiel imprimable                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden print:flex flex-col border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo-afmt.png"
              alt="Logo AFMT"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="text-[10px] leading-tight text-slate-800">
              <p className="font-bold uppercase tracking-wider">الجمهورية التونسية · وزارة السياحة</p>
              <p className="font-extrabold text-xs">Agence de Formation dans les Métiers du Tourisme (AFMT)</p>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">
              TABLEAU RECAP FORMATION — IFMT HAMMAMET
            </h1>
            <p className="text-xs font-semibold text-slate-700">
              PERIODE : {db.settings.periodName} · Année 2025/2026
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-[10px] leading-tight text-slate-800">
              <p className="font-bold uppercase tracking-wider">معهد التكوين في مهن السياحة بالحمامات</p>
              <p className="font-extrabold text-xs">Institut de Formation dans les Métiers du Tourisme</p>
              <p className="font-semibold text-teal-900">IFMT — Hammamet</p>
            </div>
            <img
              src="/images/logo-ifmt.png"
              alt="Logo IFMT Hammamet"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-600 mt-2 pt-1 border-t border-slate-300">
          <span>Direction des Études : <b>Ines Khrifech</b></span>
          <span>Source unique de vérité : <b>Planning Central IFMT</b></span>
          <span>Règles spéciales : Pause 12h-14h & Soirée 18h-20h (TP Cuisine, Pâtisserie, Restaurant uniquement)</span>
          <span>Édité le {new Date().toLocaleDateString("fr-FR")}</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* En-tête écran avec titre et actions                            */}
      {/* ------------------------------------------------------------- */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-900 bg-teal-100 border border-teal-300 px-2 py-0.5 rounded">
              Structure Originale de la Capture Client
            </span>
            <span className="text-xs text-inksoft">
              Directrice des Études : <b>Ines Khrifech</b>
            </span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink tracking-tight">
            Planning Pédagogique Central
          </h1>
          <p className="text-xs text-inksoft">
            {db.settings.periodName} · {version ? version.label : "Aucune version active"} ·{" "}
            <span className="tabular-nums font-bold text-petrol-800">{active.length} séances</span> (
            {active.reduce((s, a) => s + a.hours, 0)}h programmées sur les 25 salles)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {version && (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-1.5 shadow-sm">
              <ScoreRing score={version.score} size={42} />
              <div className="pr-1 text-left">
                <p className="text-[10px] font-bold uppercase text-inksoft leading-none">Score</p>
                <p className="text-xs font-extrabold text-petrol-900 leading-tight">Qualité</p>
                <p className="text-[9px] text-inkfaint">0 conflit dur</p>
              </div>
            </div>
          )}

          <Btn
            variant="ghost"
            size="sm"
            onClick={onExport}
            title="Exporter la feuille exacte du client et les 3 tableaux au format Excel (.xlsx)"
          >
            <I.download className="h-4 w-4 text-emerald-700" /> Excel (Tableau Récap + 3 Vues)
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => printPDF()}
            title="Imprimer directement le document officiel en mode paysage"
          >
            <I.print className="h-4 w-4 text-petrol-800" /> Imprimer / PDF
          </Btn>
          <Btn
            size="sm"
            onClick={() => {
              setCreatingCoords(null);
              setCreating(true);
            }}
            disabled={!version}
          >
            <I.plus className="h-4 w-4" /> Ajouter une séance
          </Btn>
        </div>
      </div>

      {/* Alertes temps réel */}
      {conflicts.length > 0 && (
        <div className="no-print rounded-xl border border-danger-600 bg-danger-50 p-3.5 text-sm text-danger-700 shadow-sm">
          <p className="flex items-center gap-2 font-bold">
            <I.alert className="h-4 w-4 shrink-0" /> {conflicts.length} conflit(s) détecté(s) en temps réel
          </p>
          <ul className="ml-6 mt-1 list-disc text-xs space-y-0.5">
            {conflicts.slice(0, 4).map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
        </div>
      )}

      {volume.length > 0 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn-600 bg-warn-50 px-4 py-2.5 text-sm text-warn-800 shadow-sm">
          <p className="flex items-center gap-2 font-bold text-xs">
            <I.alert className="h-4 w-4 text-warn-700 shrink-0" />
            Volume horaire non atteint : {volume.reduce((s, v) => s + v.missing, 0)}h restantes sur {volume.length} enseignement(s)
          </p>
          <Btn size="sm" variant="brass" onClick={() => setView("generate")}>
            <I.wand className="h-3.5 w-3.5" /> Régénérer le planning
          </Btn>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. LES TROIS VUES ÉQUIVALENTES DU MÊME PLANNING CENTRAL       */}
      {/* ------------------------------------------------------------- */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <SegTabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            {
              id: "principal",
              label: "Tableau Récap (Capture Client)",
              icon: <I.grid className="h-4 w-4 text-petrol-700" />,
            },
            {
              id: "formateur",
              label: "Tableau 1 : Formateur (Heures Supp.)",
              icon: <I.user className="h-4 w-4 text-amber-700" />,
            },
            {
              id: "salle",
              label: "Tableau 2 : Salle",
              icon: <I.room className="h-4 w-4 text-sky-700" />,
            },
            {
              id: "groupe",
              label: "Tableau 3 : Groupe",
              icon: <I.users className="h-4 w-4 text-emerald-700" />,
            },
          ]}
        />

        {/* Sélecteur de mode d'affichage interchangeable */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Rechercher (cours, formateur, salle...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52 !py-1.5 text-xs"
          />

          <div className="flex items-center gap-1 bg-linesoft/60 p-0.5 rounded-lg border border-line text-xs">
            <button
              type="button"
              onClick={() => setMode("capture_client")}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                mode === "capture_client" ? "bg-petrol-900 text-white shadow-sm" : "text-inksoft hover:text-ink"
              }`}
              title="Structure exacte de la capture : Entités en lignes avec 3 sous-lignes x Jours & Horaires en colonnes"
            >
              Format Capture
            </button>
            <button
              type="button"
              onClick={() => setMode("tableau_liste")}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                mode === "tableau_liste" ? "bg-petrol-900 text-white shadow-sm" : "text-inksoft hover:text-ink"
              }`}
              title="Tableau liste détaillé"
            >
              Liste Détaillée
            </button>
            <button
              type="button"
              onClick={() => setMode("fiche_individuelle")}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                mode === "fiche_individuelle" ? "bg-petrol-900 text-white shadow-sm" : "text-inksoft hover:text-ink"
              }`}
              title="Fiche individuelle par entité"
            >
              Fiche Solo
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BANNIÈRE RÈGLES SPÉCIALES DES HORAIRES (12H-14H & 18H-20H)    */}
      {/* ------------------------------------------------------------- */}
      <div className="no-print rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-md bg-amber-200 text-amber-900 font-bold">
            <I.clock className="h-4 w-4" />
          </span>
          <div>
            <p className="font-bold text-amber-950 text-xs">
              Règles Spéciales d'Horaires Actives :
            </p>
            <p className="text-amber-900/90 text-[11px]">
              1. <b>Pause 12h–14h</b> obligatoire pour tous sauf <b>TP Cuisine, Pâtisserie, Restaurant</b>.
              &nbsp;|&nbsp;
              2. <b>Après 18h00 (18h–20h)</b> réservé exclusivement aux <b>TP Cuisine, Pâtisserie, Restaurant</b>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="brass">12h–14h : TP Restauration/Cuisine Only</Badge>
          <Badge tone="petrol">18h–20h : TP Pratique Only</Badge>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CONTENU PRINCIPAL SELON L'ONGLET ET LE MODE                   */}
      {/* ------------------------------------------------------------- */}
      {!active.length ? (
        <EmptyState
          icon={<I.grid className="h-10 w-10 text-petrol-600" />}
          title="Aucun planning central disponible"
          text="Déclenchez la génération pour construire le planning central dans le format officiel du client."
        >
          <Btn onClick={() => setView("generate")}>
            <I.wand className="h-4 w-4" /> Générer le planning
          </Btn>
        </EmptyState>
      ) : (
        <>
          {/* ONGLET 1 : TABLEAU PRINCIPAL / TABLEAU SALLES */}
          {(tab === "principal" || tab === "salle") && (
            <div className="space-y-4">
              {mode === "capture_client" && (
                <ClientCaptureGrid
                  dimension="salles"
                  entities={filteredRooms}
                  slots={slots}
                  days={db.settings.enabledDays}
                  assignments={filtered}
                  name={name}
                  compactMode={compactMode}
                  highlightGroup={highlightGroup}
                  highlightInstructor={highlightInstructor}
                  onPick={(a) => setSel(a)}
                  onAddAt={(day, slotIdx, roomId) => openSlotForAdd(day, slotIdx, roomId)}
                />
              )}

              {mode === "tableau_liste" && (
                <TableauSalle
                  assignments={filtered}
                  timeLabel={timeLabel}
                  name={name}
                  db={db}
                  onPick={(a) => setSel(a)}
                />
              )}

              {mode === "fiche_individuelle" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-card border border-line rounded-xl px-4 py-2 text-xs">
                    <span className="font-bold text-petrol-900">Salle sélectionnée :</span>
                    <Select
                      value={selectedIndividualId}
                      onChange={(e) =>
                        setSelectedIndividualId(e.target.value === "all" ? "all" : Number(e.target.value))
                      }
                      className="!w-64 !py-1 text-xs font-bold"
                    >
                      <option value="all">Toutes les salles</option>
                      {sortedRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({ROOM_KIND_LABELS[r.kind]} - Capacité: {r.capacity})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <ClientCaptureGrid
                    dimension="salles"
                    entities={
                      selectedIndividualId === "all"
                        ? filteredRooms
                        : sortedRooms.filter((r) => r.id === selectedIndividualId)
                    }
                    slots={slots}
                    days={db.settings.enabledDays}
                    assignments={filtered}
                    name={name}
                    compactMode={compactMode}
                    highlightGroup={highlightGroup}
                    highlightInstructor={highlightInstructor}
                    onPick={(a) => setSel(a)}
                    onAddAt={(day, slotIdx, roomId) => openSlotForAdd(day, slotIdx, roomId)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ONGLET 2 : TABLEAU FORMATEUR (AVEC NOMBRE D'HEURES SUPPLÉMENTAIRES) */}
          {tab === "formateur" && (
            <div className="space-y-4">
              {/* Entête calcul automatique heures supplémentaires */}
              <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-amber-200 text-amber-900 font-bold">
                    <I.user className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-amber-950 uppercase tracking-tight">
                      Tableau 1 : Formateurs — Décompte Automatique des Heures Supplémentaires
                    </h3>
                    <p className="text-amber-900/90 text-xs">
                      Même structure que la capture client + colonne <b>"Nombre d'heures supplémentaires"</b> calculée
                      automatiquement selon le quota statutaire contractuel.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-white border border-amber-300 px-3 py-1.5 rounded-lg shadow-xs text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Total Heures Supp.</p>
                    <p className="font-display font-extrabold text-base text-amber-700 tabular-nums">
                      +{totalOvertimeAll} h
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-amber-300 px-3 py-1.5 rounded-lg shadow-xs">
                    <span className="text-[11px] font-bold text-slate-700">Seuil Statutaire :</span>
                    <Select
                      value={statutoryBaseOverride ?? "default"}
                      onChange={(e) =>
                        setStatutoryBaseOverride(e.target.value === "default" ? null : Number(e.target.value))
                      }
                      className="!w-32 !py-0.5 text-xs font-bold"
                    >
                      <option value="default">Fiche formateur</option>
                      <option value="16">16 h / semaine</option>
                      <option value="18">18 h / semaine</option>
                      <option value="20">20 h / semaine</option>
                    </Select>
                  </div>
                </div>
              </div>

              {mode === "capture_client" && (
                <ClientCaptureGrid
                  dimension="formateurs"
                  entities={db.instructors}
                  slots={slots}
                  days={db.settings.enabledDays}
                  assignments={filtered}
                  name={name}
                  compactMode={compactMode}
                  highlightGroup={highlightGroup}
                  highlightInstructor={highlightInstructor}
                  instructorStats={instructorHoursStats}
                  onPick={(a) => setSel(a)}
                  onAddAt={(day, slotIdx, instId) => openSlotForAdd(day, slotIdx, sortedRooms[0]?.id ?? 1)}
                />
              )}

              {mode === "tableau_liste" && (
                <TableauFormateur
                  assignments={filtered}
                  timeLabel={timeLabel}
                  name={name}
                  instructorStats={instructorHoursStats}
                  onPick={(a) => setSel(a)}
                />
              )}

              {mode === "fiche_individuelle" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-card border border-line rounded-xl px-4 py-2 text-xs">
                    <span className="font-bold text-petrol-900">Formateur sélectionné :</span>
                    <Select
                      value={selectedIndividualId}
                      onChange={(e) =>
                        setSelectedIndividualId(e.target.value === "all" ? "all" : Number(e.target.value))
                      }
                      className="!w-64 !py-1 text-xs font-bold"
                    >
                      <option value="all">Tous les formateurs</option>
                      {db.instructors.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.firstName} {i.lastName} ({i.specialty || "Tourisme"})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <ClientCaptureGrid
                    dimension="formateurs"
                    entities={
                      selectedIndividualId === "all"
                        ? db.instructors
                        : db.instructors.filter((i) => i.id === selectedIndividualId)
                    }
                    slots={slots}
                    days={db.settings.enabledDays}
                    assignments={filtered}
                    name={name}
                    compactMode={compactMode}
                    highlightGroup={highlightGroup}
                    highlightInstructor={highlightInstructor}
                    instructorStats={instructorHoursStats}
                    onPick={(a) => setSel(a)}
                    onAddAt={(day, slotIdx, instId) => openSlotForAdd(day, slotIdx, sortedRooms[0]?.id ?? 1)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ONGLET 3 : TABLEAU GROUPE */}
          {tab === "groupe" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-emerald-200 text-emerald-900 font-bold">
                    <I.users className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-emerald-950 uppercase tracking-tight">
                      Tableau 3 : Groupes — Planning par Niveau Pédagogique (CAP · BTP · BTS)
                    </h3>
                    <p className="text-emerald-900/90 text-xs">
                      Même planning central structuré au format de la capture avec les 3 sous-lignes Formateur, Salle et Compétence.
                    </p>
                  </div>
                </div>
              </div>

              {mode === "capture_client" && (
                <ClientCaptureGrid
                  dimension="groupes"
                  entities={db.groups}
                  slots={slots}
                  days={db.settings.enabledDays}
                  assignments={filtered}
                  name={name}
                  compactMode={compactMode}
                  highlightGroup={highlightGroup}
                  highlightInstructor={highlightInstructor}
                  onPick={(a) => setSel(a)}
                  onAddAt={(day, slotIdx, grpId) => openSlotForAdd(day, slotIdx, sortedRooms[0]?.id ?? 1)}
                />
              )}

              {mode === "tableau_liste" && (
                <TableauGroupe
                  assignments={filtered}
                  timeLabel={timeLabel}
                  name={name}
                  db={db}
                  onPick={(a) => setSel(a)}
                />
              )}

              {mode === "fiche_individuelle" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-card border border-line rounded-xl px-4 py-2 text-xs">
                    <span className="font-bold text-petrol-900">Groupe sélectionné :</span>
                    <Select
                      value={selectedIndividualId}
                      onChange={(e) =>
                        setSelectedIndividualId(e.target.value === "all" ? "all" : Number(e.target.value))
                      }
                      className="!w-64 !py-1 text-xs font-bold"
                    >
                      <option value="all">Tous les groupes</option>
                      {db.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.level} {g.year}A — {g.studentCount} apprenants)
                        </option>
                      ))}
                    </Select>
                  </div>
                  <ClientCaptureGrid
                    dimension="groupes"
                    entities={
                      selectedIndividualId === "all"
                        ? db.groups
                        : db.groups.filter((g) => g.id === selectedIndividualId)
                    }
                    slots={slots}
                    days={db.settings.enabledDays}
                    assignments={filtered}
                    name={name}
                    compactMode={compactMode}
                    highlightGroup={highlightGroup}
                    highlightInstructor={highlightInstructor}
                    onPick={(a) => setSel(a)}
                    onAddAt={(day, slotIdx, grpId) => openSlotForAdd(day, slotIdx, sortedRooms[0]?.id ?? 1)}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Signature administrative au pied */}
      <div className="mt-6 pt-4 border-t border-line flex flex-wrap items-center justify-between text-xs text-inksoft">
        <div>
          <span>Institut de Formation dans les Métiers du Tourisme (IFMT) — Hammamet</span>
          <span className="mx-2">·</span>
          <span>Tutelle AFMT / Ministère du Tourisme</span>
        </div>
        <div>
          <span>
            Direction des Études : <b>Ines Khrifech</b>
          </span>
        </div>
      </div>

      {/* Modal d'édition manuelle avec revalidation immédiate */}
      {(sel || creating) && (
        <SessionModal
          assignment={sel}
          initialCoords={creatingCoords}
          onDone={async () => {
            setSel(null);
            setCreating(false);
            setCreatingCoords(null);
            await refresh();
          }}
          onClose={() => {
            setSel(null);
            setCreating(false);
            setCreatingCoords(null);
          }}
        />
      )}
    </div>
  );
}

// =========================================================================
// MATRICE GÉNÉRIQUE FORMAT CAPTURE CLIENT (INTERCHANGEABLE SUR LES 3 VUES)
// =========================================================================
// Colonnes : JOURS (Lundi..Vendredi) x HORAIRES (8--10, 10--12, 12--14, 14--16, 16--18, 18--20)
// Lignes : Entités (Salles / Formateurs / Groupes) avec 3 sous-lignes
// =========================================================================
function ClientCaptureGrid({
  dimension,
  entities,
  slots,
  days,
  assignments,
  name,
  compactMode,
  highlightGroup,
  highlightInstructor,
  instructorStats,
  onPick,
  onAddAt,
}: {
  dimension: "salles" | "formateurs" | "groupes";
  entities: Array<Room | Instructor | Group>;
  slots: SlotInfo[];
  days: number[];
  assignments: Assignment[];
  name: { f: (id: number) => string; g: (id: number) => string; s: (id: number) => string; r: (id: number) => string };
  compactMode: boolean;
  highlightGroup: number | "all";
  highlightInstructor: number | "all";
  instructorStats?: Map<number, { assigned: number; statutory: number; overtime: number; instructor: Instructor }>;
  onPick: (a: Assignment) => void;
  onAddAt: (day: number, slotIdx: number, entityId: number) => void;
}) {
  const { db } = useApp();

  const getSubRowLabels = () => {
    if (dimension === "salles") return ["GR", "F", "COMP"];
    if (dimension === "formateurs") return ["GR", "SALLE", "COMP"];
    return ["F", "SALLE", "COMP"];
  };

  const subLabels = getSubRowLabels();

  return (
    <div className="print-area nice-scroll overflow-x-auto rounded-2xl border-2 border-slate-900 bg-white shadow-md">
      {/* En-tête interne */}
      <div className="border-b-2 border-slate-900 bg-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-display font-extrabold text-sm text-slate-950 uppercase tracking-wider">
            {dimension === "salles"
              ? "TABLEAU RECAP FORMATION (PAR SALLE)"
              : dimension === "formateurs"
              ? "TABLEAU 1 : FORMATEURS & HEURES SUPPLÉMENTAIRES"
              : "TABLEAU 3 : GROUPES PÉDAGOGIQUES (CAP · BTP · BTS)"}
          </span>
          <span className="text-slate-600 font-semibold">
            PÉRIODE : {db?.settings.periodName ?? "2025/2026"}
          </span>
        </div>

        <div className="text-[11px] text-slate-700 font-mono flex items-center gap-3">
          <span className="font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
            Pause 12h–14h
          </span>
          <span className="font-bold text-sky-900 bg-sky-100 px-1.5 py-0.5 rounded border border-sky-300">
            Soir 18h–20h
          </span>
          <span>·</span>
          <span>Direction des Études : Ines Khrifech</span>
        </div>
      </div>

      <table className="w-full border-collapse text-[10px] sm:text-[11px] select-none">
        {/* EN-TÊTES COLONNES : JOURS X HORAIRES */}
        <thead>
          {/* Ligne 1 des en-têtes : JOURS (Lundi ... Vendredi) */}
          <tr className="bg-slate-900 text-white font-bold text-center border-b border-slate-700">
            <th className="sticky left-0 z-30 bg-slate-950 px-2 py-2 border-r-2 border-slate-700 text-[11px] uppercase tracking-wider w-28">
              {dimension === "salles"
                ? "SALLE"
                : dimension === "formateurs"
                ? "FORMATEUR"
                : "GROUPE"}
            </th>
            <th className="sticky left-28 z-30 bg-slate-950 px-1 py-2 border-r-2 border-slate-700 text-[10px] uppercase tracking-wider w-12 text-amber-300">
              IND.
            </th>
            {days.map((day) => (
              <th
                key={day}
                colSpan={slots.length}
                className="px-2 py-2 border-r-2 border-slate-700 uppercase tracking-widest text-[12px] font-extrabold bg-slate-900 text-amber-300"
              >
                {DAYS_FR[day]}
              </th>
            ))}
            {dimension === "formateurs" && (
              <th className="px-3 py-2 border-l-2 border-amber-500 bg-amber-900 text-amber-200 text-[11px] uppercase tracking-wider w-36 whitespace-nowrap">
                Heures Supp.
              </th>
            )}
          </tr>

          {/* Ligne 2 des en-têtes : HORAIRES (8--10, 10--12, 12--14, 14--16, 16--18, 18--20) */}
          <tr className="bg-slate-200 text-slate-900 font-extrabold text-center border-b-2 border-slate-900 text-[9px] sm:text-[10px] tracking-tight">
            <th className="sticky left-0 z-30 bg-slate-300 border-r-2 border-slate-400 py-1" />
            <th className="sticky left-28 z-30 bg-slate-300 border-r-2 border-slate-400 py-1" />
            {days.map((day) =>
              slots.map((sl) => {
                const isPauseSlot = sl.startMin >= 720 && sl.endMin <= 840;
                const isEveningSlot = sl.startMin >= 1080;

                return (
                  <th
                    key={`${day}-${sl.index}`}
                    className={`px-1 py-1.5 border-r border-slate-300 font-mono whitespace-nowrap ${
                      isPauseSlot
                        ? "bg-amber-100/90 text-amber-950 font-black border-amber-300"
                        : isEveningSlot
                        ? "bg-sky-100/90 text-sky-950 font-black border-sky-300"
                        : "bg-slate-200 text-slate-900"
                    }`}
                    title={
                      isPauseSlot
                        ? "Créneau 12h-14h (Pause obligatoire - Seuls TP Cuisine, Pâtisserie, Restaurant autorisés)"
                        : isEveningSlot
                        ? "Créneau 18h-20h (Soirée - Seuls TP Cuisine, Pâtisserie, Restaurant autorisés)"
                        : `Créneau normal ${toHHMM(sl.startMin)} - ${toHHMM(sl.endMin)}`
                    }
                  >
                    {toHHMM(sl.startMin).slice(0, 2)}--{toHHMM(sl.endMin).slice(0, 2)}
                    {isPauseSlot && <span className="block text-[8px] text-amber-800 uppercase font-sans">Pause</span>}
                    {isEveningSlot && <span className="block text-[8px] text-sky-800 uppercase font-sans">Soir</span>}
                  </th>
                );
              })
            )}
            {dimension === "formateurs" && (
              <th className="bg-amber-800 text-amber-200 text-[9px] py-1 uppercase font-extrabold">
                Calcul Automatique
              </th>
            )}
          </tr>
        </thead>

        {/* CORPS : LIGNES PAR ENTITÉ (AVEC 3 SOUS-LIGNES) */}
        <tbody>
          {entities.map((ent, entIdx) => {
            const entId = ent.id;
            const entName =
              dimension === "salles"
                ? (ent as Room).name
                : dimension === "formateurs"
                ? `${(ent as Instructor).firstName} ${(ent as Instructor).lastName}`
                : (ent as Group).name;

            const stat = dimension === "formateurs" ? instructorStats?.get(entId) : undefined;
            const overtime = stat ? stat.overtime : 0;

            return (
              <React.Fragment key={entId}>
                {/* Sous-ligne 1 : GR (ou F pour les groupes) */}
                <tr className="border-t-2 border-slate-800 hover:bg-slate-50/40">
                  {/* Colonne Nom de l'entité (Rowspan = 3) */}
                  <td
                    rowSpan={3}
                    className="sticky left-0 z-20 bg-slate-100 border-r-2 border-b-2 border-slate-900 px-2 py-1.5 font-display font-extrabold text-xs uppercase text-slate-950 align-middle shadow-sm whitespace-nowrap"
                  >
                    <div className="font-bold">{entName}</div>
                    {dimension === "salles" && (
                      <span className="text-[9px] text-slate-500 font-normal block">
                        {(ent as Room).capacity} pl.
                      </span>
                    )}
                    {dimension === "formateurs" && stat && (
                      <span className="text-[9px] text-slate-500 font-normal block">
                        {stat.assigned}h / {stat.statutory}h
                      </span>
                    )}
                    {dimension === "groupes" && (
                      <span className="text-[9px] text-slate-500 font-normal block">
                        {(ent as Group).level} {(ent as Group).year}A ({(ent as Group).studentCount} app.)
                      </span>
                    )}
                  </td>

                  {/* Sous-colonne 1 Label (ex: GR) */}
                  <td className="sticky left-28 z-20 bg-slate-50 border-r-2 border-slate-400 px-1 py-1 text-center font-bold text-teal-950 text-[9px]">
                    {subLabels[0]}
                  </td>

                  {/* Cellules Sous-ligne 1 */}
                  {days.map((day) =>
                    slots.map((sl, slotIdx) => {
                      const session = assignments.find((a) => {
                        const matchesEntity =
                          dimension === "salles"
                            ? a.roomId === entId
                            : dimension === "formateurs"
                            ? a.instructorId === entId
                            : a.groupId === entId;
                        return (
                          matchesEntity &&
                          a.day === day &&
                          a.startSlot <= slotIdx &&
                          a.startSlot + Math.max(1, Math.round(a.hours / 2)) > slotIdx
                        );
                      });

                      const val = session
                        ? dimension === "salles"
                          ? shortGroup(name.g(session.groupId))
                          : dimension === "formateurs"
                          ? shortGroup(name.g(session.groupId))
                          : shortInstructor(name.f(session.instructorId))
                        : "";

                      const c = session ? groupColor(session.groupId) : null;
                      const isHighlighted =
                        session &&
                        ((highlightGroup !== "all" && session.groupId === highlightGroup) ||
                          (highlightInstructor !== "all" && session.instructorId === highlightInstructor));

                      return (
                        <td
                          key={`s1-${day}-${sl.index}`}
                          onClick={() => (session ? onPick(session) : onAddAt(day, slotIdx, entId))}
                          style={{
                            backgroundColor: session ? (isHighlighted ? "#fef08a" : c?.bg) : undefined,
                          }}
                          className={`px-1 py-0.5 border-r border-slate-300 text-center font-bold truncate cursor-pointer transition hover:brightness-95 ${
                            !session ? "text-slate-300 hover:bg-teal-50" : ""
                          } ${isHighlighted ? "font-black text-amber-950" : ""}`}
                          title={session ? `${name.g(session.groupId)} · ${name.s(session.subjectId)}` : "Créneau libre"}
                        >
                          <span style={{ color: session ? (isHighlighted ? "#78350f" : c?.text) : undefined }}>
                            {val || "·"}
                          </span>
                        </td>
                      );
                    })
                  )}

                  {/* Colonne Nombre d'heures supplémentaires (Rowspan = 3) */}
                  {dimension === "formateurs" && (
                    <td
                      rowSpan={3}
                      className="border-l-2 border-b-2 border-amber-300 bg-amber-50/50 px-2 py-2 text-center align-middle"
                    >
                      {overtime > 0 ? (
                        <span className="inline-flex items-center gap-1 font-display font-extrabold text-amber-900 bg-amber-200 border border-amber-400 px-2.5 py-1 rounded-lg tabular-nums text-sm shadow-xs">
                          +{overtime} h
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold tabular-nums text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          0 h
                        </span>
                      )}
                    </td>
                  )}
                </tr>

                {/* Sous-ligne 2 : F (ou SALLE) */}
                <tr className="hover:bg-slate-50/40">
                  <td className="sticky left-28 z-20 bg-slate-50 border-r-2 border-slate-400 px-1 py-1 text-center font-semibold text-amber-950 text-[9px]">
                    {subLabels[1]}
                  </td>

                  {days.map((day) =>
                    slots.map((sl, slotIdx) => {
                      const session = assignments.find((a) => {
                        const matchesEntity =
                          dimension === "salles"
                            ? a.roomId === entId
                            : dimension === "formateurs"
                            ? a.instructorId === entId
                            : a.groupId === entId;
                        return (
                          matchesEntity &&
                          a.day === day &&
                          a.startSlot <= slotIdx &&
                          a.startSlot + Math.max(1, Math.round(a.hours / 2)) > slotIdx
                        );
                      });

                      const val = session
                        ? dimension === "salles"
                          ? shortInstructor(name.f(session.instructorId))
                          : dimension === "formateurs"
                          ? name.r(session.roomId)
                          : name.r(session.roomId)
                        : "";

                      const c = session ? groupColor(session.groupId) : null;
                      const isHighlighted =
                        session &&
                        ((highlightGroup !== "all" && session.groupId === highlightGroup) ||
                          (highlightInstructor !== "all" && session.instructorId === highlightInstructor));

                      return (
                        <td
                          key={`s2-${day}-${sl.index}`}
                          onClick={() => (session ? onPick(session) : onAddAt(day, slotIdx, entId))}
                          style={{
                            backgroundColor: session ? (isHighlighted ? "#fef08a" : c?.bg) : undefined,
                          }}
                          className={`px-1 py-0.5 border-r border-slate-300 text-center font-medium truncate cursor-pointer transition hover:brightness-95 ${
                            !session ? "text-slate-300 hover:bg-teal-50" : ""
                          }`}
                        >
                          <span style={{ color: session ? (isHighlighted ? "#78350f" : c?.text) : undefined }}>
                            {val || "·"}
                          </span>
                        </td>
                      );
                    })
                  )}
                </tr>

                {/* Sous-ligne 3 : COMP (Compétence / Matière) */}
                <tr className="border-b-2 border-slate-800 hover:bg-slate-50/40">
                  <td className="sticky left-28 z-20 bg-slate-50 border-r-2 border-slate-400 border-b-2 border-slate-800 px-1 py-1 text-center font-extrabold text-slate-950 text-[9px]">
                    {subLabels[2]}
                  </td>

                  {days.map((day) =>
                    slots.map((sl, slotIdx) => {
                      const session = assignments.find((a) => {
                        const matchesEntity =
                          dimension === "salles"
                            ? a.roomId === entId
                            : dimension === "formateurs"
                            ? a.instructorId === entId
                            : a.groupId === entId;
                        return (
                          matchesEntity &&
                          a.day === day &&
                          a.startSlot <= slotIdx &&
                          a.startSlot + Math.max(1, Math.round(a.hours / 2)) > slotIdx
                        );
                      });

                      const val = session ? shortSubject(name.s(session.subjectId)) : "";
                      const c = session ? groupColor(session.groupId) : null;
                      const isHighlighted =
                        session &&
                        ((highlightGroup !== "all" && session.groupId === highlightGroup) ||
                          (highlightInstructor !== "all" && session.instructorId === highlightInstructor));

                      return (
                        <td
                          key={`s3-${day}-${sl.index}`}
                          onClick={() => (session ? onPick(session) : onAddAt(day, slotIdx, entId))}
                          style={{
                            backgroundColor: session ? (isHighlighted ? "#fef08a" : c?.bg) : undefined,
                          }}
                          className={`px-1 py-0.5 border-r border-slate-300 border-b-2 border-slate-800 text-center font-extrabold truncate cursor-pointer transition hover:brightness-95 ${
                            !session ? "text-slate-300 hover:bg-teal-50" : ""
                          }`}
                        >
                          <span style={{ color: session ? (isHighlighted ? "#78350f" : c?.text) : undefined }}>
                            {val || "·"}
                          </span>
                        </td>
                      );
                    })
                  )}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>

        {/* PIED DE TABLEAU RÉCAPITULATIF */}
        <tfoot>
          <tr className="bg-slate-900 text-amber-300 font-extrabold text-center text-[10px]">
            <td className="sticky left-0 bg-slate-950 px-2 py-2 border-r-2 border-slate-700">TOTAL</td>
            <td className="sticky left-28 bg-slate-950 border-r-2 border-slate-700" />
            <td colSpan={days.length * slots.length} className="px-3 py-2 text-left uppercase tracking-wider">
              Document officiel certifié conforme — {assignments.length} séances planifiées ({assignments.reduce((s: number, a: Assignment) => s + a.hours, 0)}h)
            </td>
            {dimension === "formateurs" && (
              <td className="bg-amber-950 text-amber-300 px-3 py-2 font-display font-black text-sm tabular-nums border-l-2 border-amber-500">
                +{instructorStats ? Array.from(instructorStats.values()).reduce((acc, st) => acc + st.overtime, 0) : 0} h
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// =========================================================================
// TABLEAU 1 : FORMATEUR (FORMAT LISTE AVEC HEURES SUPPLÉMENTAIRES)
// =========================================================================
function TableauFormateur({
  assignments,
  timeLabel,
  name,
  instructorStats,
  onPick,
}: {
  assignments: Assignment[];
  timeLabel: (a: Assignment) => string;
  name: { f: (id: number) => string; g: (id: number) => string; s: (id: number) => string; r: (id: number) => string };
  instructorStats: Map<number, { assigned: number; statutory: number; overtime: number; instructor: Instructor }>;
  onPick: (a: Assignment) => void;
}) {
  const sorted = useMemo(() => {
    return [...assignments].sort(
      (a, b) => a.instructorId - b.instructorId || a.day - b.day || a.startSlot - b.startSlot
    );
  }, [assignments]);

  return (
    <div className="print-area nice-scroll overflow-x-auto rounded-2xl border-2 border-amber-300 bg-card shadow-sm">
      <table className="w-full min-w-[860px] border-collapse text-xs">
        <thead>
          <tr className="bg-amber-900 text-white text-left font-display text-[11px] font-bold uppercase tracking-wider">
            <th className="px-4 py-3.5">Formateur</th>
            <th className="px-4 py-3.5">Jour</th>
            <th className="px-4 py-3.5">Horaire</th>
            <th className="px-4 py-3.5">Groupe</th>
            <th className="px-4 py-3.5">Matière</th>
            <th className="px-4 py-3.5">Salle</th>
            <th className="px-4 py-3.5 text-center bg-amber-800 text-amber-200 border-l border-amber-700/50">
              Nombre d'heures supplémentaires
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linesoft">
          {sorted.map((a, idx) => {
            const stat = instructorStats.get(a.instructorId);
            const overtime = stat ? stat.overtime : 0;
            const isFirstOfInstructor = idx === 0 || sorted[idx - 1].instructorId !== a.instructorId;

            return (
              <tr
                key={a.id}
                onClick={() => onPick(a)}
                className={`hover:bg-amber-50/70 transition-colors cursor-pointer group ${
                  isFirstOfInstructor && idx !== 0 ? "border-t-2 border-amber-200" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-bold text-slate-900">
                  {name.f(a.instructorId)}
                  {isFirstOfInstructor && stat && (
                    <span className="block text-[10px] font-normal text-slate-500">
                      Total : {stat.assigned}h / Quota : {stat.statutory}h
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-bold text-petrol-900">{DAYS_FR[a.day]}</td>
                <td className="px-4 py-2.5 font-mono text-slate-700">{timeLabel(a)}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-900">{name.g(a.groupId)}</td>
                <td className="px-4 py-2.5 font-bold text-slate-950 group-hover:text-amber-900">
                  {name.s(a.subjectId)}
                </td>
                <td className="px-4 py-2.5 text-slate-700">{name.r(a.roomId)}</td>
                <td className="px-4 py-2.5 text-center border-l border-amber-100 bg-amber-50/30">
                  {overtime > 0 ? (
                    <span className="inline-flex items-center gap-1 font-display font-extrabold text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md tabular-nums text-xs">
                      +{overtime} h
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-semibold tabular-nums text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      0 h
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {!sorted.length && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-slate-400">
                Aucune séance trouvée pour ce formateur.
              </td>
            </tr>
          )}
        </tbody>
        {sorted.length > 0 && (
          <tfoot>
            <tr className="bg-amber-950 text-white font-bold border-t-2 border-amber-700">
              <td colSpan={6} className="px-4 py-3 text-right uppercase tracking-wider text-[11px] text-amber-200">
                Total des Heures Supplémentaires Comptabilisées :
              </td>
              <td className="px-4 py-3 text-center bg-amber-900 border-l border-amber-700 font-display font-extrabold text-sm text-amber-300 tabular-nums">
                +
                {Array.from(new Set(sorted.map((a) => a.instructorId))).reduce((acc, instId) => {
                  const st = instructorStats.get(instId);
                  return acc + (st ? st.overtime : 0);
                }, 0)}{" "}
                h
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// =========================================================================
// TABLEAU 2 : SALLE (FORMAT LISTE)
// =========================================================================
function TableauSalle({
  assignments,
  timeLabel,
  name,
  db,
  onPick,
}: {
  assignments: Assignment[];
  timeLabel: (a: Assignment) => string;
  name: { f: (id: number) => string; g: (id: number) => string; s: (id: number) => string; r: (id: number) => string };
  db: { groups: Array<{ id: number; level: string; year: number }> };
  onPick: (a: Assignment) => void;
}) {
  const sorted = useMemo(() => {
    return [...assignments].sort(
      (a, b) => a.roomId - b.roomId || a.day - b.day || a.startSlot - b.startSlot
    );
  }, [assignments]);

  return (
    <div className="print-area nice-scroll overflow-x-auto rounded-2xl border-2 border-sky-300 bg-card shadow-sm">
      <table className="w-full min-w-[820px] border-collapse text-xs">
        <thead>
          <tr className="bg-sky-900 text-white text-left font-display text-[11px] font-bold uppercase tracking-wider">
            <th className="px-4 py-3.5">Salle</th>
            <th className="px-4 py-3.5">Jour</th>
            <th className="px-4 py-3.5">Horaire</th>
            <th className="px-4 py-3.5">Groupe</th>
            <th className="px-4 py-3.5">Niveau</th>
            <th className="px-4 py-3.5">Formateur</th>
            <th className="px-4 py-3.5">Matière</th>
            <th className="px-4 py-3.5 text-center">Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linesoft">
          {sorted.map((a) => {
            const g = db.groups.find((x) => x.id === a.groupId);
            return (
              <tr
                key={a.id}
                onClick={() => onPick(a)}
                className="hover:bg-sky-50/70 transition-colors cursor-pointer group"
              >
                <td className="px-4 py-2.5 font-bold text-slate-900">{name.r(a.roomId)}</td>
                <td className="px-4 py-2.5 font-bold text-sky-900">{DAYS_FR[a.day]}</td>
                <td className="px-4 py-2.5 font-mono text-slate-700">{timeLabel(a)}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-900">{name.g(a.groupId)}</td>
                <td className="px-4 py-2.5 text-slate-600">{levelYearLabel(g?.level ?? "CAP", g?.year ?? 1)}</td>
                <td className="px-4 py-2.5 text-slate-800">{name.f(a.instructorId)}</td>
                <td className="px-4 py-2.5 font-bold text-slate-950 group-hover:text-sky-900">
                  {name.s(a.subjectId)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Badge tone={a.kind === "TP" ? "brass" : "petrol"}>{a.kind}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
        {sorted.length > 0 && (
          <tfoot>
            <tr className="bg-sky-950 text-white font-bold border-t-2 border-sky-700">
              <td colSpan={7} className="px-4 py-3 text-right uppercase tracking-wider text-[11px] text-sky-200">
                Volume Total d'Occupation :
              </td>
              <td className="px-4 py-3 text-center bg-sky-900 border-l border-sky-700 font-display font-extrabold text-sm text-sky-200 tabular-nums">
                {sorted.reduce((acc, a) => acc + a.hours, 0)} h
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// =========================================================================
// TABLEAU 3 : GROUPE (FORMAT LISTE)
// =========================================================================
function TableauGroupe({
  assignments,
  timeLabel,
  name,
  db,
  onPick,
}: {
  assignments: Assignment[];
  timeLabel: (a: Assignment) => string;
  name: { f: (id: number) => string; g: (id: number) => string; s: (id: number) => string; r: (id: number) => string };
  db: { groups: Array<{ id: number; level: string; year: number; specialty: string }> };
  onPick: (a: Assignment) => void;
}) {
  const sorted = useMemo(() => {
    return [...assignments].sort(
      (a, b) => a.groupId - b.groupId || a.day - b.day || a.startSlot - b.startSlot
    );
  }, [assignments]);

  return (
    <div className="print-area nice-scroll overflow-x-auto rounded-2xl border-2 border-emerald-300 bg-card shadow-sm">
      <table className="w-full min-w-[860px] border-collapse text-xs">
        <thead>
          <tr className="bg-emerald-950 text-white text-left font-display text-[11px] font-bold uppercase tracking-wider">
            <th className="px-4 py-3.5">Groupe</th>
            <th className="px-4 py-3.5">Jour</th>
            <th className="px-4 py-3.5">Horaire</th>
            <th className="px-4 py-3.5">Niveau</th>
            <th className="px-4 py-3.5">Spécialité</th>
            <th className="px-4 py-3.5">Matière</th>
            <th className="px-4 py-3.5 text-center">Type</th>
            <th className="px-4 py-3.5">Formateur</th>
            <th className="px-4 py-3.5">Salle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linesoft">
          {sorted.map((a) => {
            const g = db.groups.find((x) => x.id === a.groupId);
            return (
              <tr
                key={a.id}
                onClick={() => onPick(a)}
                className="hover:bg-emerald-50/70 transition-colors cursor-pointer group"
              >
                <td className="px-4 py-2.5 font-bold text-slate-900">{name.g(a.groupId)}</td>
                <td className="px-4 py-2.5 font-bold text-emerald-900">{DAYS_FR[a.day]}</td>
                <td className="px-4 py-2.5 font-mono text-slate-700">{timeLabel(a)}</td>
                <td className="px-4 py-2.5 text-slate-600">{levelYearLabel(g?.level ?? "CAP", g?.year ?? 1)}</td>
                <td className="px-4 py-2.5 text-slate-600">{g?.specialty || "—"}</td>
                <td className="px-4 py-2.5 font-bold text-slate-950 group-hover:text-emerald-900">
                  {name.s(a.subjectId)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Badge tone={a.kind === "TP" ? "brass" : "petrol"}>{a.kind}</Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-800">{name.f(a.instructorId)}</td>
                <td className="px-4 py-2.5 text-slate-700">{name.r(a.roomId)}</td>
              </tr>
            );
          })}
        </tbody>
        {sorted.length > 0 && (
          <tfoot>
            <tr className="bg-emerald-950 text-white font-bold border-t-2 border-emerald-700">
              <td colSpan={7} className="px-4 py-3 text-right uppercase tracking-wider text-[11px] text-emerald-200">
                Volume Total Réalisé :
              </td>
              <td colSpan={2} className="px-4 py-3 text-center bg-emerald-900 border-l border-emerald-700 font-display font-extrabold text-sm text-emerald-200 tabular-nums">
                {sorted.reduce((acc, a) => acc + a.hours, 0)} h / semaine
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// =========================================================================
// MODAL D'ÉDITION ET REVALIDATION IMMÉDIATE
// =========================================================================
function SessionModal({
  assignment,
  initialCoords,
  onDone,
  onClose,
}: {
  assignment: Assignment | null;
  initialCoords?: { day?: number; slot?: number; roomId?: number } | null;
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const { db, toast, author } = useApp();
  const slots = useMemo(() => (db ? buildSlots(db.settings.boundaries) : []), [db]);
  const [groupId, setGroupId] = useState(assignment?.groupId ?? db?.groups[0]?.id ?? 0);
  const teachingList = useMemo(
    () => (db ? db.teachings.filter((t) => t.groupId === groupId) : []),
    [db, groupId]
  );
  const [subjectId, setSubjectId] = useState(
    assignment?.subjectId ?? teachingList[0]?.subjectId ?? db?.subjects[0]?.id ?? 0
  );
  const subject = db?.subjects.find((x) => x.id === subjectId);
  const allowedDurations =
    db && subject ? (subject.kind === "TP" ? db.settings.tpDurations : db.settings.coursDurations) : [2];
  const [hours, setHours] = useState(assignment?.hours ?? allowedDurations[0] ?? 2);
  const [day, setDay] = useState(assignment?.day ?? initialCoords?.day ?? 0);
  const [startSlot, setStartSlot] = useState(assignment?.startSlot ?? initialCoords?.slot ?? 0);
  const qualified = useMemo(
    () =>
      db && subject
        ? db.instructors.filter((i) => i.active && i.competences.includes(subject.competenceKey))
        : [],
    [db, subject]
  );
  const [instructorId, setInstructorId] = useState(assignment?.instructorId ?? qualified[0]?.id ?? 0);
  const compatibleRooms = useMemo(
    () =>
      db && subject
        ? db.rooms.filter((r) => {
            const g = db.groups.find((x) => x.id === groupId);
            return r.allowedKinds.includes(subject.kind) && r.capacity >= (g?.studentCount ?? 0);
          })
        : [],
    [db, subject, groupId]
  );
  const [roomId, setRoomId] = useState(assignment?.roomId ?? initialCoords?.roomId ?? compatibleRooms[0]?.id ?? 0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  if (!db) return null;

  const teaching = db.teachings.find((t) => t.groupId === groupId && t.subjectId === subjectId);

  const switchSubject = (id: number) => {
    setSubjectId(id);
    const sub = db.subjects.find((x) => x.id === id);
    const dur = sub ? (sub.kind === "TP" ? db.settings.tpDurations : db.settings.coursDurations) : [2];
    setHours(dur[0] ?? 2);
    setStartSlot(windowIntervalAll(slots, dur[0] ?? 2)[0]?.[0].index ?? 0);
    const q = sub ? db.instructors.filter((i) => i.active && i.competences.includes(sub.competenceKey)) : [];
    setInstructorId(q[0]?.id ?? 0);
    const g = db.groups.find((x) => x.id === groupId);
    const rooms = sub ? db.rooms.filter((r) => r.allowedKinds.includes(sub.kind) && r.capacity >= (g?.studentCount ?? 0)) : [];
    setRoomId(rooms[0]?.id ?? 0);
    setErrors([]);
  };

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const cand = {
        id: assignment?.id,
        day,
        startSlot,
        hours,
        kind: subject?.kind ?? "COURS",
        groupId,
        subjectId,
        instructorId,
        roomId,
        teachingId: teaching?.id ?? null,
      };
      const v = await api<{ ok: boolean; error?: string; conflicts?: Array<{ message: string }> }>(
        "/api/validate",
        "POST",
        { assignment: cand }
      );
      if (!v.ok) {
        setErrors([v.error || "Modification refusée par le contrôle des conflits", ...(v.conflicts || []).map((c) => c.message)]);
        return;
      }
      if (assignment)
        await api(`/api/resource/assignments/${assignment.id}`, "PUT", { ...cand, author });
      else
        await api("/api/resource/assignments", "POST", {
          ...cand,
          versionId: db.settings.activeVersionId,
          source: "manuel",
          author,
        });
      toast(
        assignment
          ? "Séance modifiée — Revalidation immédiate : aucun conflit."
          : "Séance ajoutée — Revalidation immédiate : aucun conflit.",
        "good"
      );
      await onDone();
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!assignment) return;
    await api(`/api/resource/assignments/${assignment.id}`, "DELETE", { author });
    toast("Séance retirée du planning central.", "warn");
    await onDone();
  };

  return (
    <Modal
      title={assignment ? "Modifier la séance" : "Ajouter une séance"}
      sub="Revalidation immédiate des contraintes obligatoires et des règles d'horaires spéciales."
      onClose={onClose}
      wide
      footer={
        <>
          {assignment &&
            (confirmDel ? (
              <Btn variant="danger" size="sm" onClick={del}>
                <I.check className="h-4 w-4" /> Confirmer suppression
              </Btn>
            ) : (
              <Btn variant="ghost" size="sm" onClick={() => setConfirmDel(true)} className="!text-danger-700">
                <I.trash className="h-4 w-4" /> Supprimer
              </Btn>
            ))}
          <div className="flex-1" />
          <Btn variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Btn>
          <Btn size="sm" onClick={save} disabled={saving}>
            {saving ? <I.refresh className="h-4 w-4 animate-spin" /> : <I.check className="h-4 w-4" />}
            {assignment ? "Valider et enregistrer" : "Ajouter au planning"}
          </Btn>
        </>
      }
    >
      {errors.length > 0 && (
        <div className="mb-4 rounded-xl border border-danger-600 bg-danger-50 p-3.5 text-xs text-danger-700 font-semibold">
          <p className="flex items-center gap-2 font-bold text-sm">
            <I.alert className="h-4 w-4 shrink-0" /> Modification refusée (Contrainte obligatoire)
          </p>
          <ul className="ml-5 mt-1 list-disc space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Groupe">
          <Select
            value={groupId}
            onChange={(e) => {
              const gid = Number(e.target.value);
              setGroupId(gid);
              const t = db.teachings.filter((x) => x.groupId === gid);
              setSubjectId(t[0]?.subjectId ?? db.subjects[0]?.id ?? 0);
            }}
          >
            {db.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Matière / Compétence">
          <Select value={subjectId} onChange={(e) => switchSubject(Number(e.target.value))}>
            {teachingList.length ? (
              teachingList.map((t) => {
                const sub = db.subjects.find((x) => x.id === t.subjectId)!;
                return (
                  <option key={t.id} value={t.subjectId}>
                    {sub.name} ({sub.kind} — {t.hoursPerWeek}h)
                  </option>
                );
              })
            ) : (
              db.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.kind})
                </option>
              ))
            )}
          </Select>
        </Field>

        <Field label={`Durée (Séance ${subject?.kind})`}>
          <Select
            value={hours}
            onChange={(e) => {
              const h = Number(e.target.value);
              setHours(h);
              const w = windowIntervalAll(slots, h);
              setStartSlot(w[0]?.[0].index ?? 0);
            }}
          >
            {allowedDurations.map((d) => (
              <option key={d} value={d}>
                {d} h (bloc continu)
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Jour">
          <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {db.settings.enabledDays.map((d) => (
              <option key={d} value={d}>
                {DAYS_FR[d]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Créneau (Bloc continu)">
          <Select value={startSlot} onChange={(e) => setStartSlot(Number(e.target.value))}>
            {(windowIntervalAll(slots, hours) || []).map((w) => (
              <option key={w[0].index} value={w[0].index}>
                {toHHMM(w[0].startMin)} – {toHHMM(w[w.length - 1].endMin)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Formateur (Qualifié)">
          <Select value={instructorId} onChange={(e) => setInstructorId(Number(e.target.value))}>
            {qualified.length ? (
              qualified.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.firstName} {i.lastName}
                </option>
              ))
            ) : (
              <option value={0}>— Aucun formateur qualifié —</option>
            )}
          </Select>
        </Field>

        <Field label={`Salle (Compatible ${subject?.kind ?? ""})`}>
          <Select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
            {compatibleRooms.length ? (
              compatibleRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {ROOM_KIND_LABELS[r.kind]} ({r.capacity} pl.)
                </option>
              ))
            ) : (
              <option value={0}>— Aucune salle compatible —</option>
            )}
          </Select>
        </Field>

        <div className="col-span-2 flex items-end justify-end sm:col-span-2">
          <Badge tone={teaching ? "petrol" : "warn"}>
            {teaching
              ? `Volume contractuel : ${teaching.hoursPerWeek}h/semaine`
              : "Attention : volume hors grille contractuelle"}
          </Badge>
        </div>
      </div>
    </Modal>
  );
}

function windowIntervalAll(slots: SlotInfo[], hours: number): SlotInfo[][] {
  const out: SlotInfo[][] = [];
  for (let i = 0; i < slots.length; i++) {
    let acc = 0;
    let run: SlotInfo[] = [];
    for (let j = i; j < slots.length; j++) {
      if (j > i && slots[j].startMin !== slots[j - 1].endMin) break;
      run.push(slots[j]);
      acc += slots[j].hours;
      if (acc === hours) {
        out.push([...run]);
        break;
      }
      if (acc > hours) break;
    }
  }
  return out;
}
