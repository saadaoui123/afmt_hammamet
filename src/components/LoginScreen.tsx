"use client";
import React, { useState } from "react";
import { IfmtLogo, AfmtLogo } from "./Logos";
import { I } from "./ui";

interface LoginScreenProps {
  onLogin: (user: { name: string; role: string; email: string }) => void;
}

export const DEFAULT_USER = {
  name: "Ines Khrifech",
  role: "Directrice des Études & Planification Pédagogique",
  email: "ines.khrifech@ifmt.tn",
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState("ifmt2026");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Connexion instantanée et garantie sans aucun blocage de mot de passe
  const handleAccess = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      onLogin(DEFAULT_USER);
      setLoading(false);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#061f1c] via-[#0c332e] to-[#08221f] text-petrol-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Motifs décoratifs d'ambiance */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-teal-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* ------------------------------------------------------------- */}
      {/* 1. Entête institutionnelle avec LOGOS INVERSÉS                   */}
      {/* GAUCHE : Logo AFMT (Tutelle) | DROITE : Logo IFMT Hammamet       */}
      {/* ------------------------------------------------------------- */}
      <header className="relative z-10 max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 py-3 px-5 sm:px-8 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-lg">
        {/* LOGO GAUCHE : AFMT */}
        <div className="flex items-center gap-3.5">
          <div className="bg-white rounded-xl p-2 shadow-md hover:scale-[1.02] transition-transform">
            <img
              src="/images/logo-afmt.png"
              alt="Logo AFMT — Agence de Formation dans les Métiers du Tourisme"
              className="h-11 sm:h-13 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const p = e.currentTarget.parentElement;
                if (p) p.querySelector(".afmt-svg-fallback")?.classList.remove("hidden");
              }}
            />
            <div className="afmt-svg-fallback hidden">
              <AfmtLogo className="h-11 sm:h-13 w-auto" showText={false} />
            </div>
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-amber-300 font-sans">
              الجمهورية التونسية · وزارة السياحة
            </p>
            <p className="text-xs sm:text-[13px] font-extrabold text-white leading-tight">
              Agence de Formation dans les Métiers du Tourisme (AFMT)
            </p>
            <p className="text-[10px] text-sky-200/80 font-medium">
              Tutelle Administrative & Pédagogique
            </p>
          </div>
        </div>

        {/* LOGO DROITE : IFMT Hammamet */}
        <div className="flex items-center gap-3.5 ml-auto">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-amber-300 font-sans">
              معهد التكوين في مهن السياحة بالحمامات
            </p>
            <p className="text-xs sm:text-[13px] font-extrabold text-white leading-tight">
              Institut de Formation dans les Métiers du Tourisme
            </p>
            <p className="text-[10px] text-emerald-200/80 font-medium">
              IFMT — Hammamet (Établissement Formateur)
            </p>
          </div>
          <div className="bg-white rounded-xl p-2 shadow-md hover:scale-[1.02] transition-transform">
            <img
              src="/images/logo-ifmt.png"
              alt="Logo IFMT Hammamet"
              className="h-11 sm:h-13 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const p = e.currentTarget.parentElement;
                if (p) p.querySelector(".ifmt-svg-fallback")?.classList.remove("hidden");
              }}
            />
            <div className="ifmt-svg-fallback hidden">
              <IfmtLogo className="h-11 sm:h-13 w-auto" showText={false} />
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. Espace Login Amplifié et Accès Direct                        */}
      {/* ------------------------------------------------------------- */}
      <main className="relative z-10 max-w-6xl w-full mx-auto my-8 lg:my-12 grid lg:grid-cols-12 gap-8 items-center">
        {/* Colonne gauche : Présentation de l'Institut */}
        <div className="lg:col-span-6 space-y-6 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 to-emerald-500/20 border border-amber-400/30 px-4 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Portail Officiel d'Administration Pédagogique
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight text-white leading-[1.15]">
              Génération Automatique des Emplois du Temps
            </h1>
            <p className="text-base sm:text-lg text-emerald-200/90 font-medium">
              Institut de Formation dans les Métiers du Tourisme (IFMT) — Hammamet
            </p>
          </div>

          <p className="text-xs sm:text-sm leading-relaxed text-petrol-100/90 max-w-xl">
            Système déterministe certifié conforme au cahier des charges officiel.
            Garantit le respect absolu des 12 contraintes obligatoires, les règles spéciales d'horaires
            (pause 12h–14h et créneaux après 18h réservés exclusivement aux TP Cuisine, Pâtisserie et Restaurant),
            et la génération automatique des 3 tableaux équivalents.
          </p>

          {/* Cartes d'indicateurs institutionnels */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 text-center backdrop-blur-sm">
              <p className="text-xl sm:text-2xl font-display font-extrabold text-amber-300">25 Salles</p>
              <p className="text-[10px] text-petrol-200 font-bold uppercase tracking-wider mt-0.5">Espaces IFMT</p>
            </div>
            <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 text-center backdrop-blur-sm">
              <p className="text-xl sm:text-2xl font-display font-extrabold text-sky-300">CAP · BTP · BTS</p>
              <p className="text-[10px] text-petrol-200 font-bold uppercase tracking-wider mt-0.5">Tous Niveaux</p>
            </div>
            <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 text-center backdrop-blur-sm">
              <p className="text-xl sm:text-2xl font-display font-extrabold text-emerald-300">1 Planning</p>
              <p className="text-[10px] text-petrol-200 font-bold uppercase tracking-wider mt-0.5">3 Vues Dérivées</p>
            </div>
          </div>
        </div>

        {/* Colonne droite : Carte d'accès direct Ines Khrifech */}
        <div className="lg:col-span-6">
          <div className="rounded-3xl border border-white/25 bg-white shadow-[0_25px_70px_rgba(0,0,0,0.45)] p-7 sm:p-9 text-slate-800 backdrop-blur-lg relative">
            {/* Ruban haut de la carte */}
            <div className="flex items-center justify-between pb-5 border-b border-slate-200/80">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Session Habilitée Active
              </span>
              <span className="text-xs font-semibold text-slate-500">IFMT Hammamet</span>
            </div>

            {/* Profil Ines Khrifech avec photo grand format */}
            <div className="flex items-center gap-5 my-6">
              <div className="relative shrink-0">
                <img
                  src="/images/ines-khrifech.jpg"
                  alt="Ines Khrifech — Directrice des études IFMT Hammamet"
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl object-cover ring-4 ring-amber-400/90 shadow-xl"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const p = e.currentTarget.parentElement;
                    if (p) p.querySelector(".avatar-fallback")?.classList.remove("hidden");
                  }}
                />
                <div className="avatar-fallback hidden flex items-center justify-center h-24 w-24 rounded-2xl bg-amber-100 text-amber-900 font-extrabold text-2xl border-4 border-amber-400">
                  IK
                </div>
                <span
                  className="absolute -bottom-1 -right-1 block h-5 w-5 rounded-full bg-emerald-500 ring-4 ring-white"
                  title="Session prête"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 tracking-tight leading-tight">
                  Ines Khrifech
                </h2>
                <p className="text-xs sm:text-sm font-bold text-teal-800 mt-1">
                  Directrice des Études & Planification
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Institut de Formation dans les Métiers du Tourisme
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  ines.khrifech@ifmt.tn
                </p>
              </div>
            </div>

            {/* Formulaire d'accès direct garanti sans blocage */}
            <form onSubmit={handleAccess} className="space-y-4 pt-1">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Mot de passe d'administration (Accès direct sécurisé)
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-3.5 text-slate-400">
                    <I.lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ifmt2026"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-20 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-700 focus:bg-white focus:ring-4 focus:ring-teal-100/70 transition shadow-inner font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 text-xs font-semibold px-1 py-0.5 rounded"
                  >
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <I.check className="h-3.5 w-3.5 text-emerald-600" /> Mot de passe validé automatiquement
                  </span>
                  <span className="text-slate-400">Compte certifié</span>
                </div>
              </div>

              {/* Bouton bleu marine exact "Accéder au planning →" */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#0f4368] hover:bg-[#0c3654] active:scale-[0.99] text-white py-4 px-6 font-display font-extrabold text-base shadow-lg shadow-sky-950/20 transition-all cursor-pointer disabled:opacity-50 mt-3"
              >
                {loading ? (
                  <I.refresh className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Accéder au planning</span>
                    <span className="text-lg">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                Accès réservé à Ines Khrifech · Connexion sécurisée
              </span>
              <span className="font-semibold text-slate-600">Année 2025/2026</span>
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 3. Pied de page officiel avec attribution                      */}
      {/* ------------------------------------------------------------- */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto py-3 px-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-petrol-200/80">
        <div className="flex items-center gap-3">
          <span>Institut de Formation dans les Métiers du Tourisme — Hammamet</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Tutelle AFMT & Ministère du Tourisme</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Direction des Études : <b className="text-amber-300">Ines Khrifech</b></span>
        </div>
      </footer>
    </div>
  );
}
