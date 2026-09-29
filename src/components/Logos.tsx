import React from "react";

/**
 * Logo officiel de l'Institut de Formation dans les Métiers du Tourisme (IFMT) - Hammamet
 * Reproduit fidèlement la géométrie officielle :
 * - Mortier/toque universitaire bleu roi
 * - Piliers géométriques facettés (bleu, turquoise, ambre/or, prune/magenta)
 * - Typographie bold 'FMT' et 'HAMMAMET'
 * - Mentions bilingues arabe et français
 */
export function IfmtLogo({ className = "h-16 w-auto", showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg viewBox="0 0 420 180" className="w-full h-auto max-h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Toque universitaire (Mortarboard cap) */}
        <path d="M42 12 L78 28 L42 44 L6 28 Z" fill="#1e3a8a" />
        <path d="M42 12 L78 28 L42 32 L6 28 Z" fill="#2563eb" />
        {/* Calotte */}
        <path d="M22 36 L22 52 C22 62, 62 62, 62 52 L62 36 Z" fill="#1e40af" />
        {/* Pompon et cordon */}
        <path d="M72 29 Q82 38, 79 58" stroke="#1d4ed8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="79" cy="60" r="3.5" fill="#f59e0b" />

        {/* Pilier facetté formant le 'I' de IFMT */}
        <polygon points="12,66 42,66 42,112 12,98" fill="#0284c7" />
        <polygon points="42,66 72,66 72,98 42,112" fill="#1d4ed8" />
        <polygon points="12,98 42,112 42,142 12,126" fill="#f59e0b" />
        <polygon points="42,112 72,98 72,126 42,142" fill="#0284c7" />
        <polygon points="12,126 42,142 42,176 12,176" fill="#9d174d" />
        <polygon points="42,142 72,126 72,176 42,176" fill="#701a75" />

        {/* Lettres FMT */}
        {/* F */}
        <path d="M96 66 H160 V88 H124 V108 H154 V128 H124 V176 H96 Z" fill="#1e40af" />
        {/* M */}
        <path d="M174 66 H204 L226 126 L248 66 H278 V176 H252 V114 L234 162 H218 L200 114 V176 H174 Z" fill="#1e40af" />
        {/* T */}
        <path d="M288 66 H368 V88 H342 V176 H314 V88 H288 Z" fill="#1e40af" />

        {/* HAMMAMET */}
        <text x="232" y="168" textAnchor="middle" fill="#1e3a8a" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="23" letterSpacing="5">
          HAMMAMET
        </text>
      </svg>

      {showText && (
        <div className="w-full text-center mt-1 pt-1 border-t border-slate-300">
          <p className="text-[12px] font-bold text-slate-800 tracking-wide font-sans leading-tight">
            معهد التكوين في مهن السياحة بالحمامات
          </p>
          <p className="text-[10px] font-medium text-slate-700 tracking-tight leading-tight mt-0.5">
            — Institut de Formation dans les Métiers du Tourisme Hammamet —
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Logo officiel de l'AFMT (Agence de Formation dans les Métiers du Tourisme - Tutelle)
 */
export function AfmtLogo({ className = "h-14 w-auto", showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg viewBox="0 0 380 140" className="w-full h-auto max-h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Arc dynamique / Aile dorée et argentée */}
        <path
          d="M250 8 C320 12, 375 48, 320 102 C300 120, 260 128, 220 122 C290 120, 360 85, 335 32 C320 8, 280 4, 250 8 Z"
          fill="#eab308"
        />
        <path
          d="M260 18 C305 24, 345 52, 325 82 C340 50, 310 24, 270 20 Z"
          fill="#94a3b8"
        />

        {/* Lettres dynamiques AFMT en bleu cyan */}
        {/* A */}
        <path d="M50 110 L115 18 H145 L110 75 H165 L155 93 H100 L90 110 H50 Z" fill="#0284c7" />
        <path d="M125 40 L112 60 H140 Z" fill="#ffffff" />
        {/* F */}
        <path d="M145 18 H230 L222 36 H172 L164 54 H214 L206 72 H156 L138 110 H112 Z" fill="#0284c7" />
        {/* M */}
        <path d="M15 110 L45 68 L70 96 L108 50 L86 110 H60 L50 94 L36 110 Z" fill="#0369a1" opacity="0.9" />
        {/* T */}
        <path d="M185 75 H260 L252 93 H232 L224 110 H198 L206 93 H186 Z" fill="#0284c7" />

        {/* Ligne jaune d'accent */}
        <rect x="10" y="128" width="360" height="4" rx="2" fill="#eab308" />
      </svg>

      {showText && (
        <div className="w-full text-center mt-1">
          <p className="text-[11px] font-bold text-slate-600 leading-tight">
            وكالة التكوين في مهن السياحة
          </p>
          <p className="text-[10px] font-semibold text-sky-800 leading-tight">
            Agence de Formation dans les Métiers du Tourisme
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Avatar officiel de Ines Khrifech avec photo et badge de statut
 */
export function InesAvatar({ size = "md", withBadge = true }: { size?: "sm" | "md" | "lg" | "xl"; withBadge?: boolean }) {
  const sizes = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-20 w-20",
    xl: "h-28 w-28",
  };
  const imgSizes = {
    sm: "w-9 h-9",
    md: "w-12 h-12",
    lg: "w-20 h-20",
    xl: "w-28 h-28",
  };
  return (
    <div className={`relative inline-block ${sizes[size]} shrink-0`}>
      <img
        src="/images/ines-khrifech.jpg"
        alt="Ines Khrifech — Directrice des études IFMT Hammamet"
        className={`${imgSizes[size]} rounded-full object-cover ring-2 ring-amber-400/80 shadow-md`}
        onError={(e) => {
          // Fallback if image load fails
          const target = e.currentTarget;
          target.style.display = "none";
          if (target.parentElement) {
            const fallback = target.parentElement.querySelector(".avatar-fallback");
            if (fallback) fallback.classList.remove("hidden");
          }
        }}
      />
      <div className="avatar-fallback hidden flex items-center justify-center w-full h-full rounded-full bg-amber-100 text-amber-900 font-bold border-2 border-amber-400">
        IK
      </div>
      {withBadge && (
        <span
          className="absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white"
          title="Session active"
        />
      )}
    </div>
  );
}
