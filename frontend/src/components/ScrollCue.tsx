"use client";

interface ScrollCueProps {
  href: string;
  label: string;
  caption?: string;
  align?: "right" | "center";
  className?: string;
}

export function ScrollCue({
  href,
  label,
  caption = "Scroll",
  align = "center",
  className = ""
}: ScrollCueProps) {
  const alignmentClass =
    align === "right"
      ? "absolute right-5 top-1/2 z-20 -translate-y-1/2 sm:right-8"
      : "mx-auto mt-10";

  return (
    <a
      href={href}
      className={`group flex items-center gap-3 rounded-full border border-white/10 bg-[#07111a]/60 px-3 py-3 backdrop-blur-xl transition-all duration-300 hover:border-[#7bb8ff]/30 hover:bg-[#0a1520]/80 ${alignmentClass} ${className}`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        <svg
          className="h-4 w-4 text-white/70 transition-transform duration-300 group-hover:translate-y-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-6-6m6 6l6-6" />
        </svg>
      </div>
      <div className={align === "right" ? "text-right" : "text-left"}>
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/30">{caption}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/70">{label}</p>
      </div>
    </a>
  );
}
