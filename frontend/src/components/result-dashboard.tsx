import { useEffect, useRef, useState, useMemo, type SyntheticEvent } from "react";

import { StatusCard } from "@/components/status-card";
import { ComparisonWorkbench } from "@/components/result-dashboard-parts/comparison-workbench";
import { DetectionListPanel } from "@/components/result-dashboard-parts/detection-list-panel";
import { DiagnosisPanel } from "@/components/result-dashboard-parts/diagnosis-panel";
import { ExportModal } from "@/components/result-dashboard-parts/export-modal";
import { FocusedDetectionHud } from "@/components/result-dashboard-parts/focused-detection-hud";
import { ResultDashboardInsights } from "@/components/result-dashboard-parts/result-dashboard-insights";
import { ResultImageStage } from "@/components/result-dashboard-parts/result-image-stage";
import { ResultDashboardToolbar } from "@/components/result-dashboard-parts/result-dashboard-toolbar";
import { formatModelLabel } from "@/lib/model-labels";
import { filterDetections } from "@/lib/result-utils";
import { getEnhancedImageUrl, getEnhancedOverlayUrl } from "@/lib/predict-client";
import type { Detection, PredictionResult, PredictState } from "@/lib/types";
import { useComparison } from "@/hooks/use-comparison";
import { useResultDiagnosis } from "./use-result-diagnosis";

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
  const frameRef = useRef<HTMLDivElement>(null);
  const detectionItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [showComparisonDetails, setShowComparisonDetails] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [comparisonViewMode, setComparisonViewMode] = useState<"master" | "comparison" | "diff">("master");

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
  const {
    diagnosis,
    generateDiagnosis,
    hasStoredDiagnosis,
    isDiagnosisLoading,
    thinkingIndex,
    thinkingSteps
  } = useResultDiagnosis({
    diagnosisMode,
    imageId: result.image_id
  });

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

        <ResultDashboardInsights
          categories={categories}
          categoryFilter={categoryFilter}
          currentDetection={current}
          minConfidence={minConfidence}
          onCategoryFilterChange={onCategoryFilterChange}
          onMinConfidenceChange={onMinConfidenceChange}
          result={result}
          status={status}
          uploadProgress={uploadProgress}
          viewMode={viewMode}
        />
      </div>

      <DiagnosisPanel
        diagnosis={diagnosis}
        diagnosisMode={diagnosisMode}
        hasStoredDiagnosis={hasStoredDiagnosis}
        isDiagnosisLoading={isDiagnosisLoading}
        onGenerateDiagnosis={() => {
          void generateDiagnosis();
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
