import { getDefectLabel } from "@/lib/defect-visuals";
import { formatDetectionSourceLabel } from "@/lib/model-labels";
import type { Detection } from "@/lib/types";

interface FocusedDetectionHudProps {
  detection: Detection | null;
}

export function FocusedDetectionHud({ detection }: FocusedDetectionHudProps) {
  return (
    <div
      className={`mt-5 overflow-hidden transition-all duration-500 ${
        detection ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
      }`}
    >
      <div className="relative flex items-center gap-5 rounded-2xl border border-[#00D2FF]/20 bg-[#00D2FF]/5 p-3.5 group">
        <div className="absolute inset-0 bg-gradient-to-r from-[#00D2FF]/5 via-transparent to-transparent pointer-events-none" />
        <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#00D2FF]/10 border border-[#00D2FF]/20">
          <svg className="h-6 w-6 text-[#00D2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
          </svg>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/60">病害类别</p>
            <p className="text-sm font-semibold text-white">{detection ? getDefectLabel(detection.category) : "--"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/60">识别置信度</p>
            <p className="text-sm font-mono text-[#00D2FF] font-bold">
              {detection ? `${(detection.confidence * 100).toFixed(1)}%` : "--"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/60">预估长度 (cm)</p>
            <p className="text-sm font-mono text-slate-200">
              {detection?.metrics.length_mm ? (detection.metrics.length_mm / 10).toFixed(1) : "--"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/60">预估面积 (cm²)</p>
            <p className="text-sm font-mono text-[#7FFFD4] font-bold">
              {detection?.metrics.area_mm2 ? (detection.metrics.area_mm2 / 100).toFixed(1) : "--"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/60">检测来源</p>
            <p className="text-sm font-semibold text-white">
              {formatDetectionSourceLabel(detection?.source_role) ?? "当前模型"}
            </p>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1 shrink-0 ml-auto border-l border-white/10 pl-6">
          <span className="text-[8px] text-white/30 uppercase tracking-[0.2em]">Sensor Ready</span>
          <div className="h-1.5 w-8 rounded-full bg-[#00D2FF]/20 overflow-hidden">
            <div className="h-full w-[85%] bg-[#00D2FF] shadow-[0_0_8px_#00D2FF]" />
          </div>
        </div>
      </div>
    </div>
  );
}
