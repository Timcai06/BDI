import type { ComparisonMetrics, ComparisonState, ComparisonSummary } from "@/hooks/use-comparison";
import { getDefectLabel } from "@/lib/defect-visuals";
import type { PredictionResult, PredictState } from "@/lib/types";

const COMPARISON_VIEW_MODES: Array<{
  id: "master" | "comparison" | "diff";
  label: string;
}> = [
  { id: "master", label: "主模型视图" },
  { id: "comparison", label: "对比模型视图" },
  { id: "diff", label: "差异叠加模式" },
];

interface ComparisonWorkbenchProps {
  categoryDiffItems: Array<{
    category: string;
    comparisonCount: number;
    delta: number;
    primaryCount: number;
  }>;
  comp: ComparisonState | null;
  compareDisabled: boolean;
  compareModelVersion?: string | null;
  compareOptions: Array<{
    disabled?: boolean;
    label: string;
    value: string;
  }>;
  compareStatus?: PredictState;
  comparisonMetrics: ComparisonMetrics | null;
  comparisonRecommendation: string;
  comparisonResult?: PredictionResult | null;
  comparisonSourceBreakdown: Array<{ count: number; label: string }>;
  comparisonSummary: ComparisonSummary | null;
  comparisonViewMode: "master" | "comparison" | "diff";
  mainMetrics: ComparisonMetrics;
  onClearComparison: () => void;
  onCompareModelVersionChange: (modelVersion: string) => void;
  onComparisonViewModeChange: (mode: "master" | "comparison" | "diff") => void;
  onRunComparison: () => void;
  onToggleComparisonDetails: () => void;
  result: PredictionResult;
  showComparisonDetails: boolean;
  sourceBreakdown: Array<{ count: number; label: string }>;
  alignmentStrength: number;
}

