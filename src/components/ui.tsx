import React from "react";
import { scoreTone } from "@/lib/format";

/* ------------------------------- Icônes SVG ------------------------------- */

const ic = (path: React.ReactNode, vb = "0 0 24 24") =>
  function Icon({ className = "w-4 h-4" }: { className?: string }) {
    return (
      <svg viewBox={vb} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
        {path}
      </svg>
    );
  };

export const I = {
  lock: ic(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>),
  dash: ic(<><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>),
  grid: ic(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M9 4v17" /></>),
  wand: ic(<><path d="M5 19L16 8" /><path d="M14 4l1.2 2.4L17.6 7.6l-2.4 1.2L14 11.2 12.8 8.8 10.4 7.6l2.4-1.2z" /><path d="M19 12l.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8z" /><path d="M6 3l.6 1.2L8 4.8 6.6 5.4 6 6.6 5.4 5.4 4 4.8l1.4-.6z" /></>),
  db: ic(<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>),
  sliders: ic(<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h13M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="19" cy="18" r="2" /></>),
  scroll: ic(<><path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" /><path d="M8 8h8M8 12h8M8 16h5" /></>),
  plus: ic(<path d="M12 5v14M5 12h14" />),
  trash: ic(<><path d="M4 7h16" /><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" /><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></>),
  edit: ic(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></>),
  x: ic(<path d="M6 6l12 12M18 6L6 18" />),
  check: ic(<path d="M4 12.5l5 5L20 6.5" />),
  alert: ic(<><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18.2v.1" /></>),
  info: ic(<><circle cx="12" cy="12" r="9" /><path d="M12 8v.1M12 11v6" /></>),
  download: ic(<><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></>),
  print: ic(<><path d="M7 8V3h10v5" /><rect x="4" y="8" width="16" height="9" rx="1.5" /><path d="M7 14h10v7H7z" /></>),
  clock: ic(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>),
  user: ic(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
  room: ic(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 14h6v6" /></>),
  chevron: ic(<path d="M8 10l4 4 4-4" />),
  refresh: ic(<><path d="M20 12a8 8 0 11-2.34-5.66" /><path d="M20 4v4h-4" /></>),
  compare: ic(<><path d="M9 4v12" /><path d="M6 7l3-3 3 3" /><path d="M15 20V8" /><path d="M12 17l3 3 3-3" /><path d="M3 20h6M15 4h6" /></>),
  save: ic(<><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3" /><rect x="8" y="13" width="8" height="6" /></>),
  play: ic(<path d="M7 4l13 8-13 8z" />),
  eye: ic(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>),
  book: ic(<><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" /><path d="M4 19a2 2 0 012-2h13" /></>),
  users: ic(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1.2-3.2 3.7-5 6.5-5s5.3 1.8 6.5 5" /><circle cx="17" cy="9" r="2.6" /><path d="M16 14.6c2.5.3 4.5 2 5.4 4.4" /></>),
  spark: ic(<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />),
};

/* ------------------------------- Primitives ------------------------------- */

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  title,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "subtle" | "brass";
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-100 select-none disabled:opacity-45 disabled:cursor-not-allowed";
  const sizes = { sm: "text-xs px-2.5 py-1.5", md: "text-sm px-3.5 py-2" };
  const variants = {
    primary: "bg-petrol-800 text-petrol-50 hover:bg-petrol-700 active:translate-y-px shadow-sm",
    brass: "bg-brass-600 text-white hover:bg-brass-700 active:translate-y-px shadow-sm",
    ghost: "border border-line bg-card text-ink hover:border-petrol-600 hover:text-petrol-800",
    subtle: "text-inksoft hover:bg-linesoft/60 hover:text-ink",
    danger: "bg-danger-600 text-white hover:bg-danger-700 active:translate-y-px shadow-sm",
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-inksoft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-inkfaint">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition focus:border-petrol-600 focus:ring-2 focus:ring-petrol-100 placeholder:text-inkfaint";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function NumInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" {...props} className={`${inputCls} tabular-nums ${props.className ?? ""}`} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} appearance-none pr-8 ${props.className ?? ""}`} />;
}

export function Badge({ children, tone = "neutral", className = "" }: { children: React.ReactNode; tone?: "neutral" | "petrol" | "brass" | "danger" | "good" | "warn"; className?: string }) {
  const tones = {
    neutral: "bg-linesoft text-inksoft",
    petrol: "bg-petrol-100 text-petrol-800",
    brass: "bg-brass-100 text-brass-700",
    danger: "bg-danger-100 text-danger-700",
    good: "bg-good-100 text-good-700",
    warn: "bg-warn-100 text-warn-700",
  };
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${tones[tone]} ${className}`}>{children}</span>;
}

export function Card({ title, sub, actions, children, className = "", pad = true }: { title?: React.ReactNode; sub?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded-xl border border-line bg-card shadow-[0_1px_2px_rgba(33,43,44,0.05)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-linesoft px-4 py-3">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
            {sub && <p className="text-xs text-inksoft">{sub}</p>}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "neutral" }: { label: string; value: React.ReactNode; sub?: string; tone?: "neutral" | "good" | "warn" | "danger" | "petrol" }) {
  const tones = {
    neutral: "text-ink",
    good: "text-good-700",
    warn: "text-warn-700",
    danger: "text-danger-700",
    petrol: "text-petrol-800",
  };
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-inksoft">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-inkfaint">{sub}</p>}
    </div>
  );
}

export function Bar({ value, max, tone = "petrol" }: { value: number; max: number; tone?: "petrol" | "brass" | "danger" | "good" | "warn" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tones = {
    petrol: "bg-petrol-600",
    brass: "bg-brass-600",
    danger: "bg-danger-600",
    good: "bg-good-600",
    warn: "bg-warn-600",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-linesoft">
      <div className={`h-full rounded-full ${tones[tone]} transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const tone = scoreTone(score);
  const color = tone === "good" ? "#3a7d44" : tone === "ok" ? "#a96f1c" : "#b3402e";
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e1dbcb" strokeWidth="7" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-all duration-500" />
      </svg>
      <span className="absolute font-display text-lg font-bold tabular-nums" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

export function Modal({ title, sub, onClose, children, footer, wide }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-petrol-950/45 p-4 pt-[6vh] fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`pop-in w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-xl border border-line bg-card shadow-2xl`}>
        <header className="flex items-start justify-between border-b border-linesoft px-5 py-3.5">
          <div>
            <h3 className="font-display text-base font-semibold">{title}</h3>
            {sub && <p className="text-xs text-inksoft">{sub}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-inksoft hover:bg-linesoft hover:text-ink" aria-label="Fermer">
            <I.x className="h-4.5 w-4.5" />
          </button>
        </header>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4 nice-scroll">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-linesoft px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, children }: { icon?: React.ReactNode; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card/60 px-6 py-10 text-center">
      <div className="text-petrol-600">{icon ?? <I.info className="h-8 w-8" />}</div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {text && <p className="max-w-md text-sm text-inksoft">{text}</p>}
      {children && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

export function SegTabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string; icon?: React.ReactNode }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-linesoft/50 p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
            value === t.id ? "bg-card text-petrol-800 shadow-sm" : "text-inksoft hover:text-ink"
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
