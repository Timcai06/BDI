import type { AppPhase } from "@/lib/types";

const phaseStyleMap: Record<AppPhase, string> = {
  idle: "border-slate-300 bg-white text-slate-700",
  uploading: "border-sky-300 bg-sky-50 text-sky-800",
  running: "border-amber-300 bg-amber-50 text-amber-800",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  error: "border-rose-300 bg-rose-50 text-rose-800"
};

const phaseLabelMap: Record<AppPhase, string> = {
  idle: "待命",
  uploading: "上传中",
  running: "推理中",
  success: "已完成",
  error: "失败"
};

interface StatusCardProps {
  phase: AppPhase;
  message: string;
}

export function StatusCard({ phase, message }: StatusCardProps) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${phaseStyleMap[phase]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-current/70">
            Current Status
          </p>
          <h3 className="mt-2 text-xl font-semibold">{phaseLabelMap[phase]}</h3>
        </div>
        <span className="rounded-full border border-current/20 px-3 py-1 text-sm font-medium">
          {phaseLabelMap[phase]}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-current/80">{message}</p>
    </div>
  );
}
