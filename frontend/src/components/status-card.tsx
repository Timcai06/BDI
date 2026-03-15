import type { AppPhase } from "@/lib/types";

const phaseStyleMap: Record<AppPhase, string> = {
  idle: "border-white/10 bg-white/[0.02] text-slate-400 shadow-none",
  uploading: "border-sky-500/30 bg-sky-500/10 text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.1)]",
  running: "border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]",
  error: "border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
};

const phaseLabelMap: Record<AppPhase, string> = {
  idle: "待开始",
  uploading: "上传中",
  running: "识别中",
  success: "已完成",
  error: "失败"
};

interface StatusCardProps {
  phase: AppPhase;
  message: string;
  progress?: number; // 0-100
  uploadSpeed?: string; // e.g. "2.5 MB/s"
}

export function StatusCard({ phase, message, progress, uploadSpeed }: StatusCardProps) {
  const showProgress = phase === "uploading" || phase === "running";
  const progressPercent = Math.min(100, Math.max(0, progress ?? 0));

  return (
    <div className={`rounded-xl border p-4 transition-all duration-300 ${phaseStyleMap[phase]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Status Indicator Dot */}
          <div className="relative flex h-2.5 w-2.5">
            {phase !== "idle" && phase !== "error" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
            )}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
          </div>
          <h3 className="text-sm font-mono font-bold tracking-wide">{phaseLabelMap[phase]}</h3>
        </div>
        
        {/* Progress percentage */}
        {showProgress && progress !== undefined && (
          <span className="text-xs font-mono font-semibold">{Math.round(progressPercent)}%</span>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="mt-3">
          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full bg-current transition-all duration-300 ease-out"
              style={{ 
                width: `${progressPercent}%`,
                boxShadow: '0 0 10px currentColor'
              }}
            />
          </div>
          {uploadSpeed && phase === "uploading" && (
            <p className="mt-2 text-[10px] font-mono text-current/60">{uploadSpeed}</p>
          )}
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-current/80 opacity-90">{message}</p>
    </div>
  );
}