export function ComparisonWorkbench({
  categoryDiffItems,
  comp,
  compareDisabled,
  compareModelVersion,
  compareOptions,
  compareStatus,
  comparisonMetrics,
  comparisonRecommendation,
  comparisonResult,
  comparisonSourceBreakdown,
  comparisonSummary,
  comparisonViewMode,
  mainMetrics,
  onClearComparison,
  onCompareModelVersionChange,
  onComparisonViewModeChange,
  onRunComparison,
  onToggleComparisonDetails,
  result,
  showComparisonDetails,
  sourceBreakdown,
  alignmentStrength,
}: ComparisonWorkbenchProps) {
  const instanceAlignment = comp?.alignment ?? null;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[#00D2FF]/20 bg-[#05080A]/80 p-8 shadow-[0_32px_128px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#00D2FF]/5 blur-[80px]" />
      <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-[#7FFFD4]/5 blur-[80px]" />

      <div className="relative z-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-6 rounded-full bg-gradient-to-r from-[#00D2FF] to-transparent" />
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#00D2FF]/70">
                模型对比
              </p>
            </div>
            <h3 className="text-2xl font-light tracking-tight text-white/90">
              {comp ? "图像级对比" : "多模型交叉验证"}
            </h3>
            {comp ? (
              <div className="flex flex-wrap gap-2 text-[11px] text-white/50">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                  主模型 {result.model_version}
                </span>
                <span className="rounded-full border border-sky-500/20 bg-sky-500/[0.08] px-3 py-1 text-sky-100">
                  对比模型 {comparisonResult?.model_version ?? "--"}
                </span>
              </div>
            ) : null}
          </div>

          {comp ? (
            <div className="flex rounded-xl border border-white/8 bg-white/5 p-1.5 backdrop-blur-md">
              {COMPARISON_VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all rounded-lg ${
                    comparisonViewMode === mode.id
                      ? "bg-[#00D2FF] text-[#05080A] shadow-[0_0_20px_rgba(0,210,255,0.4)]"
                      : "text-white/40 hover:text-white/70 hover:bg-white/5"
                  }`}
                  onClick={() => onComparisonViewModeChange(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {!comp ? (
          <div className="flex flex-col md:flex-row items-center gap-6 rounded-2xl border border-white/5 bg-white/[0.02] p-8">
            <div className="flex-1 space-y-4 text-center md:text-left">
              <p className="text-sm leading-relaxed text-white/50">
                使用同一张本地图片执行另一个模型版本的推理，快速比较检测精度、数量差值、推理速度及病害覆盖度的微小变化。
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-[10px] text-white/30 uppercase tracking-widest font-bold">
                <span className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-[#00D2FF]" />
                  量化指标对齐
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-[#7FFFD4]" />
                  实例级匹配
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-amber-400" />
                  专家决策建议
                </span>
              </div>
            </div>
            <div className="w-full md:w-[320px] space-y-4">
              <select
                className="w-full rounded-xl border border-white/10 bg-[#0B1120] px-4 py-3 text-sm text-white/80 outline-none focus:border-[#00D2FF]/50 transition-all shadow-inner"
                disabled={compareDisabled}
                value={compareModelVersion ?? ""}
                onChange={(e) => onCompareModelVersionChange(e.target.value)}
              >
                {compareOptions.length === 0 ? (
                  <option value="">暂无可对比模型</option>
                ) : (
                  compareOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}
                    </option>
                  ))
                )}
              </select>
              <button
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#00D2FF] to-[#00D2FF]/80 py-3.5 text-sm font-bold tracking-widest uppercase text-[#05080A] transition-all hover:shadow-[0_0_32px_rgba(0,210,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={compareDisabled || !compareModelVersion}
                onClick={onRunComparison}
              >
                <span className="relative z-10">
                  {compareStatus?.phase === "running" ? "正在执行云端推理..." : "启动深度对比分析"}
                </span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "数量差值",
                  value:
                    comparisonSummary && comparisonSummary.detectionDelta > 0
                      ? `+${comparisonSummary.detectionDelta}`
                      : comparisonSummary?.detectionDelta ?? 0,
                  sub:
                    !comparisonSummary || comparisonSummary.detectionDelta === 0
                      ? "检出一致"
                      : comparisonSummary.detectionDelta > 0
                        ? "对比模型检出更多"
                        : "主模型更敏感",
                  trend:
                    !comparisonSummary || comparisonSummary.detectionDelta >= 0 ? "up" : "down",
                },
                {
                  label: "耗时差值",
                  value: `${comparisonSummary && comparisonSummary.inferenceDelta > 0 ? "+" : ""}${comparisonSummary?.inferenceDelta ?? 0}ms`,
                  sub:
                    !comparisonSummary || comparisonSummary.inferenceDelta <= 0
                      ? "吞吐效率提升"
                      : "性能开销增加",
                  trend:
                    !comparisonSummary || comparisonSummary.inferenceDelta <= 0 ? "up" : "down",
                },
                {
                  label: "置信均值",
                  value: `${(mainMetrics.averageConfidence * 100).toFixed(0)}% / ${((comparisonMetrics?.averageConfidence ?? 0) * 100).toFixed(0)}%`,
                  sub: "主模型 / 对比模型",
                  trend:
                    (comparisonMetrics?.averageConfidence ?? 0) >= mainMetrics.averageConfidence
                      ? "up"
                      : "down",
                },
                {
                  label: "实例一致性",
                  value: `${alignmentStrength.toFixed(1)}%`,
                  sub: `匹配 ${comparisonSummary?.matchedCount ?? 0} 处共有目标`,
                  trend: "up",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="group relative rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.06]"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                    {metric.label}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-bold text-white">{metric.value}</span>
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${metric.trend === "up" ? "bg-[#7FFFD4] shadow-[0_0_8px_#7FFFD4]" : "bg-rose-500 shadow-[0_0_8px_#F43F5E]"}`}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-white/40">{metric.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-2xl border border-[#7FFFD4]/20 bg-[#7FFFD4]/5 p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7FFFD4]/10 text-[#7FFFD4]">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-[#7FFFD4]">
                      专家决策建议
                    </h4>
                  </div>
                  <p className="text-sm leading-relaxed text-[#7FFFD4]/90 italic">
                    &ldquo;{comparisonRecommendation}&rdquo;
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#7FFFD4]/40 mb-3">
                      共有目标 (一致)
                    </p>
                    <div className="space-y-2">
                      {(comparisonSummary?.matchedCount ?? 0) === 0 ? (
                        <p className="text-xs text-white/20">无一致项</p>
                      ) : comp && comp.matchedPrimaryIds.size > 0 ? (
                        Array.from(comp.matchedPrimaryIds)
                          .slice(0, 3)
                          .map((id) => {
                            const det = result.detections.find((detection) => detection.id === id);
                            return det ? (
                              <div key={id} className="text-[11px] text-white/70 flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                {getDefectLabel(det.category)}
                              </div>
                            ) : null;
                          })
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/40 mb-3">
                      主模型独有
                    </p>
                    <div className="space-y-2">
                      {(comparisonSummary?.primaryOnlyCount ?? 0) === 0 ? (
                        <p className="text-xs text-white/20">无差异项</p>
                      ) : (
                        result.detections
                          .filter((detection) => !comp?.matchedPrimaryIds.has(detection.id))
                          .slice(0, 3)
                          .map((detection) => (
                            <div
                              key={detection.id}
                              className="text-[11px] text-white/70 flex items-center gap-2"
                            >
                              <div className="w-1 h-1 rounded-full bg-amber-400" />
                              {getDefectLabel(detection.category)}
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500/40 mb-3">
                      对比模型新增
                    </p>
                    <div className="space-y-2">
                      {(comparisonSummary?.comparisonOnlyCount ?? 0) === 0 ? (
                        <p className="text-xs text-white/20">无新增项</p>
                      ) : (
                        (comparisonResult?.detections ?? [])
                          .filter((detection) => !comp?.matchedComparisonIds.has(detection.id))
                          .slice(0, 3)
                          .map((detection) => (
                            <div
                              key={detection.id}
                              className="text-[11px] text-white/70 flex items-center gap-2"
                            >
                              <div className="w-1 h-1 rounded-full bg-sky-400" />
                              {getDefectLabel(detection.category)}
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex-1 rounded-2xl border border-white/5 bg-white/[0.01] p-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">
                    来源分布对比
                  </h4>
                  <div className="space-y-4">
                    {sourceBreakdown.map((source) => (
                      <div key={source.label} className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-white/60">{source.label}</span>
                          <span className="text-white">{source.count}</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00D2FF]"
                            style={{
                              width: `${result.detections.length > 0 ? (source.count / result.detections.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  className="w-full rounded-xl border border-[#00D2FF]/30 bg-[#00D2FF]/5 py-3 text-xs font-bold tracking-widest uppercase text-[#00D2FF] transition-all hover:bg-[#00D2FF]/10"
                  onClick={onClearComparison}
                >
                  结束本次对比
                </button>
              </div>
            </div>

            {instanceAlignment ? (
              <div className="grid gap-3 xl:grid-cols-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/70">
                    命中
                  </p>
                  <div className="mt-3 text-2xl font-mono text-white">
                    {instanceAlignment.matched.length}
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    两个模型在相同位置识别到的目标，可作为稳定识别区域优先参考。
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70">
                    主模型独有
                  </p>
                  <div className="mt-3 text-2xl font-mono text-white">
                    {instanceAlignment.primaryOnly.length}
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    这些目标未在对比模型中找到同位置匹配项，适合重点检查是否漏检。
                  </p>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/70">
                    对比模型独有
                  </p>
                  <div className="mt-3 text-2xl font-mono text-white">
                    {instanceAlignment.comparisonOnly.length}
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    这些目标是对比模型新增检出区域，适合结合原图做二次确认。
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 xl:grid-cols-2">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                  主模型来源分布
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sourceBreakdown.length > 0 ? (
                    sourceBreakdown.map((item) => (
                      <span
                        key={item.label}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200"
                      >
                        {item.label} {item.count}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">当前结果未提供来源拆分。</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/70">
                  对比模型来源分布
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {comparisonSourceBreakdown.length > 0 ? (
                    comparisonSourceBreakdown.map((item) => (
                      <span
                        key={item.label}
                        className="rounded-full border border-sky-500/20 bg-sky-500/[0.08] px-3 py-1 text-xs text-sky-100"
                      >
                        {item.label} {item.count}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">对比结果未提供来源拆分。</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-300">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                    差异摘要
                  </p>
                  <p className="mt-2 text-xs text-slate-400">先看结论，再按需展开明细。</p>
                </div>
                <button
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
                  type="button"
                  onClick={onToggleComparisonDetails}
                >
                  {showComparisonDetails ? "收起明细" : "展开明细"}
                </button>
              </div>

              {comparisonRecommendation ? (
                <div className="mt-3 rounded-lg border border-sky-500/15 bg-sky-500/[0.06] px-3 py-3 text-sm leading-relaxed text-slate-100">
                  {comparisonRecommendation}
                </div>
              ) : null}

              {showComparisonDetails ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg bg-black/20 px-3 py-3">
                      <div className="text-xs text-slate-500">主模型长度/面积</div>
                      <div className="mt-1 font-mono text-white">
                        {mainMetrics.totalLength > 0 ? `${(mainMetrics.totalLength / 10).toFixed(1)}cm` : "--"} /{" "}
                        {mainMetrics.totalArea > 0 ? `${(mainMetrics.totalArea / 100).toFixed(1)}cm²` : "--"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-black/20 px-3 py-3">
                      <div className="text-xs text-slate-500">对比模型长度/面积</div>
                      <div className="mt-1 font-mono text-white">
                        {comparisonMetrics && comparisonMetrics.totalLength > 0
                          ? `${(comparisonMetrics.totalLength / 10).toFixed(1)}cm`
                          : "--"}{" "}
                        /{" "}
                        {comparisonMetrics && comparisonMetrics.totalArea > 0
                          ? `${(comparisonMetrics.totalArea / 100).toFixed(1)}cm²`
                          : "--"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-black/20 px-3 py-3">
                      <div className="text-xs text-slate-500">主模型类别覆盖</div>
                      <div className="mt-1 font-mono text-white">
                        {new Set(result.detections.map((item) => item.category)).size} 类
                      </div>
                    </div>
                    <div className="rounded-lg bg-black/20 px-3 py-3">
                      <div className="text-xs text-slate-500">对比模型类别覆盖</div>
                      <div className="mt-1 font-mono text-white">
                        {new Set((comparisonResult?.detections ?? []).map((item) => item.category)).size} 类
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-3 text-sm text-slate-300">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                      病害差异
                    </p>
                    <div className="mt-4 space-y-2">
                      {categoryDiffItems.map((item) => {
                        const deltaTone =
                          item.delta === 0
                            ? "text-slate-300"
                            : item.delta > 0
                              ? "text-sky-300"
                              : "text-amber-300";
                        const deltaLabel =
                          item.delta === 0
                            ? "一致"
                            : item.delta > 0
                              ? "对比模型更多"
                              : "主模型更多";

                        return (
                          <div
                            key={item.category}
                            className="grid grid-cols-[1.2fr_0.8fr_0.8fr_1fr] items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-3 text-xs"
                          >
                            <div className="font-medium text-white">{getDefectLabel(item.category)}</div>
                            <div className="font-mono text-slate-400">主 {item.primaryCount}</div>
                            <div className="font-mono text-slate-400">对比 {item.comparisonCount}</div>
                            <div className={`text-right font-medium ${deltaTone}`}>{deltaLabel}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {instanceAlignment ? (
                    <div className="grid gap-3 xl:grid-cols-3">
                      <div className="rounded-lg bg-emerald-500/[0.06] px-3 py-3">
                        <div className="text-xs text-emerald-200/80">命中</div>
                        <div className="mt-2 space-y-2">
                          {instanceAlignment.matched.length > 0 ? (
                            instanceAlignment.matched.slice(0, 4).map((pair) => (
                              <div
                                key={`${pair.primary.id}-${pair.comparison.id}`}
                                className="text-xs text-slate-100"
                              >
                                {getDefectLabel(pair.primary.category)} · IoU{" "}
                                {(pair.iou * 100).toFixed(0)}%
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-400">暂无一致命中</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-amber-500/[0.06] px-3 py-3">
                        <div className="text-xs text-amber-200/80">主模型独有</div>
                        <div className="mt-2 space-y-2">
                          {instanceAlignment.primaryOnly.length > 0 ? (
                            instanceAlignment.primaryOnly.slice(0, 4).map((item) => (
                              <div key={item.id} className="text-xs text-slate-100">
                                {getDefectLabel(item.category)} · {(item.confidence * 100).toFixed(1)}%
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-400">无独有目标</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-sky-500/[0.06] px-3 py-3">
                        <div className="text-xs text-sky-200/80">对比模型独有</div>
                        <div className="mt-2 space-y-2">
                          {instanceAlignment.comparisonOnly.length > 0 ? (
                            instanceAlignment.comparisonOnly.slice(0, 4).map((item) => (
                              <div key={item.id} className="text-xs text-slate-100">
                                {getDefectLabel(item.category)} · {(item.confidence * 100).toFixed(1)}%
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-400">无新增目标</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
