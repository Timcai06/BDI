import { StatusCard } from "@/components/status-card";
import { getDefectLabel } from "@/lib/defect-visuals";
import type { Detection, PredictState, PredictionResult } from "@/lib/types";

interface ResultDashboardInsightsProps {
  categories: string[];
  categoryFilter: string;
  currentDetection: Detection | null;
  minConfidence: number;
  onCategoryFilterChange: (category: string) => void;
  onMinConfidenceChange: (confidence: number) => void;
  result: PredictionResult;
  status: PredictState;
  uploadProgress?: number;
  viewMode: "image" | "result" | "mask";
}

function formatBreakdownLabel(key: string): string {
  const labels: Record<string, string> = {
    pre: "前处理 (I/O & Pre)",
    model: "核心推理 (YOLO Engine)",
    post: "后处理 (Metrics & Result Image)",
    primary_model: "通用模型推理",
    specialist_model: "专项模型推理",
    fusion_post: "融合后处理",
  };

  return labels[key] ?? key.replace(/_/g, " ");
}

function getBreakdownTone(key: string): "accent" | "muted" {
  if (key === "model" || key === "primary_model" || key === "specialist_model") {
    return "accent";
  }
  return "muted";
}

export function ResultDashboardInsights({
  categories,
  categoryFilter,
  currentDetection,
  minConfidence,
  onCategoryFilterChange,
  onMinConfidenceChange,
  result,
  status,
  uploadProgress,
  viewMode,
}: ResultDashboardInsightsProps) {
  return (
    <aside className="relative z-10 flex w-full shrink-0 flex-col gap-5 self-start xl:sticky xl:top-0 xl:w-[400px]">
      <div className="group relative shrink-0 overflow-hidden rounded-[2rem] border border-[#00D2FF]/20 bg-[linear-gradient(145deg,rgba(5,8,10,0.95),rgba(5,8,10,0.8))] p-5 shadow-[0_0_40px_rgba(0,210,255,0.1)] backdrop-blur-xl">
        <div className="absolute -inset-[1px] z-[-1] bg-gradient-to-br from-[#00D2FF]/20 to-[#7FFFD4]/0 opacity-50" />

        <div className="mb-6">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/60">核心数据指标</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06]">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/50">主病害</p>
              <p className="truncate text-sm font-medium text-white">
                {currentDetection ? getDefectLabel(currentDetection.category) : "暂无"}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06]">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#7FFFD4]/50">掩膜能力</p>
              <p className="text-sm font-medium text-white">{result.has_masks ? "INSTANCE" : "BBOX ONLY"}</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06]">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-amber-400/50">推理速度</p>
              <p className="text-sm font-mono font-medium text-white">{result.inference_ms}ms</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06]">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/50">当前展示</p>
              <p className="text-sm font-medium text-white">
                {viewMode === "result" ? "结果图" : viewMode === "mask" ? "掩膜图" : "原图"}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/60">系统运行状态</p>
          <StatusCard phase={status.phase} message={status.message} progress={uploadProgress} variant="compact" />
        </div>

        {result.inference_breakdown && (
          <div className="group mb-6 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5 transition-all hover:bg-white/[0.04]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/60">性能分析仪表盘</p>
              <span className="rounded border border-[#7FFFD4]/30 px-1.5 py-0.5 font-mono text-[10px] leading-none text-[#7FFFD4]">
                API 总用时: {result.inference_ms}ms
              </span>
            </div>

            <div className="space-y-3">
              {Object.entries(result.inference_breakdown).map(([key, value]) => {
                const tone = getBreakdownTone(key);
                const width = result.inference_ms > 0 ? (value / result.inference_ms) * 100 : 0;

                return (
                  <div key={key} className="space-y-1.5">
                    <div
                      className={`flex items-center justify-between text-[10px] ${
                        tone === "accent" ? "text-[#00D2FF]" : "text-slate-400"
                      }`}
                    >
                      <span className={tone === "accent" ? "font-semibold" : ""}>{formatBreakdownLabel(key)}</span>
                      <span className="font-mono">{value}ms</span>
                    </div>
                    <div
                      className={`relative w-full overflow-hidden rounded-full ${
                        tone === "accent"
                          ? "h-1.5 bg-[#00D2FF]/10 shadow-[0_0_10px_rgba(0,210,255,0.2)]"
                          : "h-1 bg-white/5"
                      }`}
                    >
                      <div
                        className={`relative h-full overflow-hidden transition-all duration-1000 ${
                          tone === "accent" ? "bg-gradient-to-r from-[#00D2FF] to-[#7FFFD4]" : "bg-slate-500"
                        }`}
                        style={{ width: `${width}%` }}
                      >
                        <div
                          className={`absolute inset-0 -translate-x-full bg-gradient-to-r ${
                            tone === "accent"
                              ? "from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]"
                              : "from-transparent via-white/5 to-transparent animate-[shimmer_4s_infinite]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-t border-white/5 pt-3">
              <p className="text-right text-[9px] italic leading-relaxed text-slate-500">
                实时监测：符合赛题 &lt; 200ms 的吞吐要求
              </p>
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/60">展示筛选</p>
          <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">病害类别</span>
              <select
                className="rounded-md border border-white/10 bg-[#05080A] px-2 py-1 text-xs text-white/80 outline-none transition-colors focus:border-[#00D2FF]/50"
                value={categoryFilter}
                onChange={(e) => onCategoryFilterChange(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-white/50">最低置信度</span>
                <span className="text-xs font-mono text-[#00D2FF]">{(minConfidence * 100).toFixed(0)}%</span>
              </div>
              <input
                className="h-1 w-full appearance-none rounded-full bg-white/10 accent-[#00D2FF] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00D2FF]"
                max="0.95"
                min="0"
                step="0.05"
                type="range"
                value={minConfidence}
                onChange={(e) => onMinConfidenceChange(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
