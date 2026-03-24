"use client";

interface DashboardRightRailSection {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "sky" | "emerald" | "amber";
}

interface DashboardRightRailProps {
  eyebrow: string;
  title: string;
  description: string;
  sections: DashboardRightRailSection[];
}

function toneClass(tone: DashboardRightRailSection["tone"]) {
  switch (tone) {
    case "sky":
      return "border-sky-500/20 bg-sky-500/[0.06]";
    case "emerald":
      return "border-emerald-500/20 bg-emerald-500/[0.06]";
    case "amber":
      return "border-amber-500/20 bg-amber-500/[0.06]";
    default:
      return "border-white/8 bg-white/[0.03]";
  }
}

export function DashboardRightRail({
  eyebrow,
  title,
  description,
  sections,
}: DashboardRightRailProps) {
  return (
    <aside className="hidden w-[260px] shrink-0 border-l border-white/5 xl:flex xl:flex-col">
      <div className="h-16 shrink-0 border-b border-white/5 px-6 flex items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-500">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-sm font-medium tracking-[0.08em] text-white uppercase">
            {title}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <p className="mb-4 text-sm leading-6 text-white/42">{description}</p>

        <div className="space-y-3">
          {sections.map((section) => (
            <div
              key={`${section.title}-${section.value}`}
              className={`rounded-2xl border px-4 py-4 ${toneClass(section.tone)}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {section.title}
              </p>
              <p className="mt-2 text-base font-medium text-white">{section.value}</p>
              {section.hint ? (
                <p className="mt-2 text-xs leading-5 text-white/45">{section.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
