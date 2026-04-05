"use client";

import {
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";

import { DashboardRightRail } from "@/components/dashboard-right-rail";
import { classifyError, type ErrorType } from "@/components/error-message";
import { type ValidationError } from "@/components/file-validator";
import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { ResultDashboard } from "@/components/result-dashboard";
import { ScanAnimation } from "@/components/scan-animation";
import { StatusCard } from "@/components/status-card";
import { useActionNotices } from "@/hooks/use-action-notices";
import { useHistorySummary } from "@/hooks/use-history-summary";
import { useModelCatalog } from "@/hooks/use-model-catalog";
import { getDefectLabel } from "@/lib/defect-visuals";
import { formatModelLabel } from "@/lib/model-labels";
import {
  getOverlayDownloadUrl,
  getResultImageFile,
  getResultImageUrl,
  predictImage
} from "@/lib/predict-client";
import {
  getUploadSizeError
} from "@/lib/upload-validation";
import type { PredictState, PredictionResult } from "@/lib/types";

const initialState: PredictState = {
  phase: "idle",
  message: "选择一张桥梁巡检图像后，即可触发单图识别与结果展示。"
};

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadRemoteFile(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.click();
}

export function HomeShell() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confidence, setConfidence] = useState(0.45);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);

  const [exportOverlay, setExportOverlay] = useState(true);
  const [enhance, setEnhance] = useState(true);
  const [result] = useState<PredictionResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<PredictionResult | null>(null);
  const [compareStatus, setCompareStatus] = useState<PredictState>({
    phase: "idle",
    message: "选择一个次模型后，可对同一张本地图片执行快速对比。"
  });
  const [status, setStatus] = useState<PredictState>(initialState);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scanPhase, setScanPhase] = useState<"uploading" | "analyzing" | "detecting" | "complete">("uploading");
  const { actionNotices, pushActionNotice } = useActionNotices();
  
  // Error handling states
  const [, setLastError] = useState<{
    type: ErrorType;
    message: string;
  } | null>(null);
  const [, setValidationErrors] = useState<ValidationError[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [resultViewMode, setResultViewMode] = useState<"image" | "result" | "mask">("image");
  const [pixelsPerMm, ] = useState(10.0);
  const {
    availableModels,
    compareModelVersion,
    modelsError,
    modelsLoading,
    selectedModelVersion,
    setCompareModelVersion,
    setSelectedModelVersion,
  } = useModelCatalog();
  const { historyTotal, loadHistory } = useHistorySummary({
    onLoadError: (message) => {
      setStatus({
        phase: "error",
        message
      });
      pushActionNotice("历史加载失败", message, "error");
    },
    onLoadSuccess: (history, options) => {
      if (options.silent) {
        return;
      }

      setStatus({
        phase: "success",
        message: `历史结果已刷新，当前共 ${history.total} 条记录。`
      });
      pushActionNotice("历史已刷新", `当前共 ${history.total} 条记录。`, "success");
    }
  });

  useEffect(() => {
    void loadHistory({ silent: true });
  }, [loadHistory]);

  const deferredCategoryFilter = useDeferredValue(categoryFilter);
  const deferredMinConfidence = useDeferredValue(minConfidence);

  const categories = result
    ? ["全部", ...new Set(result.detections.map((item) => getDefectLabel(item.category)))]
    : ["全部"];
  const canUseResultImageForCompare = Boolean(result && getResultImageUrl(result.image_id));
  const comparisonPreviewUrl = comparisonResult
    ? getResultImageUrl(comparisonResult.image_id) ?? previewUrl
    : null;
  const comparisonOverlayPreviewUrl = comparisonResult
    ? getOverlayDownloadUrl(comparisonResult.image_id) ?? comparisonResult.artifacts.overlay_path ?? null
    : null;
  const compareOptions = availableModels
    .filter((model) => model.model_version !== result?.model_version)
    .map((model) => ({
      value: model.model_version,
      label: `${formatModelLabel(model)} · ${model.backend}${model.is_active ? " · active" : ""}${!model.is_available ? " (环境未就绪)" : ""}`,
      disabled: !model.is_available
    }));
  const rightRailSections = result
    ? [
        {
          title: "当前结果",
          value: `${result.detections.length} 处病害`,
          hint: `主模型 ${formatModelLabel(result)}`,
          tone: "sky" as const,
        },
        {
          title: "掩膜能力",
          value: result.has_masks ? `MASK ${result.mask_detection_count}` : "BBOX ONLY",
          hint: result.has_masks ? "当前结果包含实例掩膜。" : "当前结果仅返回边界框。",
          tone: result.has_masks ? ("emerald" as const) : ("amber" as const),
        },
        {
          title: "视图模式",
          value:
            resultViewMode === "result"
              ? "结果图"
              : resultViewMode === "mask"
                ? "掩膜图"
                : "原图",
          hint: status.message,
        },
      ]
    : [
        {
          title: "模型数",
          value: `${availableModels.length} 个`,
          hint: modelsLoading ? "正在读取模型目录…" : modelsError ?? "当前可用模型版本总数。",
          tone: "sky" as const,
        },
        {
          title: "历史记录",
          value: `${historyTotal} 条`,
          hint: "系统会在每次识别后自动写入历史记录。",
          tone: "emerald" as const,
        },
        {
          title: "运行状态",
          value: status.phase.toUpperCase(),
          hint: status.message,
        },
      ];

  function handleExportJson() {
    if (!result) {
      return;
    }

    downloadTextFile(
      `${result.image_id}.json`,
      JSON.stringify(result, null, 2),
      "application/json"
    );
    setStatus({
      phase: "success",
      message: `已导出 ${result.image_id} 的 JSON 结果。`
    });
    pushActionNotice("结果 JSON 已导出", `${result.image_id}.json`, "success");
  }

  function handleExportOverlay() {
    if (!result) {
      return;
    }

    const overlayUrl = getOverlayDownloadUrl(result.image_id);
    if (!overlayUrl) {
      setStatus({
        phase: "error",
        message: "当前结果没有可导出的结果图产物。"
      });
      pushActionNotice("结果图导出失败", "当前结果没有可导出的结果图。", "error");
      return;
    }

    downloadRemoteFile(overlayUrl, `${result.image_id}-overlay.png`);
    setStatus({
      phase: "success",
      message: `已触发 ${result.image_id} 的结果图导出。`
    });
    pushActionNotice("结果图已开始下载", `${result.image_id}-overlay.png`, "success");
  }

  function handleResetToUploader() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setResultViewMode("image");
    setStatus(initialState);
    setAnalysisModalOpen(true);
  }

  function closeAnalysisModal() {
    setAnalysisModalOpen(false);
  }

  // 文件大小格式化
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // 拖拽事件处理
  function handleDragEnter(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (status.phase !== "uploading" && status.phase !== "running") {
      setIsDragging(true);
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    // 检查是否真的离开了元素（而不是进入了子元素）
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (status.phase === "uploading" || status.phase === "running") {
      return;
    }

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Validate file
      const errors = validateDroppedFile(file);
      if (errors.length > 0) {
        setValidationErrors(errors);
        setStatus({
          phase: "error",
          message: `文件验证失败: ${errors.map(e => e.message).join(", ")}`
        });
        return;
      }
      
      setValidationErrors([]);
      setLastError(null);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(file);
      previewUrlRef.current = objectUrl;
      setSelectedFile(file);
      setPreviewUrl(objectUrl);
      setStatus(initialState);
    }
  }

  function handleClearFile() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setStatus(initialState);
    setValidationErrors([]);
    setLastError(null);
  }

  // File validation helper
  function validateDroppedFile(file: File): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      errors.push({
        type: "type",
        message: `${file.name} 不是支持的格式 (JPG, JPEG, PNG)`,
        fileName: file.name
      });
    }
    
    // Check file size
    const uploadSizeError = getUploadSizeError(file);
    if (uploadSizeError) {
      errors.push({
        type: "size",
        message: uploadSizeError,
        fileName: file.name
      });
    }
    
    return errors;
  }

  const selectedModel =
    availableModels.find((model) => model.model_version === selectedModelVersion) ?? null;
  const selectedModelSupportsOverlay = selectedModel?.supports_overlay ?? true;

  async function handleRerunCurrentImage() {
    if (!selectedFile) {
      setStatus({
        phase: "error",
        message: "当前记录不是本地待分析图片，请重新上传后再执行重跑。"
      });
      return;
    }

    const syntheticEvent = {
      preventDefault() { }
    } as React.FormEvent<HTMLFormElement>;
    await handleSubmit(syntheticEvent);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setStatus({
        phase: "error",
        message: "请先选择一张 jpg、jpeg 或 png 图像。"
      });
      return;
    }

    const uploadSizeError = getUploadSizeError(selectedFile);
    if (uploadSizeError) {
      setStatus({
        phase: "error",
        message: uploadSizeError
      });
      return;
    }

    // Reset progress to starting state
    setUploadProgress(10);
    setScanPhase("uploading");

    setStatus({
      phase: "uploading",
      message: `正在准备 ${selectedFile.name}...`
    });

    try {
      // Transition immediately to analyzing
      setScanPhase("analyzing");
      setUploadProgress(40);
      setStatus({
        phase: "running",
        message: `正在请求后端执行 ${
          selectedModel ? formatModelLabel(selectedModel) : "当前模型"
        } 推理...`
      });

      const prediction = await predictImage(selectedFile, {
        confidence,
        exportOverlay: exportOverlay && selectedModelSupportsOverlay,
        modelVersion: selectedModelVersion,
        pixelsPerMm,
        enhance: enhance
      });

      // Update to detecting as results arrive
      setScanPhase("detecting");
      setUploadProgress(90);

      // Give a tiny visual confirmation frame before completion
      await new Promise(resolve => setTimeout(resolve, 200));

      setUploadProgress(100);
      setScanPhase("complete");

      void loadHistory({ forceFresh: true });
      setAnalysisModalOpen(false);
      pushActionNotice(
        "识别完成",
        `${prediction.detections.length} 条病害结果已生成。`,
        "success"
      );
      router.push(`/dashboard/history/${prediction.image_id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "识别失败，请检查服务状态后重试。";
      
      // Classify and store error for retry
      const errorType = classifyError(error);
      setLastError({
        type: errorType,
        message
      });

      setStatus({
        phase: "error",
        message
      });
      pushActionNotice("识别失败", message, "error");
    }
  }

  async function handleRunComparison() {
    if (!result) {
      setCompareStatus({
        phase: "error",
        message: "当前没有可用于对比的结果。"
      });
      return;
    }

    if (!compareModelVersion) {
      setCompareStatus({
        phase: "error",
        message: "请先选择一个用于对比的模型版本。"
      });
      return;
    }

    setCompareStatus({
      phase: "running",
      message: `正在使用 ${compareModelVersion} 对同一张图片执行二次推理。`
    });

    try {
      const sourceFile =
        selectedFile ?? (await getResultImageFile(result.image_id));
      const nextComparison = await predictImage(sourceFile, {
        confidence,
        exportOverlay: exportOverlay && selectedModelSupportsOverlay,
        modelVersion: compareModelVersion,
        pixelsPerMm
      });
      setComparisonResult(nextComparison);
      setCompareStatus({
        phase: "success",
        message: `对比完成：${formatModelLabel(result)} vs ${formatModelLabel(nextComparison)}。`
      });
      pushActionNotice(
        "模型对比已完成",
        `${formatModelLabel(result)} 与 ${formatModelLabel(nextComparison)} 的结果已生成。`,
        "success"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "模型对比失败，请稍后重试。";
      setCompareStatus({
        phase: "error",
        message
      });
      pushActionNotice("模型对比失败", message, "error");
    }
  }

  function handleClearComparison() {
    setComparisonResult(null);
    setCompareStatus({
      phase: "idle",
      message: "已清除对比结果，你可以重新选择一个模型版本再次比较。"
    });
  }

  return (
    <>
      <section className="flex-1 flex flex-col min-w-0 bg-black/40 backdrop-blur-3xl relative z-10 transition-all duration-700">
        <div className="px-6 pt-6">
          <OpsPageHeader
            eyebrow="LAB"
            title={result ? `ANALYSIS_LOG: ${result.image_id}` : "LAB_SINGLE_PLAYGROUND"}
            subtitle="SINGLE IMAGE DIAGNOSTIC / REALTIME INFERENCE"
            actions={
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/40">
                SYSTEM_READY
              </span>
            }
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative" style={{ scrollbarGutter: 'stable' }}>
          {!result ? (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center py-12 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 mb-2">
                    <span className="h-1 w-1 rounded-full bg-cyan-400" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400 m-0">
                      INTELLIGENT DIAGNOSTIC HUB
                    </p>
                  </div>
                  <h2 className="text-4xl lg:text-6xl font-black tracking-tighter text-white uppercase leading-none">
                    单图AI深度诊断
                  </h2>
                  <p className="text-white/40 text-sm max-w-2xl mx-auto font-medium uppercase tracking-widest leading-relaxed">
                    上传巡检照片，自动识别并生成高精度分析结果 / <span className="text-cyan-400/40 italic">NEURAL_POWERED</span>
                  </p>
                </div>

                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[28px] blur opacity-20 group-hover:opacity-40 transition-opacity" />
                  <button
                    className="relative w-full rounded-[24px] border border-white/10 bg-black/60 p-10 text-left transition-all hover:bg-black/40 hover:border-white/20 shadow-2xl"
                    type="button"
                    onClick={handleResetToUploader}
                  >
                    <div className="flex items-center justify-between gap-8">
                      <div className="flex items-center gap-10">
                        <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                          <svg className="w-10 h-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ animationDuration: '3s' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-3xl font-black tracking-tight text-white uppercase">激活分析序列</h3>
                          <p className="text-sm text-white/30 uppercase tracking-[0.2em] font-medium">
                            INITIALIZE_INFERENCE_PIPELINE
                          </p>
                        </div>
                      </div>
                      <div className="hidden lg:flex flex-col items-end gap-2 text-right">
                         <span className="text-[10px] font-mono text-cyan-400/40 uppercase tracking-widest">Awaiting File...</span>
                         <div className="h-1 w-32 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full w-1/3 bg-cyan-500/20" />
                         </div>
                      </div>
                    </div>
                  </button>
                </div>

                <section className="space-y-6">
                  <div className="flex items-center gap-4 px-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 m-0">核心流程 / WORKFLOW</h3>
                    <div className="h-[1px] flex-1 bg-white/5" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      {
                        step: "STEP_01",
                        title: "数据注入",
                        description: "选择巡检照片，执行自动格式校验与云端预置。"
                      },
                      {
                        step: "STEP_02",
                        title: "神经推理",
                        description: "调用高精度模型执行裂缝与破损识别，映射异常拓扑。"
                      },
                      {
                        step: "STEP_03",
                        title: "产出诊断",
                        description: "实时生成全要素分析报告，支持多纬度导出与复核。"
                      }
                    ].map((item) => (
                      <div
                        key={item.step}
                        className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.05]"
                      >
                         <div className="absolute top-0 right-0 p-4 font-mono text-[64px] font-black italic text-white/[0.02] pointer-events-none group-hover:text-white/[0.04] transition-colors leading-none">
                           {item.step.split('_')[1]}
                         </div>
                        <p className="text-[10px] font-mono font-black tracking-[0.3em] text-cyan-400 group-hover:text-cyan-300 transition-colors uppercase">{item.step}</p>
                        <h4 className="mt-4 text-xl font-bold text-white uppercase tracking-tight">{item.title}</h4>
                        <p className="mt-4 text-xs font-medium leading-relaxed text-white/30 uppercase tracking-widest">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div>
              <ResultDashboard
                result={result}
                comparisonResult={comparisonResult}
                compareStatus={compareStatus}
                compareModelVersion={compareModelVersion}
                compareOptions={compareOptions}
                categoryFilter={deferredCategoryFilter}
                minConfidence={deferredMinConfidence}
                previewUrl={previewUrl}
                overlayPreviewUrl={getOverlayDownloadUrl((result as PredictionResult).image_id) ?? (result as PredictionResult).artifacts.overlay_path ?? null}
                comparisonPreviewUrl={comparisonPreviewUrl}
                comparisonOverlayPreviewUrl={comparisonOverlayPreviewUrl}
                viewMode={resultViewMode}
                onViewModeChange={setResultViewMode}
                onExportJson={handleExportJson}
                onExportOverlay={handleExportOverlay}
                resultDisabled={!(result as PredictionResult).artifacts.overlay_path}
                maskDisabled={!(result as PredictionResult).has_masks}
                selectedDetectionId={selectedDetectionId}
                onSelectDetection={(detection) => setSelectedDetectionId(detection.id)}
                onOpenHistory={() => {
                  router.push("/dashboard/history");
                }}
                onReset={handleResetToUploader}
                onRerun={() => {
                  void handleRerunCurrentImage();
                }}
                onCompareModelVersionChange={setCompareModelVersion}
                onRunComparison={() => {
                  void handleRunComparison();
                }}
                onClearComparison={handleClearComparison}
                rerunDisabled={!selectedFile}
                compareDisabled={
                  (!selectedFile && !canUseResultImageForCompare) || compareOptions.length === 0
                }
                status={status}
                uploadProgress={uploadProgress}
                onCategoryFilterChange={setCategoryFilter}
                onMinConfidenceChange={setMinConfidence}
                categories={categories}
              />
            </div>
          )}
        </div>
      </section>
      {!result && (
        <DashboardRightRail
          eyebrow="Dashboard / Status"
          title="运行状态"
          description="右侧显示工作台当前模型、历史规模与运行状态，帮助你在开始分析前确认环境。"
          sections={rightRailSections}
        />
      )}

      {analysisModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-3xl overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-[2.5rem] border border-white/10 bg-black/60 p-8 sm:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.8)] my-auto overflow-hidden">
            <div className="relative flex items-start justify-between gap-6 z-10">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 m-0">
                    DIAGNOSTIC_INITIATOR
                  </p>
                </div>
                <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter text-white">
                  启动神经推理序列
                </h2>
                <p className="mt-4 text-xs text-white/30 font-medium uppercase tracking-[0.2em] leading-relaxed max-w-xl">
                  DATA_INGESTION_MODULE: ACTIVATED / AWAITING_VISUAL_PAYLOAD
                </p>
              </div>
              <button
                className="rounded-2xl border border-white/10 bg-white/5 w-12 h-12 flex items-center justify-center text-white/40 transition-all hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 active:scale-95 shadow-lg"
                type="button"
                onClick={closeAnalysisModal}
              >
                ✕
              </button>
            </div>

            <form className="mt-8" onSubmit={handleSubmit}>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
                01_SOURCE_SELECTION
              </p>
              <label
                className={`group relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border transition-all duration-500 overflow-hidden ${
                  isDragging
                    ? "border-cyan-400 bg-cyan-500/10 scale-[1.01] shadow-[0_0_40px_rgba(6,182,212,0.2)]"
                    : selectedFile
                      ? "border-white/20 bg-black/40"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20"
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  name="image"
                  type="file"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    if (nextFile) {
                      const objectUrl = URL.createObjectURL(nextFile);
                      previewUrlRef.current = objectUrl;
                      setSelectedFile(nextFile);
                      setPreviewUrl(objectUrl);
                    }
                  }}
                />

                {previewUrl && (
                  <div className="absolute inset-0 z-0">
                     <img src={previewUrl} alt="preview" className="h-full w-full object-cover opacity-20 blur-xl" />
                  </div>
                )}

                <div className="relative z-10 flex flex-col items-center gap-4 text-center p-8">
                   {selectedFile ? (
                     <div className="space-y-4">
                        <div className="h-20 w-32 rounded-xl border border-white/20 bg-black/40 overflow-hidden mx-auto shadow-2xl">
                           <img src={previewUrl!} alt="mini-preview" className="h-full w-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xl font-black text-white uppercase tracking-tight">{selectedFile.name}</p>
                          <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mt-1">FILE_READY / {formatFileSize(selectedFile.size)}</p>
                        </div>
                        <button type="button" onClick={(e) => { e.preventDefault(); handleClearFile(); }} className="text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest border-b border-rose-500/30 pb-0.5">DISCARD_FILE</button>
                     </div>
                   ) : (
                     <>
                        <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                           <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                           </svg>
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">注入影像数据</h3>
                        <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">DROPS_FILE_TO_BEGIN_ANALYSIS</p>
                     </>
                   )}
                </div>

                {(status.phase === "uploading" || status.phase === "running") && (
                  <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-12">
                     <ScanAnimation phase={scanPhase} progress={uploadProgress} />
                     <div className="mt-12 w-full max-w-md">
                        <StatusCard phase={status.phase} message={status.message} progress={uploadProgress} />
                     </div>
                  </div>
                )}
              </label>

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">02_PARAMETERS</p>
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Model Selection</label>
                          <select
                            className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-xs font-bold text-white outline-none focus:border-cyan-500/50"
                            value={selectedModelVersion ?? ""}
                            onChange={(e) => setSelectedModelVersion(e.target.value)}
                          >
                             {availableModels.map(m => (
                               <option key={m.model_version} value={m.model_version}>{formatModelLabel(m)}</option>
                             ))}
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Confidence: {confidence.toFixed(2)}</label>
                          <input
                            type="range"
                            min="0.1"
                            max="0.95"
                            step="0.05"
                            value={confidence}
                            onChange={(e) => setConfidence(parseFloat(e.target.value))}
                            className="w-full accent-cyan-500"
                          />
                       </div>
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">03_AUGMENTATION</p>
                    <div className="grid grid-cols-1 gap-3">
                       <button
                         type="button"
                         onClick={() => setEnhance(!enhance)}
                         className={`flex items-center justify-between rounded-xl border p-4 transition-all ${enhance ? "border-cyan-500/50 bg-cyan-500/10 text-white" : "border-white/5 bg-white/[0.02] text-white/20"}`}
                       >
                          <span className="text-[11px] font-black uppercase tracking-widest">Luma Enhancement</span>
                          <span className={`h-2 w-2 rounded-full ${enhance ? "bg-cyan-500 shadow-[0_0_8px_cyan]" : "bg-white/10"}`} />
                       </button>
                       <button
                         type="button"
                         onClick={() => setExportOverlay(!exportOverlay)}
                         className={`flex items-center justify-between rounded-xl border p-4 transition-all ${exportOverlay ? "border-emerald-500/50 bg-emerald-500/10 text-white" : "border-white/5 bg-white/[0.02] text-white/20"}`}
                       >
                          <span className="text-[11px] font-black uppercase tracking-widest">Overlay Generation</span>
                          <span className={`h-2 w-2 rounded-full ${exportOverlay ? "bg-emerald-500 shadow-[0_0_8px_emerald]" : "bg-white/10"}`} />
                       </button>
                    </div>
                 </div>
              </div>

              <div className="mt-12 flex gap-4">
                <button
                  type="submit"
                  disabled={!selectedFile || status.phase === "uploading" || status.phase === "running"}
                  className="flex-1 rounded-2xl bg-white text-black py-5 text-sm font-black uppercase tracking-[0.3em] transition-all hover:bg-cyan-400 active:scale-[0.98] disabled:opacity-20 shadow-2xl"
                >
                  Confirm & Initiate Scan
                </button>
                <button
                  type="button"
                  onClick={closeAnalysisModal}
                  className="px-10 rounded-2xl border border-white/10 text-white/40 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                >
                  Abort
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {actionNotices.length > 0 && (
        <div className="pointer-events-none fixed right-8 top-8 z-[100] flex flex-col gap-4 max-w-sm w-full">
           {actionNotices.map((n) => (
             <div key={n.id} className={`p-6 rounded-2xl border backdrop-blur-3xl shadow-2xl animate-in slide-in-from-right-8 ${n.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/30 bg-rose-500/10 text-rose-100'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1">{n.title}</p>
                <p className="text-xs font-medium opacity-60 leading-relaxed uppercase">{n.message}</p>
             </div>
           ))}
        </div>
      )}
    </>
  );
}
