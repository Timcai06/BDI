import type { ReactNode } from "react";

interface OpsPageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  accent?: "cyan" | "amber" | "rose" | "slate" | "emerald";
  actions?: ReactNode;
}

const accentClasses: Record<NonNullable<OpsPageHeaderProps["accent"]>, { dot: string; text: string }> = {
  cyan: {
    dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]",
    text: "text-cyan-400/80",
  },
  amber: {
    dot: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]",
    text: "text-amber-500",
  },
  rose: {
    dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]",
    text: "text-rose-400",
  },
  slate: {
    dot: "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.8)]",
    text: "text-slate-400/60",
  },
  emerald: {
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
    text: "text-emerald-400",
  },
};

export function OpsPageHeader({
  eyebrow,
  title,
  subtitle,
  accent = "cyan",
  actions,
}: OpsPageHeaderProps) {
  const tone = accentClasses[accent];

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${tone.dot}`} />
          <p className={`m-0 text-[10px] font-bold uppercase tracking-[0.3em] ${tone.text}`}>
            {eyebrow}
          </p>
        </div>
        <h1 className="text-xl font-black tracking-tight text-white uppercase lg:text-3xl">{title}</h1>
        {subtitle ? (
          <div className="mt-1 text-xs uppercase tracking-widest text-white/40">{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  );
}
