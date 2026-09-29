"use client";
import React, { useState } from "react";
import { useApp } from "@/components/AppShell";
import { Badge, Btn, Card, Field, I, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { WEIGHT_INFO } from "@/lib/format";

export default function SettingsView() {
  const { db, refresh, toast, author } = useApp();
  const [weights, setWeights] = useState<Record<string, number>>(() => ({ ...db?.settings.weights }));
  const [specialRules, setSpecialRules] = useState<{
    pause1214Enabled: boolean;
    after18Enabled: boolean;
    allowedSpecialties: string[];
  }>(() => ({
    pause1214Enabled: db?.settings.specialRules?.pause1214Enabled ?? true,
    after18Enabled: db?.settings.specialRules?.after18Enabled ?? true,
    allowedSpecialties: db?.settings.specialRules?.allowedSpecialties ?? [
      "Cuisine",
      "Pâtisserie",
      "Restaurant",
      "Restauration",
    ],
  }));
  const [newSpecialty, setNewSpecialty] = useState("");
  const [saving, setSaving] = useState(false);
  if (!db) return null;

  const totalW = WEIGHT_INFO.reduce((s, w) => s + (weights[w.key] || 0), 0);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/settings", "PUT", { weights, specialRules, author });
      await refresh();
      toast("Paramètres et règles obligatoires enregistrés avec succès. Ils s'appliqueront à la prochaine génération.", "good");
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const addSpecialty = () => {
    const val = newSpecialty.trim();
    if (val && !specialRules.allowedSpecialties.includes(val)) {
      setSpecialRules({
        ...specialRules,
        allowedSpecialties: [...specialRules.allowedSpecialties, val],
      });
      setNewSpecialty("");
    }
  };

  const removeSpecialty = (s: string) => {
    setSpecialRules({
      ...specialRules,
      allowedSpecialties: specialRules.allowedSpecialties.filter((x) => x !== s),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold">Réglages du moteur</h1>
        <p className="text-sm text-inksoft">
          Paramètres obligatoires des horaires, règles d'exception et pondération des contraintes souples.
        </p>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. RÈGLES SPÉCIALES DES HORAIRES (CONTRAINTES OBLIGATOIRES)     */}
      {/* ------------------------------------------------------------- */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <I.clock className="h-4 w-4 text-amber-700" />
            Règles Spéciales des Horaires (Contraintes Obligatoires du Générateur)
          </span>
        }
        sub="Ces règles sont traitées comme des contraintes strictes. Aucun cours théorique n'est jamais autorisé sur ces créneaux."
      >
        <div className="space-y-4 text-xs">
          {/* Règle 1 : Pause 12h-14h */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="flex items-center gap-2 font-bold text-sm text-amber-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specialRules.pause1214Enabled}
                    onChange={(e) =>
                      setSpecialRules({ ...specialRules, pause1214Enabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-amber-300 text-amber-700 focus:ring-amber-600"
                  />
                  <span>1. Règle de la Pause 12h00 → 14h00</span>
                </label>
                <p className="text-amber-800/90 text-xs mt-1 leading-relaxed">
                  <b>Par défaut :</b> Aucun cours ne doit être programmé entre 12h00 et 14h00 (pause obligatoire).<br />
                  <b>Exception autorisée :</b> Seules les séances pratiques (TP) des spécialités autorisées ci-dessous
                  peuvent continuer leur activité entre 12h00 et 14h00.
                </p>
              </div>
              <Badge tone={specialRules.pause1214Enabled ? "brass" : "neutral"}>
                {specialRules.pause1214Enabled ? "Règle Active" : "Désactivée"}
              </Badge>
            </div>
          </div>

          {/* Règle 2 : Après 18h00 */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="flex items-center gap-2 font-bold text-sm text-sky-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specialRules.after18Enabled}
                    onChange={(e) =>
                      setSpecialRules({ ...specialRules, after18Enabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-sky-300 text-sky-700 focus:ring-sky-600"
                  />
                  <span>2. Règle du créneau après 18h00 (18h00 → 20h00)</span>
                </label>
                <p className="text-sky-800/90 text-xs mt-1 leading-relaxed">
                  <b>Par défaut :</b> Aucun cours normal après 18h00.<br />
                  <b>Exception autorisée :</b> Seuls les groupes pratiques (TP) des spécialités autorisées
                  peuvent continuer leur activité jusqu'à 20h00.
                </p>
              </div>
              <Badge tone={specialRules.after18Enabled ? "petrol" : "neutral"}>
                {specialRules.after18Enabled ? "Règle Active" : "Désactivée"}
              </Badge>
            </div>
          </div>

          {/* Spécialités autorisées par exception */}
          <div className="rounded-xl border border-line bg-card p-4 space-y-2">
            <p className="font-bold text-slate-800 text-xs">
              3. Spécialités autorisées par exception pour les créneaux 12h–14h et après 18h (TP uniquement) :
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {specialRules.allowedSpecialties.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-1 text-xs font-bold"
                >
                  <I.check className="h-3.5 w-3.5 text-teal-700" />
                  <span>TP {s}</span>
                  <button
                    type="button"
                    onClick={() => removeSpecialty(s)}
                    className="hover:text-red-700 text-slate-400 font-bold ml-1"
                    title={`Retirer l'exception pour ${s}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Input
                placeholder="Ajouter une spécialité autorisée (ex : Pâtisserie, Service...)"
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSpecialty())}
                className="max-w-sm !py-1.5 text-xs"
              />
              <Btn size="sm" variant="ghost" onClick={addSpecialty} disabled={!newSpecialty.trim()}>
                <I.plus className="h-3.5 w-3.5" /> Ajouter
              </Btn>
            </div>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* 2. PONDÉRATION DES CONTRAINTES SOUPLES                         */}
      {/* ------------------------------------------------------------- */}
      <Card title="Poids des contraintes souples (0 = ignorée, 10 = prioritaire)" sub={`poids total : ${totalW}`}>
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          {WEIGHT_INFO.map((w) => {
            const v = weights[w.key] ?? 0;
            return (
              <div key={w.key}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-bold">{w.label}</p>
                  <span className="rounded-md bg-petrol-100 px-2 py-0.5 font-display text-sm font-bold tabular-nums text-petrol-900">{v}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={v}
                  onChange={(e) => setWeights({ ...weights, [w.key]: Number(e.target.value) })}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-inksoft">{w.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-linesoft pt-4">
          <p className="max-w-md text-xs text-inkfaint">
            Exemple : pour un établissement qui veut des semaines compactes et peu de jours « percés », élevez <b>Compacité</b> et{" "}
            <b>Heures creuses</b>.
          </p>
          <Btn onClick={save} disabled={saving}>
            {saving ? <I.refresh className="h-4 w-4 animate-spin" /> : <I.save className="h-4 w-4" />}
            Enregistrer tous les paramètres
          </Btn>
        </div>
      </Card>

      <Card title="Comment le score est calculé" sub="chaque critère est noté de 0 à 100, la moyenne pondérée forme le score de qualité affiché">
        <ul className="space-y-2 text-[13px] text-inksoft">
          {WEIGHT_INFO.map((w) => (
            <li key={w.key} className="flex gap-2">
              <I.check className="mt-0.5 h-4 w-4 shrink-0 text-petrol-600" />
              <span>
                <b>{w.label}</b> — {w.desc}
              </span>
            </li>
          ))}
          <li className="flex gap-2">
            <I.info className="mt-0.5 h-4 w-4 shrink-0 text-brass-600" />
            <span>
              Les règles spéciales des horaires (pause 12h–14h et créneaux après 18h réservés exclusivement aux TP Cuisine, Pâtisserie et Restaurant)
              sont des <b>contraintes obligatoires prioritaires</b> : elles ne sont jamais violées.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
