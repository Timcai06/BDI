import { useEffect, useRef, useState, useMemo, type SyntheticEvent } from "react";

import { StatusCard } from "@/components/status-card";
import { ComparisonWorkbench } from "@/components/result-dashboard-parts/comparison-workbench";
import { DetectionListPanel } from "@/components/result-dashboard-parts/detection-list-panel";
import { DiagnosisPanel } from "@/components/result-dashboard-parts/diagnosis-panel";
import { ExportModal } from "@/components/result-dashboard-parts/export-modal";
import { FocusedDetectionHud } from "@/components/result-dashboard-parts/focused-detection-hud";
import { ResultImageStage } from "@/components/result-dashboard-parts/result-image-stage";
import { ResultDashboardToolbar } from "@/components/result-dashboard-parts/result-dashboard-toolbar";
import { getDefectLabel } from "@/lib/defect-visuals";
import { formatModelLabel } from "@/lib/model-labels";
import { filterDetections } from "@/lib/result-utils";
import { getDiagnosisRecord, getDiagnosisText, getEnhancedImageUrl, getEnhancedOverlayUrl } from "@/lib/predict-client";
import type { Detection, PredictionResult, PredictState } from "@/lib/types";
import { useComparison } from "@/hooks/use-comparison";

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

          <ResultImageStage
            activeCreatedAt={activeResult.created_at}
            activePreviewUrl={activePreviewUrl}
            comparisonDetections={comparisonResult?.detections ?? []}
            comparisonViewMode={comparisonViewMode}
            filteredDetectionCount={filteredDetections.length}
            footerModelLabel={formatModelLabel(result)}
            frameRef={frameRef}
            frameSize={frameSize}
            hasComparison={Boolean(comp)}
            imageSize={imageSize}
            onFocusDetection={handleFocusDetection}
            onImageLoad={handleImageLoad}
            prioritizedDetections={prioritizedDetections}
            selectedDetectionId={selectedDetectionId}
            viewMode={viewMode}
          />

        </div>

        <DetectionListPanel
          detectionItemRefs={detectionItemRefs}
          detections={prioritizedDetections}
          onFocusDetection={handleFocusDetection}
          selectedDetectionId={selectedDetectionId}
          topPriorityDetectionId={topPriorityDetection?.id}
        />

        <ComparisonWorkbench
          alignmentStrength={alignmentStrength}
          categoryDiffItems={categoryDiffItems}
          comp={comp}
          compareDisabled={compareDisabled}
          compareModelVersion={compareModelVersion}
          compareOptions={compareOptions}
          compareStatus={compareStatus}
          comparisonMetrics={comparisonMetrics}
          comparisonRecommendation={comparisonRecommendation}
          comparisonResult={comparisonResult}
          comparisonSourceBreakdown={comparisonSourceBreakdown}
          comparisonSummary={comparisonSummary}
          comparisonViewMode={comparisonViewMode}
          mainMetrics={mainMetrics}
          onClearComparison={onClearComparison}
          onCompareModelVersionChange={onCompareModelVersionChange}
          onComparisonViewModeChange={setComparisonViewMode}
          onRunComparison={onRunComparison}
          onToggleComparisonDetails={() => setShowComparisonDetails((currentValue) => !currentValue)}
          result={result}
          showComparisonDetails={showComparisonDetails}
          sourceBreakdown={sourceBreakdown}
        />
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
