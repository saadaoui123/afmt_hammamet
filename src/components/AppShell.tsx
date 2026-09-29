"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Assignment, Database } from "@/lib/types";
import { api, currentAuthor, setAuthor as persistAuthor } from "@/lib/api";
import { Btn, I } from "./ui";
import RecapView from "./views/RecapView";
import PlanningView from "./views/PlanningView";
import GenerationView from "./views/GenerationView";
import DataView from "./views/DataView";
import SettingsView from "./views/SettingsView";
import JournalView from "./views/JournalView";
import LoginScreen, { DEFAULT_USER } from "./LoginScreen";
import { IfmtLogo, AfmtLogo } from "./Logos";

export type View = "recap" | "planning" | "generate" | "data" | "settings" | "journal";

interface Toast {
  id: number;
  msg: string;
  tone: "good" | "danger" | "warn" | "neutral";
}

interface Ctx {
  db: Database | null;
  active: Assignment[];
  loading: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  view: View;
  setView: (v: View) => void;
  refresh: () => Promise<void>;
  toast: (msg: string, tone?: Toast["tone"]) => void;
  author: string;
  changeAuthor: (name: string) => void;
  hasPlanning: boolean;
  logout: () => void;
}

const AppCtx = createContext<Ctx>(null as never);
export const useApp = () => useContext(AppCtx);

const NAV: Array<{ id: View; label: string; icon: React.ReactNode }> = [
  { id: "recap", label: "Récapitulatif", icon: <I.dash className="h-4 w-4" /> },
  { id: "planning", label: "Planning", icon: <I.grid className="h-4 w-4" /> },
  { id: "generate", label: "Génération", icon: <I.wand className="h-4 w-4" /> },
  { id: "data", label: "Données", icon: <I.db className="h-4 w-4" /> },
  { id: "settings", label: "Réglages", icon: <I.sliders className="h-4 w-4" /> },
  { id: "journal", label: "Journal", icon: <I.scroll className="h-4 w-4" /> },
];

let toastSeq = 1;

