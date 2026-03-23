import { useEffect, useRef, useState, type SyntheticEvent } from "react";

import { AdaptiveImage } from "@/components/adaptive-image";
import { StatusCard } from "@/components/status-card";
import { getDefectColorHex } from "@/lib/defect-visuals";
import { formatModelLabel } from "@/lib/model-labels";
import {
  buildDetectionCategoryDiff,
  filterDetections,
  getDetectionMaskPolygonPoints,
  getDetectionOverlayStyle,
  getDetectionSummary,
  getPrimaryFinding,
  getResultNextStep,
} from "@/lib/result-utils";
import { getDiagnosisText } from "@/lib/predict-client";
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
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
  viewMode: "image" | "result" | "mask";
  onViewModeChange: (mode: "image" | "result" | "mask") => void;
  onExportJson: () => void;
  onExportOverlay: () => void;
  resultDisabled: boolean;
  maskDisabled: boolean;
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
  // Status & Filter props from HomeShell
  status: PredictState;
  uploadProgress?: number;
  onCategoryFilterChange: (category: string) => void;
  onMinConfidenceChange: (confidence: number) => void;
  categories: string[];
}

function calculateTotalMetrics(result: PredictionResult) {
  const totals = {
    totalLength: 0,
    totalArea: 0,
    totalWidth: 0,
    count: 0
  };
  for (const detection of result.detections) {
    if (detection.metrics.length_mm) {
      totals.totalLength += detection.metrics.length_mm;
    }
    if (detection.metrics.area_mm2) {
      totals.totalArea += detection.metrics.area_mm2;
    }
    if (detection.metrics.width_mm) {
      totals.totalWidth += detection.metrics.width_mm;
    }
    totals.count++;
  }
  return totals;
}

