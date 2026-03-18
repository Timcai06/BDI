import { useEffect, useRef, useState, type SyntheticEvent } from "react";

import { AdaptiveImage } from "@/components/adaptive-image";
import { formatModelLabel } from "@/lib/model-labels";
import {
  buildDetectionCategoryDiff,
  filterDetections,
  getDetectionOverlayStyle,
  getDetectionSummary
} from "@/lib/result-utils";
import type { Detection, PredictionResult, PredictState } from "@/lib/types";

interface ResultDashboardProps {
  result: PredictionResult;
  comparisonResult?: PredictionResult | null;
  compareStatus?: PredictState;
  compareModelVersion?: string | null;
  compareOptions: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  categoryFilter: string;
  minConfidence: number;
  previewUrl?: string | null;
  overlayPreviewUrl?: string | null;
  comparisonPreviewUrl?: string | null;
  comparisonOverlayPreviewUrl?: string | null;
  viewMode: "image" | "overlay";
  onViewModeChange: (mode: "image" | "overlay") => void;
  onExportJson: () => void;
  onExportOverlay: () => void;
  overlayDisabled: boolean;
  selectedDetectionId: string | null;
  onSelectDetection: (detection: Detection) => void;
  onOpenHistory: () => void;
  onReset: () => void;
  onRerun: () => void;
  onCompareModelVersionChange: (modelVersion: string) => void;
  onRunComparison: () => void;
  onClearComparison: () => void;
  rerunDisabled: boolean;
  compareDisabled: boolean;
}

function getCategoryColor(category: string) {
  const norm = category.toLowerCase();
  if (norm.includes("crack") || norm.includes("裂缝")) return "border-[#FF4D4D] bg-[#FF4D4D]/10 text-[#FF4D4D]";
  if (norm.includes("spalling") || norm.includes("剥落")) return "border-[#FFC107] bg-[#FFC107]/10 text-[#FFC107]";
  if (norm.includes("efflo") || norm.includes("泛碱")) return "border-[#00D2FF] bg-[#00D2FF]/10 text-[#00D2FF]";
  return "border-emerald-400 bg-emerald-400/10 text-emerald-400";
}

function getPrimaryFinding(result: PredictionResult): string {
  if (result.detections.length === 0) {
    return "本次未识别到明确病害";
  }

  const categoryCounts = result.detections.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  const [topCategory, topCount] =
    Object.entries(categoryCounts).sort((left, right) => right[1] - left[1])[0] ?? [];

  if (!topCategory || !topCount) {
    return `识别到 ${result.detections.length} 处病害`;
  }

  return `${topCategory} 是本次主要风险，共识别 ${topCount} 处`;
}

function getResultNextStep(result: PredictionResult): string {
  if (result.detections.length === 0) {
    return "建议先降低阈值或更换一张更清晰的巡检照片，再重新分析。";
  }

  if (result.detections.length === 1) {
    return "建议先查看病害详情确认定位与置信度，再决定是否导出结果。";
  }

  return "建议先在病害列表中逐项查看，再根据需要做模型对比或导出结果。";
}

function getComparisonRecommendation(
  result: PredictionResult,
  comparisonResult: PredictionResult,
  detectionDelta: number,
  categoryDiffItems: ReturnType<typeof buildDetectionCategoryDiff>
): string {
  const inferenceDelta = comparisonResult.inference_ms - result.inference_ms;
  const strongestDiff =
    [...categoryDiffItems].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))[0] ?? null;

  if (detectionDelta === 0) {
    if (inferenceDelta < 0) {
      return `两版识别结果接近，建议优先保留更快的 ${formatModelLabel(comparisonResult)}。`;
    }

    if (inferenceDelta > 0) {
      return `两版识别结果接近，建议继续使用当前主模型 ${formatModelLabel(result)}。`;
    }

    return "两版结果和耗时都很接近，建议继续使用当前主模型。";
  }

  if (detectionDelta > 0) {
    return strongestDiff
      ? `${formatModelLabel(comparisonResult)} 识别到更多病害，尤其是 ${strongestDiff.category}，但耗时${inferenceDelta > 0 ? "更高" : "更低"}。`
      : `${formatModelLabel(comparisonResult)} 识别到更多病害，适合继续做复核。`;
  }

  return strongestDiff
    ? `${formatModelLabel(result)} 检出的病害更多，尤其是 ${strongestDiff.category}，当前主模型更适合作为默认版本。`
    : `${formatModelLabel(result)} 检出的病害更多，建议优先保留当前主模型。`;
}