export default function AppShell() {
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("recap");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [author, setAuthorState] = useState(DEFAULT_USER.name);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const toast = useCallback((msg: string, tone: Toast["tone"] = "neutral") => {
    const id = toastSeq++;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    const data = await api<{ empty?: boolean } & Database>("/api/bootstrap");
    if ((data as { empty?: boolean }).empty) setDb(null);
    else setDb(data as Database);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const isLogged = localStorage.getItem("ifmt-auth-logged");
        const savedAuthor = localStorage.getItem("ifmt-author");
        if (isLogged === "true") {
          setAuthenticated(true);
          setAuthorState(savedAuthor || DEFAULT_USER.name);
        } else {
          setAuthenticated(false);
        }
        await refresh();
      } catch {
        /* réseau indisponible */
      } finally {
        setLoading(false);
        setBootstrapped(true);
      }
    })();
  }, [refresh]);

  const changeAuthor = useCallback((name: string) => {
    setAuthorState(name);
    persistAuthor(name);
  }, []);

  const handleLogin = (user: { name: string; role: string; email: string }) => {
    setAuthorState(user.name);
    persistAuthor(user.name);
    localStorage.setItem("ifmt-auth-logged", "true");
    setAuthenticated(true);
    toast(`Bienvenue, ${user.name} — Session d'administration active.`, "good");
  };

  const handleLogout = () => {
    localStorage.removeItem("ifmt-auth-logged");
    setAuthenticated(false);
    toast("Vous avez été déconnecté(e) avec succès.", "neutral");
  };

  const active = useMemo(
    () => (db && db.settings.activeVersionId ? db.assignments.filter((a) => a.versionId === db.settings!.activeVersionId) : []),
    [db]
  );

  const seed = useCallback(
    async (generate: boolean) => {
      setBusy(true);
      try {
        await api("/api/seed", "POST", { generate, author });
        await refresh();
        toast(generate ? "Données de démonstration chargées et planning généré." : "Données de démonstration chargées.", "good");
        setView(generate ? "recap" : "generate");
      } catch (e) {
        toast((e as Error).message, "danger");
      } finally {
        setBusy(false);
      }
    },
    [author, refresh, toast]
  );

  const value: Ctx = {
    db,
    active,
    loading,
    busy,
    setBusy,
    view,
    setView,
    refresh,
    toast,
    author,
    changeAuthor,
    hasPlanning: active.length > 0,
    logout: handleLogout,
  };

  // Afficher la page de connexion si l'utilisateur n'est pas authentifié
  if (authenticated === false) {
    return (
      <AppCtx.Provider value={value}>
        <LoginScreen onLogin={handleLogin} />
        {/* Toasts */}
        <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto pop-in flex items-start gap-2 rounded-lg border-l-4 border border-line bg-card px-3 py-2.5 text-[13px] font-semibold shadow-lg text-ink"
            >
              <I.info className="h-4 w-4 shrink-0 text-petrol-700" />
              <span className="leading-snug">{t.msg}</span>
            </div>
          ))}
        </div>
      </AppCtx.Provider>
    );
  }

  return (
    <AppCtx.Provider value={value}>
      <div className="flex min-h-screen">
        {/* ------------------------------ Sidebar ------------------------------ */}
        <aside className="no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-petrol-950 text-petrol-100 shadow-xl">
          {/* Logo IFMT Hammamet et entête */}
          <div className="px-4 pb-4 pt-5 border-b border-petrol-900/80">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-1.5 shrink-0 shadow-sm">
                <img
                  src="/images/logo-ifmt.png"
                  alt="IFMT Hammamet"
                  className="h-10 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const p = e.currentTarget.parentElement;
                    if (p) p.querySelector(".svg-fallback")?.classList.remove("hidden");
                  }}
                />
                <div className="svg-fallback hidden">
                  <IfmtLogo className="h-10 w-auto" showText={false} />
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-display text-[15px] font-bold leading-tight text-white truncate">
                  IFMT Hammamet
                </p>
                <p className="text-[10px] text-amber-300 font-semibold tracking-wide">
                  Emplois du temps
                </p>
                <p className="text-[9px] text-petrol-200/70 truncate">
                  Institut Tourisme
                </p>
              </div>
            </div>
          </div>

          {/* Navigation principale */}
          <nav className="flex-1 space-y-0.5 px-3 py-3 overflow-y-auto nice-scroll">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition ${
                  view === n.id
                    ? "bg-petrol-800 text-white shadow-inner"
                    : "text-petrol-200 hover:bg-petrol-900 hover:text-white"
                }`}
              >
                <span className={view === n.id ? "text-brass-100" : "text-petrol-200 group-hover:text-brass-100"}>
                  {n.icon}
                </span>
                {n.label}
                {n.id === "planning" && active.length > 0 && (
                  <span className="ml-auto rounded-full bg-petrol-700 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-petrol-100">
                    {active.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Profil Administrateur Ines Khrifech + Déconnexion */}
          <div className="border-t border-petrol-900/90 bg-petrol-900/40 p-3.5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img
                  src="/images/ines-khrifech.jpg"
                  alt="Ines Khrifech"
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-amber-400 shadow-sm"
                />
                <span
                  className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-petrol-950"
                  title="En ligne"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {author || "Ines Khrifech"}
                </p>
                <p className="text-[10px] text-amber-200/90 truncate leading-tight">
                  Directrice des études
                </p>
                <p className="text-[9px] text-petrol-200/60 truncate">
                  IFMT Hammamet
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Se déconnecter de la session"
                className="p-1.5 rounded-md text-petrol-200 hover:bg-petrol-800 hover:text-red-300 transition"
                aria-label="Se déconnecter"
              >
                <I.x className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-petrol-900/60 text-[10px] text-petrol-200/70">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Session active
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-amber-300 hover:underline font-semibold"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </aside>

        {/* ------------------------------ Main Content ------------------------------ */}
        <main className="ml-64 flex-1 px-6 py-5 lg:px-8">
          {/* Bannière d'en-tête utilisateur */}
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card/90 px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-3">
              <img
                src="/images/ines-khrifech.jpg"
                alt="Ines Khrifech"
                className="h-8 w-8 rounded-full object-cover ring-2 ring-amber-400"
              />
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Session : Ines Khrifech
                  <span className="ml-2 font-normal text-[11px] text-slate-500">
                    (Directrice des Études · IFMT Hammamet)
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-line text-[11px] text-slate-600">
                <span className="font-semibold text-petrol-900">Tutelle :</span>
                <span>AFMT / Ministère du Tourisme</span>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-700 rounded-md px-2.5 py-1 hover:bg-slate-100 transition"
              >
                <I.x className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex h-[60vh] items-center justify-center">
              <div className="flex items-center gap-3 text-inksoft">
                <I.refresh className="h-5 w-5 animate-spin" />
                <span className="text-sm font-semibold">Chargement du planning central…</span>
              </div>
            </div>
          ) : !bootstrapped || db === null ? (
            <Onboarding onSeed={seed} busy={busy} />
          ) : (
            <div className="mx-auto max-w-[1380px]">
              {view === "recap" && <RecapView />}
              {view === "planning" && <PlanningView />}
              {view === "generate" && <GenerationView />}
              {view === "data" && <DataView />}
              {view === "settings" && <SettingsView />}
              {view === "journal" && <JournalView />}
            </div>
          )}
        </main>

        {/* ------------------------------ Toasts ------------------------------ */}
        <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2">
          {toasts.map((t) => {
            const tones = {
              good: "border-good-600 bg-good-50 text-good-700",
              danger: "border-danger-600 bg-danger-50 text-danger-700",
              warn: "border-warn-600 bg-warn-50 text-warn-700",
              neutral: "border-line bg-card text-ink",
            };
            const icons = {
              good: <I.check className="h-4 w-4 shrink-0" />,
              danger: <I.alert className="h-4 w-4 shrink-0" />,
              warn: <I.alert className="h-4 w-4 shrink-0" />,
              neutral: <I.info className="h-4 w-4 shrink-0" />,
            };
            return (
              <div
                key={t.id}
                className={`pointer-events-auto pop-in flex items-start gap-2 rounded-lg border-l-4 border border-line px-3 py-2.5 text-[13px] font-semibold shadow-lg ${tones[t.tone]}`}
              >
                {icons[t.tone]}
                <span className="leading-snug">{t.msg}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AppCtx.Provider>
  );
}

function Onboarding({ onSeed, busy }: { onSeed: (generate: boolean) => void; busy: boolean }) {
  return (
    <div className="flex min-h-[75vh] items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-card p-10 shadow-[0_18px_50px_rgba(14,56,52,0.12)]">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl border border-line shadow-sm shrink-0">
              <img src="/images/logo-afmt.png" alt="Logo AFMT" className="h-11 w-auto object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tutelle AFMT</p>
              <p className="text-xs font-bold text-slate-800">Ministère du Tourisme</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800">
              Système Centralisé de Planification
            </p>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-ink">
              Génération des Emplois du Temps
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">IFMT Hammamet</p>
              <p className="text-xs font-bold text-slate-800">Direction des Études</p>
            </div>
            <div className="bg-white p-2 rounded-xl border border-line shadow-sm shrink-0">
              <img src="/images/logo-ifmt.png" alt="Logo IFMT Hammamet" className="h-11 w-auto object-contain" />
            </div>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-inksoft">
          Bienvenue dans l'espace de planification pédagogique géré par <b>Ines Khrifech</b>.
          Construit un planning hebdomadaire valide pour les niveaux <b>CAP, BTP et BTS</b> en
          respectant la grille pédagogique et les 12 contraintes obligatoires.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => onSeed(true)}
            disabled={busy}
            className="group flex flex-col items-start gap-1 rounded-xl border-2 border-petrol-700 bg-petrol-800 p-4 text-left transition hover:bg-petrol-700 disabled:opacity-50 cursor-pointer"
          >
            <span className="flex items-center gap-2 font-display text-sm font-bold text-white">
              {busy ? <I.refresh className="h-4 w-4 animate-spin" /> : <I.wand className="h-4 w-4 text-brass-100" />}
              Charger la démo et générer
            </span>
            <span className="text-xs text-petrol-100">
              8 formateurs, 6 groupes, 12 matières, 8 salles — planning généré automatiquement.
            </span>
          </button>
          <button
            onClick={() => onSeed(false)}
            disabled={busy}
            className="group flex flex-col items-start gap-1 rounded-xl border-2 border-line bg-card p-4 text-left transition hover:border-petrol-600 disabled:opacity-50 cursor-pointer"
          >
            <span className="flex items-center gap-2 font-display text-sm font-bold text-petrol-800">
              <I.db className="h-4 w-4" />
              Charger la démo seulement
            </span>
            <span className="text-xs text-inksoft">
              Les données sont prêtes, vous déclencherez la génération vous-même.
            </span>
          </button>
        </div>
        <p className="mt-5 text-xs text-inkfaint">
          Toutes les modifications et générations seront signées au nom de <b>Ines Khrifech</b> dans le journal d'audit.
        </p>
      </div>
    </div>
  );
}