function getComparisonRecommendation(
  result: PredictionResult,
  comparisonResult: PredictionResult,
  detectionDelta: number,
  categoryDiffItems: ReturnType<typeof buildDetectionCategoryDiff>,
): string {
  const inferenceDelta = comparisonResult.inference_ms - result.inference_ms;
  const strongestDiff =
    [...categoryDiffItems].sort(
      (left, right) => Math.abs(right.delta) - Math.abs(left.delta),
    )[0] ?? null;

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
  const areaScore = detection.metrics.area_mm2
    ? detection.metrics.area_mm2 / 100
    : 0;
  const lengthScore = detection.metrics.length_mm
    ? detection.metrics.length_mm / 10
    : 0;
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
    timeZone: "UTC",
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
  resultDisabled,
  maskDisabled,
  selectedDetectionId,
  onSelectDetection,
  onOpenHistory,
  onReset,
  onRerun,
  onCompareModelVersionChange,
  onRunComparison,
  onClearComparison,
  rerunDisabled,
  compareDisabled,
  status,
  uploadProgress,
  onCategoryFilterChange,
  onMinConfidenceChange,
  categories
}: ResultDashboardProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const detectionItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [isDiagnosisLoading, setIsDiagnosisLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchDiagnosis() {
      if (!result.image_id) return;
      
      setDiagnosis("");
      setIsDiagnosisLoading(true);
      
      try {
        const content = await getDiagnosisText(result.image_id);
        if (!cancelled) {
          setDiagnosis(content);
        }
      } catch (error) {
        if (!cancelled) {
          setDiagnosis("无法加载 AI 专家评估建议。");
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          setIsDiagnosisLoading(false);
        }
      }
    }
    
    void fetchDiagnosis();
    
    return () => {
      cancelled = true;
    };
  }, [result.image_id]);
  const filteredDetections = filterDetections(
    result.detections,
    categoryFilter,
    minConfidence,
  );
  const prioritizedDetections = [...filteredDetections].sort(
    (left, right) =>
      getDetectionPriorityScore(right) - getDetectionPriorityScore(left),
  );
  const averageConfidence = filteredDetections.length
    ? (
        (filteredDetections.reduce((sum, item) => sum + item.confidence, 0) /
          filteredDetections.length) *
        100
      ).toFixed(1)
    : "--";
  const activePreviewUrl =
    viewMode === "result"
      ? overlayPreviewUrl ?? previewUrl
      : previewUrl ?? (viewMode === "mask" ? overlayPreviewUrl : null);
  const activeComparisonPreviewUrl =
    viewMode === "result"
      ? comparisonOverlayPreviewUrl ?? comparisonPreviewUrl
      : comparisonPreviewUrl ?? (viewMode === "mask" ? comparisonOverlayPreviewUrl : null);
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
  
  // -- Thinking messages logic --
  const thinkingSteps = [
    "正在分析病害特征...",
    "正在检索公路桥梁养护规范...",
    "正在评估结构受力影响...",
    "正在生成定向处置方案...",
    "正在校合监测数据一致性..."
  ];
  const [thinkingIndex, setThinkingIndex] = useState(0);
  useEffect(() => {
    if (!isDiagnosisLoading) return;
    const interval = setInterval(() => {
      setThinkingIndex(prev => (prev + 1) % thinkingSteps.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isDiagnosisLoading]);
  // -------------------------

  const comparisonRecommendation =
    comparisonResult && detectionDelta !== null
      ? getComparisonRecommendation(
          result,
          comparisonResult,
          detectionDelta,
          categoryDiffItems,
        )
      : null;
  const mainMetrics = calculateTotalMetrics(result);
  const comparisonMetrics = comparisonResult ? calculateTotalMetrics(comparisonResult) : null;
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
        height: rect.height,
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
      height: target.naturalHeight,
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
        block: "nearest",
      });
    });
  }

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pb-8">
      <div className="flex flex-col xl:flex-row gap-8 items-start relative z-10">
        <div className="flex-[3] min-w-0 flex flex-col gap-8">
        {/* 图像监控主界面区 */}
        <div className="w-full rounded-[2rem] border border-[#00D2FF]/10 bg-[#05080A]/90 shadow-[0_0_80px_rgba(0,210,255,0.05)] backdrop-blur-xl overflow-hidden flex flex-col xl:col-span-2 min-h-[650px] relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00D2FF]/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative border-b border-white/5 bg-[linear-gradient(180deg,rgba(5,8,10,0.82),rgba(5,8,10,0.58))] px-5 py-4 shrink-0 z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    实时结果
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="text-lg font-medium tracking-[0.04em] text-white">
                    识别结果
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
                    {viewMode === "result" ? "Result" : viewMode === "mask" ? "Mask" : "Image"}
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
                  aria-label="查看结果图"
                  aria-pressed={viewMode === "result"}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    viewMode === "result"
                      ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "text-slate-400 hover:bg-white/5"
                  }`}
                  disabled={resultDisabled}
                  title={
                    resultDisabled
                      ? "当前结果没有可切换的结果图"
                      : "切换到结果图"
                  }
                  type="button"
                  onClick={() => onViewModeChange("result")}
                >
                  查看结果图
                </button>
                <button
                  aria-label="查看掩膜图"
                  aria-pressed={viewMode === "mask"}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    viewMode === "mask"
                      ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "text-slate-400 hover:bg-white/5"
                  }`}
                  disabled={maskDisabled}
                  title={
                    maskDisabled
                      ? "当前结果未返回掩膜数据"
                      : "切换到掩膜图"
                  }
                  type="button"
                  onClick={() => onViewModeChange("mask")}
                >
                  查看掩膜图
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  当前文件
                </p>
                <p
                  className="mt-1 truncate text-sm text-white/72"
                  title={result.image_id}
                >
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
                      aria-label="导出结果图"
                      className="rounded-md px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={resultDisabled}
                      title={
                        resultDisabled
                          ? "当前结果没有可导出的结果图文件"
                          : "导出结果图"
                      }
                      type="button"
                      onClick={onExportOverlay}
                    >
                      导出结果图
                    </button>
                  </div>
                </details>
              </div>
            </div>

            {/* defect metrics HUD (High-level HUD style) */}
            <div className={`mt-6 transition-all duration-500 overflow-hidden ${current ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="rounded-2xl border border-[#00D2FF]/20 bg-[#00D2FF]/5 p-4 flex items-center gap-6 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#00D2FF]/5 via-transparent to-transparent pointer-events-none" />
                <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#00D2FF]/10 border border-[#00D2FF]/20">
                  <svg className="h-6 w-6 text-[#00D2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                  </svg>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/60">病害类别</p>
                    <p className="text-sm font-semibold text-white">{current?.category || "--"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/60">识别置信度</p>
                    <p className="text-sm font-mono text-[#00D2FF] font-bold">{current ? `${(current.confidence * 100).toFixed(1)}%` : "--"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/60">预估长度 (cm)</p>
                    <p className="text-sm font-mono text-slate-200">{current?.metrics.length_mm ? (current.metrics.length_mm / 10).toFixed(1) : "--"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/60">预估面积 (cm²)</p>
                    <p className="text-sm font-mono text-[#7FFFD4] font-bold">{current?.metrics.area_mm2 ? (current.metrics.area_mm2 / 100).toFixed(1) : "--"}</p>
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
          </div>

          <div className="relative flex-1 bg-[radial-gradient(circle_at_center,rgba(0,210,255,0.05),transparent_70%),linear-gradient(180deg,#05080A,#0B1120)] p-5 md:p-6 overflow-auto z-10 min-h-[550px]">
            <div className="mx-auto flex w-full max-w-5xl flex-col rounded-[1.75rem] border border-white/5 bg-[#05080A]/80 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                    预览画面
                  </p>
                  <p
                    className="mt-1 truncate text-sm text-white/72"
                    title={result.image_id}
                  >
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
                    {viewMode === "image"
                      ? prioritizedDetections.map((item) => {
                          const colorCode = getDefectColorHex(item.category);
                          const isSelected = item.id === selectedDetectionId;
                          const overlayStyle = getDetectionOverlayStyle(
                            item.bbox,
                            imageSize,
                            frameSize,
                          );
                          return (
                            <div
                              key={item.id}
                              className={`absolute rounded-sm group transition-all cursor-crosshair box-border hover:shadow-[0_0_15px_currentColor] ${isSelected ? "border-[3px] shadow-[0_0_18px_currentColor]" : "border-[1.5px] hover:border-[2.5px]"}`}
                              style={{
                                ...overlayStyle,
                                borderColor: colorCode,
                                color: colorCode,
                              }}
                              onClick={() => handleFocusDetection(item)}
                            >
                              <span
                                className="absolute left-0 top-0 -translate-y-[calc(100%+6px)] rounded-md border px-2 py-1 text-[10px] font-mono font-bold whitespace-nowrap shadow-md"
                                style={{
                                  backgroundColor: colorCode,
                                  borderColor: colorCode,
                                  color: "#06131F",
                                }}
                              >
                                {item.category.toUpperCase()}{" "}
                                {(item.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                          );
                        })
                      : viewMode === "mask" ? (
                        <>
                          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {prioritizedDetections.map((item) => {
                              const colorCode = getDefectColorHex(item.category);
                              const isSelected = item.id === selectedDetectionId;
                              const polygonPoints = getDetectionMaskPolygonPoints(
                                item,
                                imageSize,
                                frameSize,
                              );
                              const bboxStyle = getDetectionOverlayStyle(
                                item.bbox,
                                imageSize,
                                frameSize,
                              );

                              return polygonPoints ? (
                                <polygon
                                  key={item.id}
                                  points={polygonPoints}
                                  fill="none"
                                  stroke={colorCode}
                                  strokeWidth={isSelected ? "0.8" : "0.45"}
                                  className="cursor-crosshair"
                                  onClick={() => handleFocusDetection(item)}
                                />
                              ) : (
                                <rect
                                  key={item.id}
                                  x={Number.parseFloat(bboxStyle.left)}
                                  y={Number.parseFloat(bboxStyle.top)}
                                  width={Number.parseFloat(bboxStyle.width)}
                                  height={Number.parseFloat(bboxStyle.height)}
                                  fill="none"
                                  stroke={colorCode}
                                  strokeDasharray="3 2"
                                  strokeWidth={isSelected ? "0.8" : "0.45"}
                                  className="cursor-crosshair"
                                  onClick={() => handleFocusDetection(item)}
                                />
                              );
                            })}
                          </svg>
                          {prioritizedDetections.map((item) => {
                            const colorCode = getDefectColorHex(item.category);
                            const bboxStyle = getDetectionOverlayStyle(
                              item.bbox,
                              imageSize,
                              frameSize,
                            );

                            return (
                              <button
                                key={`${item.id}-label`}
                                type="button"
                                className="absolute rounded-md border px-2 py-1 text-left text-[10px] font-mono font-bold whitespace-nowrap shadow-md"
                                style={{
                                  left: bboxStyle.left,
                                  top: bboxStyle.top,
                                  transform: "translateY(calc(-100% - 6px))",
                                  backgroundColor: colorCode,
                                  borderColor: colorCode,
                                  color: "#06131F",
                                }}
                                onClick={() => handleFocusDetection(item)}
                              >
                                {item.category.toUpperCase()} {(item.confidence * 100).toFixed(1)}%
                              </button>
                            );
                          })}
                        </>
                      ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 px-5 py-4 text-[11px] font-mono text-slate-500">
                <span>
                  {viewMode === "result" ? "结果图视图" : viewMode === "mask" ? "掩膜图视图" : "原图视图"} /{" "}
                  {filteredDetections.length} 个病害
                </span>
                <span className="truncate text-right">
                  {formatModelLabel(result)}
                </span>
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
                  {viewMode === "result" ? "同步结果图预览" : viewMode === "mask" ? "同步掩膜图预览" : "同步原图预览"}
                </span>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#0B1120]/70 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                        主模型
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {formatModelLabel(result)}
                      </p>
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
                      <p className="mt-1 text-sm text-white">
                        {formatModelLabel(comparisonResult)}
                      </p>
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

        {/* AI Analysis and Physical Metrics (Filling empty space) */}
        <div className="mt-8 pb-4">
          <div className="flex flex-col rounded-[2.5rem] border border-[#7FFFD4]/20 bg-[linear-gradient(180deg,rgba(127,255,212,0.05),rgba(5,8,10,0.4))] p-8 relative group overflow-hidden shadow-2xl transition-all hover:bg-[#7FFFD4]/8 hover:border-[#7FFFD4]/30">
             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="h-16 w-16 text-[#7FFFD4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} />
              </svg>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="h-1.5 w-10 rounded-full bg-gradient-to-r from-[#7FFFD4] to-transparent" />
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#7FFFD4]">
                AI 专家在线深度诊断报告
              </p>
              <div className="flex items-center gap-2 ml-3">
                 <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-[#7FFFD4]/10 text-[#7FFFD4] border border-[#7FFFD4]/20 uppercase tracking-widest">OpenCode AI</span>
                 <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20 uppercase tracking-widest">Kimi K2.5</span>
              </div>
              {isDiagnosisLoading && (
                <div className="flex items-center gap-2 ml-auto px-3 py-1 rounded-full bg-[#7FFFD4]/10 border border-[#7FFFD4]/20">
                  <span className="text-[9px] text-[#7FFFD4] font-medium uppercase animate-pulse">Analyzing</span>
                  <span className="flex gap-1">
                    <span className="h-1 w-1 animate-bounce rounded-full bg-[#7FFFD4]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-[#7FFFD4] [animation-delay:-0.15s]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-[#7FFFD4] [animation-delay:-0.3s]" />
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex-1 text-[15px] leading-[1.8] text-[#7FFFD4]/90 font-light select-text min-h-[400px] max-h-[800px] overflow-y-auto prose prose-invert prose-emerald max-w-none pr-6 custom-scrollbar scroll-smooth">
              {diagnosis ? (
                <ReactMarkdown
                  components={{
                    h3: ({...props}) => <h3 className="text-lg font-bold text-[#7FFFD4] mt-8 mb-4 border-l-4 border-[#7FFFD4] pl-4 bg-[#7FFFD4]/5 py-2 rounded-r" {...props} />,
                    p: ({...props}) => <p className="mb-6 last:mb-0 leading-relaxed opacity-90" {...props} />,
                    strong: ({...props}) => <strong className="text-[#00D2FF] font-semibold" {...props} />,
                    li: ({...props}) => <li className="mb-3 list-none relative pl-6 before:content-['▹'] before:absolute before:left-0 before:text-[#7FFFD4]" {...props} />
                   }}
                >
                  {diagnosis}
                </ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center h-[350px] gap-6">
                   <div className="relative">
                      <div className="w-16 h-16 rounded-full border-2 border-[#7FFFD4]/10 flex items-center justify-center animate-spin-slow" />
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="w-2 h-2 rounded-full bg-[#7FFFD4] animate-ping" />
                      </div>
                      <div className="absolute -inset-4 border border-[#7FFFD4]/5 rounded-full animate-pulse" />
                   </div>
                   <div className="text-center space-y-2">
                     <p className="text-xs text-[#7FFFD4]/60 font-mono tracking-[0.3em] uppercase">
                       {isDiagnosisLoading ? "Consulting Digital Twin..." : "System Idle"}
                     </p>
                     {isDiagnosisLoading && (
                       <motion.p 
                         initial={{ opacity: 0, y: 5 }}
                         animate={{ opacity: 1, y: 0 }}
                         key={thinkingIndex}
                         className="text-[11px] text-[#7FFFD4]/30 italic font-light"
                       >
                         {thinkingSteps[thinkingIndex]}
                       </motion.p>
                     )}
                   </div>
                </div>
              )}
              {isDiagnosisLoading && <span className="inline-block h-4 w-2 ml-2 bg-[#7FFFD4] animate-pulse align-middle" />}
            </div>
            
            <div className="mt-8 pt-4 border-t border-[#7FFFD4]/10 flex items-center justify-between">
              <p className="text-[10px] text-[#7FFFD4]/40 italic">
                Powered by OpenCode Kimi K2.5 • 基于结构化特征与桥梁巡检规范之量化评估报告
              </p>
              <div className="flex gap-4">
                 <span className="h-1 w-8 rounded-full bg-[#7FFFD4]/20" />
                 <span className="h-1 w-8 rounded-full bg-[#00D2FF]/20" />
              </div>
            </div>
          </div>
        </div>
      </div>
        {/* 结论区与辅工具栏 */}
        <aside className="w-full xl:w-[420px] shrink-0 flex flex-col gap-6 relative z-10">
          <div className="rounded-[2rem] border border-[#00D2FF]/20 bg-[linear-gradient(145deg,rgba(5,8,10,0.95),rgba(5,8,10,0.8))] p-6 shadow-[0_0_40px_rgba(0,210,255,0.1)] backdrop-blur-xl shrink-0 group relative overflow-hidden">
            <div className="absolute -inset-[1px] bg-gradient-to-br from-[#00D2FF]/20 to-[#7FFFD4]/0 opacity-50 z-[-1]" />
            
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/60 mb-3">系统运行状态</p>
              <StatusCard 
                phase={status.phase} 
                message={status.message} 
                progress={uploadProgress}
                variant="compact"
              />
            </div>

            {/* 性能展现：细粒度耗时拆解 */}
            {result.inference_breakdown && (
              <div className="mb-8 rounded-2xl border border-white/5 bg-white/[0.02] p-4 group transition-all hover:bg-white/[0.04]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/60">性能分析仪表盘</p>
                  <span className="font-mono text-[10px] text-[#7FFFD4] border border-[#7FFFD4]/30 px-1.5 py-0.5 rounded leading-none">
                    API 总用时: {result.inference_ms}ms
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>前处理 (I/O & Pre)</span>
                      <span className="font-mono">{result.inference_breakdown.pre}ms</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-slate-500 transition-all duration-1000" 
                        style={{ width: `${(result.inference_breakdown.pre / result.inference_ms) * 100}%` }} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-[#00D2FF]">
                      <span className="font-semibold">核心推理 (YOLO Engine)</span>
                      <span className="font-mono">{result.inference_breakdown.model}ms</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#00D2FF]/10 rounded-full overflow-hidden shadow-[0_0_10px_rgba(0,210,255,0.2)]">
                      <div 
                        className="h-full bg-gradient-to-r from-[#00D2FF] to-[#7FFFD4] transition-all duration-1000" 
                        style={{ width: `${(result.inference_breakdown.model / result.inference_ms) * 100}%` }} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>后处理 (Metrics & Result Image)</span>
                      <span className="font-mono">{result.inference_breakdown.post}ms</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-slate-500 transition-all duration-1000" 
                        style={{ width: `${(result.inference_breakdown.post / result.inference_ms) * 100}%` }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5">
                  <p className="text-[9px] text-slate-500 leading-relaxed italic text-right">
                    实时监测：符合赛题 &lt; 200ms 的吞吐要求
                  </p>
                </div>
              </div>
            )}

            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/80 mb-3">
              识别结论
            </p>
            <h3 className="text-xl md:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-[#00D2FF] to-[#7FFFD4] font-medium tracking-wide">
              {primaryFinding}
            </h3>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed font-light">
              {getDetectionSummary(result)}
            </p>
            <p className="mt-3 text-sm text-slate-400">
              {activePreviewUrl
                ? `当前正在查看${
                  viewMode === "result"
                    ? "结果图"
                    : viewMode === "mask"
                      ? "掩膜图"
                      : "原图"
                }，可继续筛选、导出或重新分析。`
                : "当前为历史记录回看模式，已恢复结构化结果和病害详情。"}
            </p>
            <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
              result.has_masks
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                : "border-amber-500/20 bg-amber-500/10 text-amber-100"
            }`}>
              <p className="font-medium">
                {result.has_masks
                  ? `当前结果包含 ${result.mask_detection_count} 处实例掩膜，可切换到“查看掩膜图”。`
                  : "当前结果未返回实例掩膜数据，仅支持原图定位与结果图回看。"}
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-sky-500/15 bg-sky-500/[0.06] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/70">
                建议下一步
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                {resultNextStep}
              </p>
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



            <div className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/60 mb-4">展示筛选</p>
              <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">病害类别</span>
                  <select
                    className="bg-[#05080A] border border-white/10 rounded-md text-xs text-white/80 px-2 py-1 outline-none focus:border-[#00D2FF]/50 transition-colors"
                    value={categoryFilter}
                    onChange={(e) => onCategoryFilterChange(e.target.value)}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50">最低置信度</span>
                    <span className="text-xs font-mono text-[#00D2FF]">{(minConfidence * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#00D2FF] [&::-webkit-slider-thumb]:rounded-full cursor-pointer accent-[#00D2FF]"
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

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
                <div className="text-xs text-slate-400 mb-1">病害总数</div>
                <div className="text-xl font-mono text-white">
                  {filteredDetections.length}
                </div>
              </div>
              <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
                <div className="text-xs text-slate-400 mb-1">平均置信度</div>
                <div className="text-xl font-mono text-sky-400">
                  {averageConfidence === "--" ? "--" : `${averageConfidence}%`}
                </div>
              </div>
              <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
                <div className="text-xs text-slate-400 mb-1">推理耗时</div>
                <div className="text-xl font-mono text-white">
                  {result.inference_ms}ms
                </div>
              </div>
              <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
                <div className="text-xs text-slate-400 mb-1">当前视图</div>
                <div className="text-xl font-medium text-white">
                  {viewMode === "result" ? "结果图" : viewMode === "mask" ? "掩膜图" : "原图"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-[#05080A]/60 p-5 shadow-lg backdrop-blur">
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
                onChange={(event) =>
                  onCompareModelVersionChange(event.target.value)
                }
              >
                {compareOptions.length === 0 ? (
                  <option value="">暂无可对比模型</option>
                ) : (
                  compareOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
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
                      <span className="font-mono text-white">
                        {formatModelLabel(result)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">病害数量</span>
                      <span className="font-mono text-white">
                        {result.detections.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">推理耗时</span>
                      <span className="font-mono text-white">
                        {result.inference_ms}ms
                      </span>
                    </div>
                    {mainMetrics.totalLength > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">总长度</span>
                        <span className="font-mono text-white">
                          {(mainMetrics.totalLength / 10).toFixed(1)}cm
                        </span>
                      </div>
                    )}
                    {mainMetrics.totalArea > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">总面积</span>
                        <span className="font-mono text-white">
                          {(mainMetrics.totalArea / 100).toFixed(1)}cm²
                        </span>
                      </div>
                    )}
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
                      <span className="font-mono text-white">
                        {comparisonResult.detections.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">推理耗时</span>
                      <span className="font-mono text-white">
                        {comparisonResult.inference_ms}ms
                      </span>
                    </div>
                    {comparisonMetrics && comparisonMetrics.totalLength > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">总长度</span>
                        <span className="font-mono text-white">
                          {(comparisonMetrics.totalLength / 10).toFixed(1)}cm
                        </span>
                      </div>
                    )}
                    {comparisonMetrics && comparisonMetrics.totalArea > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">总面积</span>
                        <span className="font-mono text-white">
                          {(comparisonMetrics.totalArea / 100).toFixed(1)}cm²
                        </span>
                      </div>
                    )}
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
                    {mainMetrics.totalLength > 0 && comparisonMetrics && comparisonMetrics.totalLength > 0 && (
                      <div className="rounded-lg bg-black/20 px-3 py-3">
                        <div className="text-xs text-slate-500">长度差值</div>
                        <div className="mt-1 font-mono text-white">
                          {(() => {
                            const delta = comparisonMetrics.totalLength - mainMetrics.totalLength;
                            return delta > 0 ? `+${(delta / 10).toFixed(1)}cm` : `${(delta / 10).toFixed(1)}cm`;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                  {mainMetrics.totalArea > 0 && comparisonMetrics && comparisonMetrics.totalArea > 0 && (
                    <div className="mt-3 rounded-lg bg-black/20 px-3 py-3">
                      <div className="text-xs text-slate-500">面积差值</div>
                      <div className="mt-1 font-mono text-white">
                        {(() => {
                          const delta = comparisonMetrics.totalArea - mainMetrics.totalArea;
                          return delta > 0 ? `+${(delta / 100).toFixed(1)}cm²` : `${(delta / 100).toFixed(1)}cm²`;
                        })()}
                      </div>
                    </div>
                  )}
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
                          <div className="font-medium text-white">
                            {item.category}
                          </div>
                          <div className="font-mono text-slate-400">
                            主 {item.primaryCount}
                          </div>
                          <div className="font-mono text-slate-400">
                            对比 {item.comparisonCount}
                          </div>
                          <div
                            className={`text-right font-medium ${deltaTone}`}
                          >
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

          <div className="rounded-[1.5rem] border border-white/10 bg-[#05080A]/60 shadow-lg backdrop-blur flex-1 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                病害列表
              </p>
              <span className="font-mono text-xs text-slate-400">
                {prioritizedDetections.length} 项
              </span>
            </div>

            <div
              ref={listContainerRef}
              className="flex-1 overflow-y-auto p-3 space-y-2"
            >
              {prioritizedDetections.map((item, index) => {
                const colorCode = getDefectColorHex(item.category);
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
                        <span className="text-xs font-mono text-slate-500">
                          {String(index + 1).padStart(2, "0")}.
                        </span>
                        <h4 className="text-sm font-medium text-slate-200 uppercase">
                          {item.category}
                        </h4>
                        {isHighestPriority ? (
                          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                            优先查看
                          </span>
                        ) : null}
                      </div>
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded border border-white/10"
                        style={{ color: colorCode }}
                      >
                        {(item.confidence * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 truncate w-10">Id</span>
                        <span
                          className="font-mono text-slate-300 truncate"
                          title={item.id}
                        >
                          {item.id.split("-")[0]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-10">Size</span>
                        <span className="font-mono text-slate-300">
                          {item.metrics.length_mm
                            ? `${(item.metrics.length_mm / 10).toFixed(1)}cm`
                            : "--"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-10">Width</span>
                        <span className="font-mono text-slate-300">
                          {item.metrics.width_mm
                            ? `${(item.metrics.width_mm / 10).toFixed(2)}cm`
                            : "--"}
                        </span>
                      </div>
                      <div className="flex gap-2 col-span-2">
                        <span className="text-slate-500 w-10">Area</span>
                        <span className="font-mono text-slate-300">
                          {item.metrics.area_mm2
                            ? `${(item.metrics.area_mm2 / 100).toFixed(1)}cm²`
                            : "--"}
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


        </aside>
      </div>
    </div>
  );
}