function getDetectionPriorityScore(detection: Detection): number {
  const areaScore = detection.metrics.area_mm2 ? detection.metrics.area_mm2 / 100 : 0;
  const lengthScore = detection.metrics.length_mm ? detection.metrics.length_mm / 10 : 0;
  return detection.confidence * 1000 + areaScore + lengthScore;
}

function formatResultTimestamp(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(date);
}

export function ResultDashboard({
  result,
  comparisonResult,
  compareStatus,
  compareModelVersion,
  compareOptions,
  categoryFilter,
  minConfidence,
  previewUrl,
  overlayPreviewUrl,
  comparisonPreviewUrl,
  comparisonOverlayPreviewUrl,
  viewMode,
  onViewModeChange,
  onExportJson,
  onExportOverlay,
  overlayDisabled,
  selectedDetectionId,
  onSelectDetection,
  onOpenHistory,
  onReset,
  onRerun,
  onCompareModelVersionChange,
  onRunComparison,
  onClearComparison,
  rerunDisabled,
  compareDisabled
}: ResultDashboardProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const detectionItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const filteredDetections = filterDetections(
    result.detections,
    categoryFilter,
    minConfidence
  );
  const prioritizedDetections = [...filteredDetections].sort(
    (left, right) => getDetectionPriorityScore(right) - getDetectionPriorityScore(left)
  );
  const averageConfidence = filteredDetections.length
    ? (
      filteredDetections.reduce((sum, item) => sum + item.confidence, 0) /
      filteredDetections.length *
      100
    ).toFixed(1)
    : "--";
  const activePreviewUrl =
    viewMode === "overlay" && overlayPreviewUrl ? overlayPreviewUrl : previewUrl;
  const activeComparisonPreviewUrl =
    viewMode === "overlay" && comparisonOverlayPreviewUrl
      ? comparisonOverlayPreviewUrl
      : comparisonPreviewUrl;
  const current =
    prioritizedDetections.find((item) => item.id === selectedDetectionId) ??
    prioritizedDetections[0] ??
    null;
  const topPriorityDetection = prioritizedDetections[0] ?? null;
  const comparisonDetectionCount = comparisonResult?.detections.length ?? null;
  const detectionDelta =
    comparisonDetectionCount === null
      ? null
      : comparisonDetectionCount - result.detections.length;
  const categoryDiffItems = comparisonResult
    ? buildDetectionCategoryDiff(result, comparisonResult)
    : [];
  const primaryFinding = getPrimaryFinding(result);
  const resultNextStep = getResultNextStep(result);
  const comparisonRecommendation =
    comparisonResult && detectionDelta !== null
      ? getComparisonRecommendation(result, comparisonResult, detectionDelta, categoryDiffItems)
      : null;
  const primaryActionLabel = rerunDisabled ? "新建分析" : "重新检测当前图片";
  const primaryActionTitle = rerunDisabled
    ? "选择新图片开始下一次检测"
    : "使用当前本地图片重新执行推理";
  const handlePrimaryAction = rerunDisabled ? onReset : onRerun;

  useEffect(() => {
    const node = frameRef.current;
    if (!node) {
      return;
    }

    const updateFrameSize = () => {
      const rect = node.getBoundingClientRect();
      setFrameSize({
        width: rect.width,
        height: rect.height
      });
    };

    updateFrameSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateFrameSize);
      return () => window.removeEventListener("resize", updateFrameSize);
    }

    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const target = event.currentTarget;
    setImageSize({
      width: target.naturalWidth,
      height: target.naturalHeight
    });
  }

  function handleFocusDetection(detection: Detection | null) {
    if (!detection) {
      return;
    }

    onSelectDetection(detection);
    requestAnimationFrame(() => {
      detectionItemRefs.current[detection.id]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full">
      {/* 图像监控主界面区 */}
      <div className="flex-1 rounded-[1.5rem] border border-white/10 bg-[#1E293B]/70 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col xl:col-span-2 min-h-[500px]">
        <div className="border-b border-white/5 bg-[linear-gradient(180deg,rgba(11,17,32,0.82),rgba(11,17,32,0.58))] px-5 py-4 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  实时结果
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-lg font-medium tracking-[0.04em] text-white">识别结果</p>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
                  {viewMode === "overlay" ? "Overlay" : "Image"}
                </span>
              </div>
            </div>

            <div className="flex rounded-xl border border-white/8 bg-black/20 p-1">
              <button
                aria-pressed={viewMode === "image"}
                className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${
                  viewMode === "image"
                    ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-slate-400 hover:bg-white/5"
                }`}
                type="button"
                onClick={() => onViewModeChange("image")}
              >
                查看原图
              </button>
              <button
                aria-label="查看叠加图"
                aria-pressed={viewMode === "overlay"}
                className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  viewMode === "overlay"
                    ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-slate-400 hover:bg-white/5"
                }`}
                disabled={overlayDisabled}
                title={overlayDisabled ? "当前结果没有可切换的叠加图" : "切换到叠加图"}
                type="button"
                onClick={() => onViewModeChange("overlay")}
              >
                查看叠加图
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                当前文件
              </p>
              <p className="mt-1 truncate text-sm text-white/72" title={result.image_id}>
                {result.image_id}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                className="h-8 rounded-lg border border-sky-400/30 bg-sky-400/[0.12] px-4 text-xs font-semibold text-sky-100 transition-colors hover:bg-sky-400/[0.2]"
                title={primaryActionTitle}
                type="button"
                onClick={handlePrimaryAction}
              >
                {primaryActionLabel}
              </button>
              <button
                className="h-8 rounded-lg border border-white/8 bg-black/20 px-3 text-xs font-medium text-white/72 transition-colors hover:bg-white/8 hover:text-white"
                type="button"
                onClick={onOpenHistory}
              >
                历史记录
              </button>
              <details className="relative">
                <summary className="flex h-8 cursor-pointer list-none items-center rounded-lg border border-white/8 bg-black/20 px-3 text-xs font-medium text-white/72 transition-colors hover:bg-white/8 hover:text-white">
                  导出
                </summary>
                <div className="absolute right-0 top-10 z-20 flex min-w-[160px] flex-col gap-1 rounded-xl border border-white/10 bg-[#0B1120]/95 p-2 shadow-2xl backdrop-blur">
                  <button
                    aria-label="导出 JSON"
                    className="rounded-md px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    type="button"
                    onClick={onExportJson}
                  >
                    导出 JSON
                  </button>
                  <button
                    aria-label="导出叠加图"
                    className="rounded-md px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={overlayDisabled}
                    title={overlayDisabled ? "当前结果没有可导出的 overlay 文件" : "导出叠加图"}
                    type="button"
                    onClick={onExportOverlay}
                  >
                    导出叠加图
                  </button>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.03),transparent_70%),linear-gradient(180deg,#0B1120,#0F172A)] p-5 md:p-6 overflow-auto">
          <div className="mx-auto flex h-full max-w-5xl flex-col rounded-[1.75rem] border border-white/8 bg-[#0B1120]/82 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  预览画面
                </p>
                <p className="mt-1 truncate text-sm text-white/72" title={result.image_id}>
                  {result.image_id}
                </p>
              </div>
              <span className="shrink-0 text-xs font-mono text-white/42">
                {formatResultTimestamp(result.created_at)} UTC
              </span>
            </div>

            <div className="flex-1 px-5 py-5">
              <div
                ref={frameRef}
                className="relative mx-auto aspect-[4/3] max-h-full w-full overflow-hidden rounded-[1.25rem] border border-white/8 bg-[#050b16] ring-1 ring-white/6 shadow-2xl"
              >
                {activePreviewUrl ? (
                  <AdaptiveImage
                    alt="Inspection"
                    className="rounded-[1.25rem] object-contain opacity-90"
                    onLoad={handleImageLoad}
                    sizes="(min-width: 1280px) 70vw, 100vw"
                    src={activePreviewUrl}
                  />
                ) : (
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] bg-repeat" />
                )}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                <div className="absolute inset-0 z-10">
                  {prioritizedDetections.map((item) => {
                    const colorCls = getCategoryColor(item.category);
                    const isSelected = item.id === selectedDetectionId;
                    const overlayStyle = getDetectionOverlayStyle(
                      item.bbox,
                      imageSize,
                      frameSize
                    );
                    return (
                      <div
                        key={item.id}
                        className={`absolute rounded-sm group transition-all cursor-crosshair box-border hover:shadow-[0_0_15px_currentColor] ${isSelected ? "border-[3px] shadow-[0_0_18px_currentColor]" : "border-[1.5px] hover:border-[2.5px]"} ${colorCls}`}
                        style={{
                          ...overlayStyle,
                          backgroundColor: "transparent"
                        }}
                        onClick={() => handleFocusDetection(item)}
                      >
                        <div className="absolute inset-0 bg-current opacity-10 group-hover:opacity-20 transition-opacity" />
                        <span className="absolute -top-[21px] left-[-1.5px] px-1.5 py-0.5 text-[10px] font-mono font-bold bg-current text-[#0B1120] whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity shadow-sm">
                          {item.category.toUpperCase()} {(item.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 px-5 py-4 text-[11px] font-mono text-slate-500">
              <span>{viewMode === "overlay" ? "叠加图视图" : "原图视图"} / {filteredDetections.length} 个病害</span>
              <span className="truncate text-right">{formatModelLabel(result)}</span>
            </div>
          </div>
        </div>

        {comparisonResult ? (
          <div className="border-t border-white/5 bg-black/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                图像级对比
              </p>
              <span className="text-xs font-mono text-slate-400">
                {viewMode === "overlay" ? "同步叠加图预览" : "同步原图预览"}
              </span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0B1120]/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                      主模型
                    </p>
                    <p className="mt-1 text-sm text-white">{formatModelLabel(result)}</p>
                  </div>
                  <div className="text-right text-xs font-mono text-slate-400">
                    <div>{result.detections.length} detections</div>
                    <div>{result.inference_ms}ms</div>
                  </div>
                </div>
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/5 bg-black">
                  {activePreviewUrl ? (
                    <AdaptiveImage
                      alt={`${result.model_version} preview`}
                      className="object-contain opacity-90"
                      src={activePreviewUrl}
                      sizes="(min-width: 1280px) 35vw, 100vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                      无可用预览
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/70">
                      对比模型
                    </p>
                    <p className="mt-1 text-sm text-white">{formatModelLabel(comparisonResult)}</p>
                  </div>
                  <div className="text-right text-xs font-mono text-slate-300">
                    <div>{comparisonResult.detections.length} detections</div>
                    <div>{comparisonResult.inference_ms}ms</div>
                  </div>
                </div>
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/5 bg-black">
                  {activeComparisonPreviewUrl ? (
                    <AdaptiveImage
                      alt={`${comparisonResult.model_version} preview`}
                      className="object-contain opacity-90"
                      src={activeComparisonPreviewUrl}
                      sizes="(min-width: 1280px) 35vw, 100vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                      无可用预览
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 病害详情列表 - 嵌入主画布右侧作为辅助，或者在窄屏时下放 */}
      <aside className="w-full xl:w-96 shrink-0 flex flex-col gap-6">
        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 p-5 shadow-lg backdrop-blur shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-2">结果结论</p>
          <h3 className="text-xl text-slate-100 font-light tracking-tight">{primaryFinding}</h3>
          <p className="mt-2 text-sm text-slate-300">{getDetectionSummary(result)}</p>
          <p className="mt-3 text-sm text-slate-400">
            {activePreviewUrl
              ? `当前正在查看${viewMode === "overlay" ? "叠加图" : "原图"}，可继续筛选、导出或重新分析。`
              : "当前为历史记录回看模式，已恢复结构化结果和病害详情。"}
          </p>
          <div className="mt-4 rounded-xl border border-sky-500/15 bg-sky-500/[0.06] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/70">建议下一步</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">{resultNextStep}</p>
            {topPriorityDetection ? (
              <button
                className="mt-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition-colors hover:bg-sky-500/20"
                type="button"
                onClick={() => handleFocusDetection(topPriorityDetection)}
              >
                查看最高风险病害
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">病害总数</div>
              <div className="text-xl font-mono text-white">{filteredDetections.length}</div>
            </div>
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">平均置信度</div>
              <div className="text-xl font-mono text-sky-400">
                {averageConfidence === "--" ? "--" : `${averageConfidence}%`}
              </div>
            </div>
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">推理耗时</div>
              <div className="text-xl font-mono text-white">{result.inference_ms}ms</div>
            </div>
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">当前视图</div>
              <div className="text-xl font-medium text-white">
                {viewMode === "overlay" ? "叠加图" : "原图"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 p-5 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                模型对比
              </p>
              <p className="mt-2 text-sm text-slate-400">
                使用同一张本地图片再跑一个模型版本，快速比较结果数量、耗时与版本差异。
              </p>
            </div>
            {comparisonResult ? (
              <button
                className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
                type="button"
                onClick={onClearComparison}
              >
                清除对比
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex gap-3">
            <select
              className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white/80 outline-none focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={compareDisabled}
              value={compareModelVersion ?? ""}
              onChange={(event) => onCompareModelVersionChange(event.target.value)}
            >
              {compareOptions.length === 0 ? (
                <option value="">暂无可对比模型</option>
              ) : (
                compareOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
            <button
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={compareDisabled || !compareModelVersion}
              type="button"
              onClick={onRunComparison}
            >
              {compareStatus?.phase === "running" ? "对比中..." : "开始对比"}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {compareStatus?.message ??
              "当前结果来自主模型，你可以选一个其他版本快速做二次推理。"}
          </p>

          {comparisonResult ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/5 bg-[#0B1120]/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                  主结果
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">模型版本</span>
                    <span className="font-mono text-white">{formatModelLabel(result)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">病害数量</span>
                    <span className="font-mono text-white">{result.detections.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">推理耗时</span>
                    <span className="font-mono text-white">{result.inference_ms}ms</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/70">
                  对比结果
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">模型版本</span>
                    <span className="font-mono text-white">
                      {formatModelLabel(comparisonResult)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">病害数量</span>
                    <span className="font-mono text-white">{comparisonResult.detections.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">推理耗时</span>
                    <span className="font-mono text-white">{comparisonResult.inference_ms}ms</span>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-300">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                  差异摘要
                </p>
                {comparisonRecommendation ? (
                  <div className="mt-3 rounded-lg border border-sky-500/15 bg-sky-500/[0.06] px-3 py-3 text-sm leading-relaxed text-slate-100">
                    {comparisonRecommendation}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-black/20 px-3 py-3">
                    <div className="text-xs text-slate-500">病害数量差值</div>
                    <div className="mt-1 font-mono text-white">
                      {detectionDelta === null
                        ? "--"
                        : detectionDelta > 0
                          ? `+${detectionDelta}`
                          : `${detectionDelta}`}
                    </div>
                  </div>
                  <div className="rounded-lg bg-black/20 px-3 py-3">
                    <div className="text-xs text-slate-500">耗时差值</div>
                    <div className="mt-1 font-mono text-white">
                      {comparisonResult.inference_ms - result.inference_ms > 0
                        ? `+${comparisonResult.inference_ms - result.inference_ms}ms`
                        : `${comparisonResult.inference_ms - result.inference_ms}ms`}
                    </div>
                  </div>
                  <div className="rounded-lg bg-black/20 px-3 py-3">
                    <div className="text-xs text-slate-500">当前对比</div>
                    <div className="mt-1 font-mono text-white">
                      {formatModelLabel(result)} vs {formatModelLabel(comparisonResult)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-300">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                  病害差异
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  当前按病害类别统计差异，用于快速判断主模型和对比模型分别多检或少检了什么。
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
                        <div className="font-medium text-white">{item.category}</div>
                        <div className="font-mono text-slate-400">
                          主 {item.primaryCount}
                        </div>
                        <div className="font-mono text-slate-400">
                          对比 {item.comparisonCount}
                        </div>
                        <div className={`text-right font-medium ${deltaTone}`}>
                          {deltaLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 shadow-lg backdrop-blur flex-1 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">病害列表</p>
            <span className="font-mono text-xs text-slate-400">{prioritizedDetections.length} 项</span>
          </div>

          <div ref={listContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {prioritizedDetections.map((item, index) => {
              const colorCls = getCategoryColor(item.category);
              const colorCode = colorCls.match(/text-\[(.*?)\]/)?.[1] || "#10B981";
              const isSelected = item.id === selectedDetectionId;
              const isHighestPriority = item.id === topPriorityDetection?.id;

              return (
                <article
                  key={item.id}
                  ref={(node) => {
                    detectionItemRefs.current[item.id] = node;
                  }}
                  className={`rounded-xl border p-3 transition-colors group cursor-pointer ${isSelected ? "border-sky-500/40 bg-sky-500/[0.08]" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}
                  data-detection-id={item.id}
                  onClick={() => handleFocusDetection(item)}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">{String(index + 1).padStart(2, '0')}.</span>
                      <h4 className="text-sm font-medium text-slate-200 uppercase">{item.category}</h4>
                      {isHighestPriority ? (
                        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                          优先查看
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded border border-white/10" style={{ color: colorCode }}>
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 truncate w-10">Id</span>
                      <span className="font-mono text-slate-300 truncate" title={item.id}>{item.id.split('-')[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-10">Size</span>
                      <span className="font-mono text-slate-300">
                        {item.metrics.length_mm ? `${(item.metrics.length_mm / 10).toFixed(1)}cm` : "--"}
                      </span>
                    </div>
                    <div className="flex gap-2 col-span-2">
                      <span className="text-slate-500 w-10">Area</span>
                      <span className="font-mono text-slate-300">
                        {item.metrics.area_mm2 ? `${(item.metrics.area_mm2 / 100).toFixed(1)}cm²` : "--"}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredDetections.length === 0 && (
              <div className="h-32 flex items-center justify-center text-sm text-slate-500 font-mono">
                [ NO DATA MATCHES FILTERS, TRY LOWER CONFIDENCE ]
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 p-5 shadow-lg backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            当前病害详情
          </p>
          {filteredDetections.length > 0 ? (
            current ? (
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">病害类型</span>
                    <span className="font-medium text-white">{current.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">置信度</span>
                    <span className="font-mono text-sky-400">
                      {(current.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">边界框</span>
                    <span className="font-mono text-xs text-slate-300">
                      {Math.round(current.bbox.width)} x {Math.round(current.bbox.height)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">长度</span>
                    <span className="font-mono text-xs text-slate-300">
                      {current.metrics.length_mm
                        ? `${(current.metrics.length_mm / 10).toFixed(1)} cm`
                        : "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">面积</span>
                    <span className="font-mono text-xs text-slate-300">
                      {current.metrics.area_mm2
                        ? `${(current.metrics.area_mm2 / 100).toFixed(1)} cm²`
                      : "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">检测编号</span>
                    <span className="font-mono text-xs text-slate-300">{current.id}</span>
                  </div>
                </div>
              ) : null
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              当前筛选条件下没有病害结果，建议降低置信度阈值或切回“全部”类别。
            </p>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 p-5 shadow-lg backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            下一步建议
          </p>
          {result.detections.length === 0 ? (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>本次未检出病害，建议先降低置信度阈值后重新分析当前图片。</p>
              <p className="text-slate-400">
                如果这是历史记录，也可以切回历史列表，改看其他样本的结果差异。
              </p>
            </div>
          ) : filteredDetections.length === 0 ? (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>当前筛选条件把结果全部过滤掉了，可以降低阈值或切回“全部”。</p>
              <p className="text-slate-400">
                右侧筛选器会实时生效，不需要重新上传图片。
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>你可以继续导出结果、切换到历史记录，或更换图片重新分析。</p>
              <p className="text-slate-400">
                当前选中的病害已在图像和列表中同步高亮，适合用于答辩演示和人工复核。
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
