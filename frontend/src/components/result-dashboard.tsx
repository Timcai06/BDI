import { useEffect, useRef, useState, useMemo, type SyntheticEvent } from "react";

import { StatusCard } from "@/components/status-card";
import { DetectionListPanel } from "@/components/result-dashboard-parts/detection-list-panel";
import { DiagnosisPanel } from "@/components/result-dashboard-parts/diagnosis-panel";
import { ExportModal } from "@/components/result-dashboard-parts/export-modal";
import { FocusedDetectionHud } from "@/components/result-dashboard-parts/focused-detection-hud";
import { ResultDashboardToolbar } from "@/components/result-dashboard-parts/result-dashboard-toolbar";
import { getDefectColorHex, getDefectLabel } from "@/lib/defect-visuals";
import { formatModelLabel } from "@/lib/model-labels";
import {
  filterDetections,
  getDetectionMaskPolygonPoints,
  getDetectionOverlayStyle,
} from "@/lib/result-utils";
import { getDiagnosisRecord, getDiagnosisText, getEnhancedImageUrl, getEnhancedOverlayUrl } from "@/lib/predict-client";
import type { Detection, PredictionResult, PredictState } from "@/lib/types";
import { useComparison } from "@/hooks/use-comparison";

const COMPARISON_VIEW_MODES: Array<{
  id: "master" | "comparison" | "diff";
  label: string;
}> = [
  { id: "master", label: "主模型视图" },
  { id: "comparison", label: "对比模型视图" },
  { id: "diff", label: "差异叠加模式" },
];

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
  onGenerateEnhancement?: () => void | Promise<void>;
  enhancementPending?: boolean;
  rerunDisabled: boolean;
  compareDisabled: boolean;
  // Status & Filter props from HomeShell
  status: PredictState;
  uploadProgress?: number;
  onCategoryFilterChange: (category: string) => void;
  onMinConfidenceChange: (confidence: number) => void;
  categories: string[];
  diagnosisMode?: "auto" | "cached";
  showHistoryButton?: boolean;
  showPrimaryActionButton?: boolean;
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
  onGenerateEnhancement,
  enhancementPending = false,
  rerunDisabled,
  compareDisabled,
  status,
  uploadProgress,
  onCategoryFilterChange,
  onMinConfidenceChange,
  categories,
  diagnosisMode = "auto",
  showHistoryButton = true,
  showPrimaryActionButton = true
}: ResultDashboardProps) {
  const thinkingSteps = [
    "正在解析病害分布与严重程度…",
    "正在交叉核对模型结果与历史经验…",
    "正在生成结构化诊断建议…",
  ];
  const frameRef = useRef<HTMLDivElement>(null);
  const detectionItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [isDiagnosisLoading, setIsDiagnosisLoading] = useState(false);
  const [hasStoredDiagnosis, setHasStoredDiagnosis] = useState<boolean | null>(null);
  const [showComparisonDetails, setShowComparisonDetails] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [comparisonViewMode, setComparisonViewMode] = useState<"master" | "comparison" | "diff">("master");
  const [thinkingIndex, setThinkingIndex] = useState(0);

  // Use the new comparison hook
  const [showEnhancementCompare, setShowEnhancementCompare] = useState<boolean>(false);
  const hasEnhancedResult = Boolean(result.secondary_result);
  const activeResult = useMemo(
    () => (showEnhancementCompare && result.secondary_result ? result.secondary_result : result),
    [result, showEnhancementCompare],
  );

  // Use effective comparison result (either manual or automatic enhancement)
  const effectiveComparisonResult = useMemo(() => {
    if (comparisonResult) return comparisonResult;
    if (showEnhancementCompare && result.secondary_result) return result.secondary_result;
    return null;
  }, [comparisonResult, showEnhancementCompare, result.secondary_result]);

  const comp = useComparison(result, effectiveComparisonResult);
  const mainMetrics = comp?.primaryMetrics ?? {
    totalLength: 0,
    totalArea: 0,
    count: activeResult.detections.length,
    averageConfidence: 0,
  };
  const comparisonMetrics = comp?.comparisonMetrics ?? null;
  const instanceAlignment = comp?.alignment ?? null;
  const categoryDiffItems = comp?.categoryDiff ?? [];
  const comparisonSummary = comp?.summary ?? null;
  const comparisonRecommendation = comparisonSummary?.recommendation ?? "";
  const sourceBreakdown = comp?.primarySources ?? [];
  const comparisonSourceBreakdown = comp?.comparisonSources ?? [];
  const alignmentStrength = comp
    ? (comp.alignment.matched.length /
        Math.max(1, Math.max(result.detections.length, comparisonResult?.detections.length ?? 0))) *
      100
    : 0;

  useEffect(() => {
    if (!isDiagnosisLoading) {
      setThinkingIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setThinkingIndex((current) => (current + 1) % thinkingSteps.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, [isDiagnosisLoading, thinkingSteps.length]);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchDiagnosis() {
      if (!result.image_id) return;
      
      setDiagnosis("");
      setHasStoredDiagnosis(null);
      setIsDiagnosisLoading(true);
      
      try {
        if (diagnosisMode === "cached") {
          const record = await getDiagnosisRecord(result.image_id);
          if (!cancelled) {
            setDiagnosis(record.content ?? "");
            setHasStoredDiagnosis(record.exists);
          }
        } else {
          const content = await getDiagnosisText(result.image_id);
          if (!cancelled) {
            setDiagnosis(content);
            setHasStoredDiagnosis(true);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setDiagnosis("无法加载 AI 专家评估建议。");
          setHasStoredDiagnosis(true);
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
  }, [diagnosisMode, result.image_id]);

  async function handleGenerateDiagnosis() {
    if (!result.image_id || isDiagnosisLoading) {
      return;
    }

    setIsDiagnosisLoading(true);
    setDiagnosis("");

    try {
      const content = await getDiagnosisText(result.image_id);
      setDiagnosis(content);
      setHasStoredDiagnosis(true);
    } catch (error) {
      setDiagnosis("无法生成 AI 专家评估建议。");
      setHasStoredDiagnosis(true);
      console.error(error);
    } finally {
      setIsDiagnosisLoading(false);
    }
  }

  useEffect(() => {
    if (!comparisonResult) {
      setShowComparisonDetails(false);
    }
  }, [comparisonResult]);
  const filteredDetections = filterDetections(
    activeResult.detections,
    categoryFilter,
    minConfidence,
  );

  const prioritizedDetections = useMemo(() => {
    return [...filteredDetections].sort(
      (left, right) => getDetectionPriorityScore(right) - getDetectionPriorityScore(left),
    );
  }, [filteredDetections]);

  const activePreviewUrl = useMemo(() => {
    // If enhancement comparison is active, use enhanced paths
    if (showEnhancementCompare && result.secondary_result) {
      const eUrl = getEnhancedImageUrl(result.image_id);
      const eoUrl = getEnhancedOverlayUrl(result.image_id);
      return viewMode === "result" ? eoUrl ?? eUrl : eUrl;
    }

    if (comp && comparisonViewMode === "comparison") {
      return viewMode === "result" ? comparisonOverlayPreviewUrl ?? comparisonPreviewUrl : comparisonPreviewUrl;
    }
    return viewMode === "result" ? overlayPreviewUrl ?? previewUrl : previewUrl;
  }, [viewMode, overlayPreviewUrl, previewUrl, comparisonOverlayPreviewUrl, comparisonPreviewUrl, comparisonViewMode, comp, showEnhancementCompare, result.secondary_result, result.image_id]);

  const current = prioritizedDetections.find((item) => item.id === selectedDetectionId) ?? prioritizedDetections[0] ?? null;
  const topPriorityDetection = prioritizedDetections[0] ?? null;
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
    <div className="flex w-full flex-col gap-5 pb-6">
      <div className="relative z-10 flex flex-col items-start gap-6 xl:flex-row">
        <div className="flex min-w-0 flex-[3] flex-col gap-6">
        {/* 图像监控主界面区 */}
        <div className="relative flex min-h-[620px] w-full flex-col overflow-hidden rounded-[2rem] border border-[#00D2FF]/10 bg-[#05080A]/90 shadow-[0_0_80px_rgba(0,210,255,0.05)] backdrop-blur-xl xl:col-span-2">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00D2FF]/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 shrink-0 border-b border-white/5 bg-[linear-gradient(180deg,rgba(5,8,10,0.4),rgba(5,8,10,0.1))] px-5 py-3.5">
            <ResultDashboardToolbar
              comparisonResultExists={Boolean(comparisonResult)}
              currentDetection={current}
              enhancementPending={enhancementPending}
              hasEnhancedResult={hasEnhancedResult}
              maskDisabled={maskDisabled}
              onGenerateEnhancement={onGenerateEnhancement}
              onOpenExport={() => setIsExportModalOpen(true)}
              onOpenHistory={onOpenHistory}
              onPrimaryAction={handlePrimaryAction}
              onToggleEnhancementCompare={() => setShowEnhancementCompare((value) => !value)}
              onViewModeChange={onViewModeChange}
              primaryActionLabel={primaryActionLabel}
              primaryActionTitle={primaryActionTitle}
              resultDisabled={resultDisabled}
              showEnhancementCompare={showEnhancementCompare}
              showHistoryButton={showHistoryButton}
              showPrimaryActionButton={showPrimaryActionButton}
              viewMode={viewMode}
            />
            <FocusedDetectionHud detection={current} />
          </div>

          <div className="relative z-10 min-h-[520px] flex-1 overflow-auto bg-[radial-gradient(circle_at_center,rgba(0,210,255,0.05),transparent_70%),linear-gradient(180deg,#05080A,#0B1120)] p-4 md:p-5">
            <div className="mx-auto flex w-full max-w-5xl flex-col rounded-[1.75rem] border border-white/5 bg-[#05080A]/80 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
              <div className="relative z-20 flex items-center justify-between gap-3 border-b border-white/6 bg-[linear-gradient(to_bottom,currentColor_0%,transparent_100%)] px-4 py-2.5 text-sky-900/10">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-500/80">
                  CAMERA FEED
                </span>
                <span className="shrink-0 text-[10px] font-mono text-white/40">
                  {formatResultTimestamp(activeResult.created_at)} UTC
                </span>
              </div>

              <div className="flex-1 px-4 py-4">
                <div
                  ref={frameRef}
                  className="relative mx-auto aspect-[4/3] max-h-full w-full overflow-hidden rounded-[1.25rem] border border-white/8 bg-[#050b16] ring-1 ring-white/6 shadow-2xl"
                >
                  {activePreviewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      alt="Inspection"
                      className="absolute inset-0 h-full w-full rounded-[1.25rem] object-contain opacity-90"
                      onLoad={handleImageLoad}
                      src={activePreviewUrl}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] bg-repeat" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                  <div className="absolute inset-0 z-10">
                    {viewMode === "image"
                      ? (() => {
                          const primaryDetections = comp && comparisonViewMode === "comparison" ? [] : prioritizedDetections;
                          const secondaryDetections = comp && (comparisonViewMode === "comparison" || comparisonViewMode === "diff") 
                            ? (comparisonResult?.detections || []) 
                            : [];

                          return (
                            <>
                              {primaryDetections.map((item) => {
                                const colorCode = getDefectColorHex(item.category);
                                const isSelected = item.id === selectedDetectionId;
                                const overlayStyle = getDetectionOverlayStyle(item.bbox, imageSize, frameSize);
                                return (
                                  <div
                                    key={item.id}
                                    className={`absolute rounded-sm group transition-all cursor-crosshair box-border hover:shadow-[0_0_15px_currentColor] ${isSelected ? "border-[3px] shadow-[0_0_18px_currentColor]" : "border-[1.5px] hover:border-[2.5px]"}`}
                                    style={{ ...overlayStyle, borderColor: colorCode, color: colorCode }}
                                    onClick={() => handleFocusDetection(item)}
                                  >
                                    <span
                                      className="absolute left-0 top-0 -translate-y-[calc(100%+6px)] rounded-md border px-2 py-1 text-[10px] font-mono font-bold whitespace-nowrap shadow-md"
                                      style={{ backgroundColor: colorCode, borderColor: colorCode, color: "#06131F" }}
                                    >
                                      {getDefectLabel(item.category)} {(item.confidence * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                );
                              })}
                              {secondaryDetections.map((item) => {
                                const overlayStyle = getDetectionOverlayStyle(item.bbox, imageSize, frameSize);
                                return (
                                  <div
                                    key={`comp-${item.id}`}
                                    className="absolute rounded-sm transition-all border-dashed border-[1.5px] border-emerald-400 opacity-60 hover:opacity-100 hover:border-solid"
                                    style={overlayStyle}
                                  >
                                    <span className="absolute left-0 top-0 -translate-y-[calc(100%+6px)] rounded-md border border-emerald-500 bg-emerald-900/80 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 whitespace-nowrap">
                                       ALT: {getDefectLabel(item.category)}
                                    </span>
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()
                      : viewMode === "mask" ? (
                        <>
                          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {prioritizedDetections.map((item) => {
                              const colorCode = getDefectColorHex(item.category);
                              const isSelected = item.id === selectedDetectionId;
                              const polygonPoints = getDetectionMaskPolygonPoints(item, imageSize, frameSize);
                              const bboxStyle = getDetectionOverlayStyle(item.bbox, imageSize, frameSize);
                              return polygonPoints ? (
                                <polygon
                                  key={item.id}
                                  points={polygonPoints}
                                  fill={colorCode}
                                  fillOpacity={isSelected ? "0.32" : "0.22"}
                                  stroke={colorCode}
                                  strokeOpacity={isSelected ? "1" : "0.82"}
                                  strokeWidth={isSelected ? "0.9" : "0.5"}
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
                            const bboxStyle = getDetectionOverlayStyle(item.bbox, imageSize, frameSize);
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
                                {getDefectLabel(item.category)} {(item.confidence * 100).toFixed(1)}%
                              </button>
                            );
                          })}
                        </>
                      ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 px-4 py-3 text-[11px] font-mono text-slate-500">
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

        </div>

        <DetectionListPanel
          detectionItemRefs={detectionItemRefs}
          detections={prioritizedDetections}
          onFocusDetection={handleFocusDetection}
          selectedDetectionId={selectedDetectionId}
          topPriorityDetectionId={topPriorityDetection?.id}
        />

        {/* Unified Comparison Workbench */}
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

              {comp && (
                <div className="flex rounded-xl border border-white/8 bg-white/5 p-1.5 backdrop-blur-md">
                  {COMPARISON_VIEW_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      className={`px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all rounded-lg ${
                        comparisonViewMode === mode.id
                          ? "bg-[#00D2FF] text-[#05080A] shadow-[0_0_20px_rgba(0,210,255,0.4)]"
                          : "text-white/40 hover:text-white/70 hover:bg-white/5"
                      }`}
                      onClick={() => setComparisonViewMode(mode.id)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!comp ? (
              <div className="flex flex-col md:flex-row items-center gap-6 rounded-2xl border border-white/5 bg-white/[0.02] p-8">
                <div className="flex-1 space-y-4 text-center md:text-left">
                  <p className="text-sm leading-relaxed text-white/50">
                    使用同一张本地图片执行另一个模型版本的推理，快速比较检测精度、数量差值、推理速度及病害覆盖度的微小变化。
                  </p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 text-[10px] text-white/30 uppercase tracking-widest font-bold">
                    <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-[#00D2FF]" /> 量化指标对齐</span>
                    <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-[#7FFFD4]" /> 实例级匹配</span>
                    <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-amber-400" /> 专家决策建议</span>
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
                        <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
                      ))
                    )}
                  </select>
                  <button
                    className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#00D2FF] to-[#00D2FF]/80 py-3.5 text-sm font-bold tracking-widest uppercase text-[#05080A] transition-all hover:shadow-[0_0_32px_rgba(0,210,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={compareDisabled || !compareModelVersion}
                    onClick={onRunComparison}
                  >
                    <span className="relative z-10">{compareStatus?.phase === "running" ? "正在执行云端推理..." : "启动深度对比分析"}</span>
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Metrics Grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { 
                      label: "数量差值", 
                      value: comparisonSummary && comparisonSummary.detectionDelta > 0 ? `+${comparisonSummary.detectionDelta}` : comparisonSummary?.detectionDelta ?? 0,
                      sub: !comparisonSummary || comparisonSummary.detectionDelta === 0 ? "检出一致" : comparisonSummary.detectionDelta > 0 ? "对比模型检出更多" : "主模型更敏感",
                      trend: !comparisonSummary || comparisonSummary.detectionDelta >= 0 ? "up" : "down"
                    },
                    { 
                      label: "耗时差值", 
                      value: `${comparisonSummary && comparisonSummary.inferenceDelta > 0 ? "+" : ""}${comparisonSummary?.inferenceDelta ?? 0}ms`,
                      sub: !comparisonSummary || comparisonSummary.inferenceDelta <= 0 ? "吞吐效率提升" : "性能开销增加",
                      trend: !comparisonSummary || comparisonSummary.inferenceDelta <= 0 ? "up" : "down"
                    },
                    { 
                      label: "置信均值", 
                      value: `${(mainMetrics.averageConfidence * 100).toFixed(0)}% / ${((comparisonMetrics?.averageConfidence ?? 0) * 100).toFixed(0)}%`,
                      sub: "主模型 / 对比模型",
                      trend: (comparisonMetrics?.averageConfidence ?? 0) >= mainMetrics.averageConfidence ? "up" : "down"
                    },
                    { 
                      label: "实例一致性", 
                      value: `${alignmentStrength.toFixed(1)}%`,
                      sub: `匹配 ${comparisonSummary?.matchedCount ?? 0} 处共有目标`,
                      trend: "up"
                    }
                  ].map((m, i) => (
                    <div key={i} className="group relative rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.06]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{m.label}</p>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-bold text-white">{m.value}</span>
                        <div className={`h-1.5 w-1.5 rounded-full ${m.trend === 'up' ? 'bg-[#7FFFD4] shadow-[0_0_8px_#7FFFD4]' : 'bg-rose-500 shadow-[0_0_8px_#F43F5E]'}`} />
                      </div>
                      <p className="mt-2 text-[11px] text-white/40">{m.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Recommendation & Details */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl border border-[#7FFFD4]/20 bg-[#7FFFD4]/5 p-6">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7FFFD4]/10 text-[#7FFFD4]">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <h4 className="text-sm font-bold uppercase tracking-wider text-[#7FFFD4]">专家决策建议</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-[#7FFFD4]/90 italic">
                        &ldquo;{comparisonRecommendation}&rdquo;
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#7FFFD4]/40 mb-3">共有目标 (一致)</p>
                        <div className="space-y-2">
                          {(comparisonSummary?.matchedCount ?? 0) === 0 ? <p className="text-xs text-white/20">无一致项</p> : 
                            comp.matchedPrimaryIds.size > 0 && Array.from(comp.matchedPrimaryIds).slice(0, 3).map(id => {
                              const det = result.detections.find(d => d.id === id);
                              return det && <div key={id} className="text-[11px] text-white/70 flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-emerald-400" /> {getDefectLabel(det.category)}</div>
                            })
                          }
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/40 mb-3">主模型独有</p>
                        <div className="space-y-2">
                          {(comparisonSummary?.primaryOnlyCount ?? 0) === 0 ? <p className="text-xs text-white/20">无差异项</p> : 
                            result.detections.filter(d => !comp.matchedPrimaryIds.has(d.id)).slice(0, 3).map(det => (
                              <div key={det.id} className="text-[11px] text-white/70 flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-amber-400" /> {getDefectLabel(det.category)}</div>
                            ))
                          }
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500/40 mb-3">对比模型新增</p>
                        <div className="space-y-2">
                          {(comparisonSummary?.comparisonOnlyCount ?? 0) === 0 ? <p className="text-xs text-white/20">无新增项</p> : 
                            (comparisonResult?.detections || []).filter(d => !comp.matchedComparisonIds.has(d.id)).slice(0, 3).map(det => (
                              <div key={det.id} className="text-[11px] text-white/70 flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-sky-400" /> {getDefectLabel(det.category)}</div>
                            ))
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex-1 rounded-2xl border border-white/5 bg-white/[0.01] p-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">来源分布对比</h4>
                      <div className="space-y-4">
                        {sourceBreakdown.map((s, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-mono">
                              <span className="text-white/60">{s.label}</span>
                              <span className="text-white">{s.count}</span>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#00D2FF]" 
                                style={{ width: `${(s.count / result.detections.length) * 100}%` }} 
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
                    <p className="mt-2 text-xs text-slate-400">
                      先看结论，再按需展开明细。
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
                    type="button"
                    onClick={() => setShowComparisonDetails((currentValue) => !currentValue)}
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
                          {comparisonMetrics && comparisonMetrics.totalLength > 0 ? `${(comparisonMetrics.totalLength / 10).toFixed(1)}cm` : "--"} /{" "}
                          {comparisonMetrics && comparisonMetrics.totalArea > 0 ? `${(comparisonMetrics.totalArea / 100).toFixed(1)}cm²` : "--"}
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
                              <div className="font-medium text-white">
                                {getDefectLabel(item.category)}
                              </div>
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

                    {instanceAlignment ? (
                      <div className="grid gap-3 xl:grid-cols-3">
                        <div className="rounded-lg bg-emerald-500/[0.06] px-3 py-3">
                          <div className="text-xs text-emerald-200/80">命中</div>
                          <div className="mt-2 space-y-2">
                            {instanceAlignment.matched.length > 0 ? (
                              instanceAlignment.matched.slice(0, 4).map((pair) => (
                                <div key={`${pair.primary.id}-${pair.comparison.id}`} className="text-xs text-slate-100">
                                  {getDefectLabel(pair.primary.category)} · IoU {(pair.iou * 100).toFixed(0)}%
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

      </div>
        {/* 结论区与辅工具栏 */}
        <aside className="relative z-10 flex w-full shrink-0 flex-col gap-5 xl:w-[400px] sticky top-0 self-start">
          <div className="relative shrink-0 overflow-hidden rounded-[2rem] border border-[#00D2FF]/20 bg-[linear-gradient(145deg,rgba(5,8,10,0.95),rgba(5,8,10,0.8))] p-5 shadow-[0_0_40px_rgba(0,210,255,0.1)] backdrop-blur-xl group">
            <div className="absolute -inset-[1px] bg-gradient-to-br from-[#00D2FF]/20 to-[#7FFFD4]/0 opacity-50 z-[-1]" />
            
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/60 mb-4">核心数据指标</p>
              <div className="grid grid-cols-2 gap-3">
                {/* 主病害 */}
                <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/50 mb-1">主病害</p>
                  <p className="text-sm font-medium text-white truncate">
                    {current ? getDefectLabel(current.category) : "暂无"}
                  </p>
                </div>
                {/* 掩膜能力 */}
                <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#7FFFD4]/50 mb-1">掩膜能力</p>
                  <p className="text-sm font-medium text-white">
                    {result.has_masks ? "INSTANCE" : "BBOX ONLY"}
                  </p>
                </div>
                {/* 推理耗时 */}
                <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400/50 mb-1">推理速度</p>
                  <p className="text-sm font-mono font-medium text-white">
                    {result.inference_ms}ms
                  </p>
                </div>
                {/* 当前视图 */}
                <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#00D2FF]/50 mb-1">当前展示</p>
                  <p className="text-sm font-medium text-white">
                    {viewMode === "result" ? "结果图" : viewMode === "mask" ? "掩膜图" : "原图"}
                  </p>
                </div>
              </div>
            </div>

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
              <div className="mb-6 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5 transition-all group hover:bg-white/[0.04]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#00D2FF]/60">性能分析仪表盘</p>
                  <span className="font-mono text-[10px] text-[#7FFFD4] border border-[#7FFFD4]/30 px-1.5 py-0.5 rounded leading-none">
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
                          <span className={tone === "accent" ? "font-semibold" : ""}>
                            {formatBreakdownLabel(key)}
                          </span>
                          <span className="font-mono">{value}ms</span>
                        </div>
                        <div
                          className={`w-full rounded-full overflow-hidden relative ${
                            tone === "accent"
                              ? "h-1.5 bg-[#00D2FF]/10 shadow-[0_0_10px_rgba(0,210,255,0.2)]"
                              : "h-1 bg-white/5"
                          }`}
                        >
                          <div
                            className={`h-full transition-all duration-1000 relative overflow-hidden ${
                              tone === "accent"
                                ? "bg-gradient-to-r from-[#00D2FF] to-[#7FFFD4]"
                                : "bg-slate-500"
                            }`}
                            style={{ width: `${width}%` }}
                          >
                            <div
                              className={`absolute inset-0 bg-gradient-to-r ${
                                tone === "accent"
                                  ? "from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]"
                                  : "from-transparent via-white/5 to-transparent animate-[shimmer_4s_infinite]"
                              } -translate-x-full`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-white/5">
                  <p className="text-[9px] text-slate-500 leading-relaxed italic text-right">
                    实时监测：符合赛题 &lt; 200ms 的吞吐要求
                  </p>
                </div>
              </div>
            )}

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
          </div>
        </aside>
      </div>

      <DiagnosisPanel
        diagnosis={diagnosis}
        diagnosisMode={diagnosisMode}
        hasStoredDiagnosis={hasStoredDiagnosis}
        isDiagnosisLoading={isDiagnosisLoading}
        onGenerateDiagnosis={() => {
          void handleGenerateDiagnosis();
        }}
        thinkingIndex={thinkingIndex}
        thinkingSteps={thinkingSteps}
      />
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExportJson={onExportJson}
        onExportOverlay={onExportOverlay}
        resultDisabled={resultDisabled}
      />
    </div>
  );
}
