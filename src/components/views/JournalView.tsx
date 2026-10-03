"use client";
import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppShell";
import { Badge, Card, EmptyState, I, Input, Select } from "@/components/ui";
import { ENTITY_LABELS, fmtDateTime } from "@/lib/format";

const ACTION_TONES: Record<string, "good" | "brass" | "danger" | "petrol" | "warn" | "neutral"> = {
  generation: "petrol",
  activation: "brass",
  creation: "good",
  modification: "warn",
  suppression: "danger",
  import: "good",
};

export default function JournalView() {
  const { db } = useApp();
  if (!db) return null;
  return <JournalViewInner />;
}

function JournalViewInner() {
  const { db: maybeDb } = useApp();
  const db = maybeDb!; // garanti non nul par le composant parent
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("all");

  const rows = useMemo(() => {
    const list = [...db.audit].reverse();
    return list.filter((a) => {
      if (entity !== "all" && a.entity !== entity) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${a.author} ${a.action} ${a.details} ${a.entity}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [db, search, entity]);

  const entities = [...new Set(db.audit.map((a) => a.entity))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Journal d'audit</h1>
          <p className="text-sm text-inksoft">Traçabilité complète : qui a modifié quoi, quand.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 !py-1.5 text-xs" />
          <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="!w-44 !py-1.5 text-xs">
            <option value="all">Toutes entités</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {ENTITY_LABELS[e] ?? e}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card pad={false}>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Aucune entrée" text="Les actions (génération, modifications manuelles, ajouts, suppressions) sont consignées ici." />
          </div>
        ) : (
          <div className="nice-scroll max-h-[65vh] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0">
                <tr className="border-b border-line bg-linesoft/70 text-left text-[11px] font-bold uppercase tracking-wide text-inksoft">
                  <th className="px-4 py-2.5">Quand</th>
                  <th className="px-4 py-2.5">Par</th>
                  <th className="px-4 py-2.5">Entité</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Détails</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-linesoft odd:bg-card even:bg-linesoft/30">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-inksoft">{fmtDateTime(a.at)}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        {a.author === "Ines Khrifech" && (
                          <img
                            src="/images/ines-khrifech.jpg"
                            alt="Ines Khrifech"
                            className="h-4 w-4 rounded-full object-cover ring-1 ring-amber-400"
                          />
                        )}
                        {a.author}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Badge>{ENTITY_LABELS[a.entity] ?? a.entity}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Badge tone={ACTION_TONES[a.action] ?? "neutral"}>{a.action}</Badge>
                    </td>
                    <td className="px-4 py-2 text-inksoft">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
