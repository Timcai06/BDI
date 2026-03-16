"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useState
} from "react";
import Link from "next/link";

import { classifyError, ErrorMessage, type ErrorType } from "@/components/error-message";
import { FileValidator, ValidationErrorList, type ValidationError } from "@/components/file-validator";
import { HistoryPanel } from "@/components/history-panel";
import { QuickActions } from "@/components/quick-actions";
import { RecentScans } from "@/components/recent-scans";
import { ResultDashboard } from "@/components/result-dashboard";
import { ScanAnimation } from "@/components/scan-animation";
import { StatusCard } from "@/components/status-card";
import { DashboardStats } from "@/components/dashboard-stats";
import {
  filterHistoryItems,
  sortHistoryItems,
  type HistorySortMode
} from "@/lib/history-utils";
import { formatModelLabel } from "@/lib/model-labels";
import {
  deleteResult,
  getOverlayDownloadUrl,
  getResultImageFile,
  getResultImageUrl,
  getResult,
  listModels,
  listResults,
  predictImage
} from "@/lib/predict-client";
import {
  MAX_UPLOAD_SIZE_MB,
  getUploadSizeError
} from "@/lib/upload-validation";
import type {
  ModelCatalogItem,
  PredictState,
  PredictionHistoryItem,
  PredictionResult
} from "@/lib/types";

const initialState: PredictState = {
  phase: "idle",
  message: "选择一张桥梁巡检图像后，即可触发单图识别与结果展示。"
};

type NavItem = "Home" | "Scans";
type ActionNoticeTone = "success" | "error";

interface ActionNotice {
  id: number;
  title: string;
  message: string;
  tone: ActionNoticeTone;
}

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confidence, setConfidence] = useState(0.45);
  const [activeNav, setActiveNav] = useState<NavItem>("Home");
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const [exportOverlay, setExportOverlay] = useState(true);
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [selectedModelVersion, setSelectedModelVersion] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<PredictionResult | null>(null);
  const [compareModelVersion, setCompareModelVersion] = useState<string | null>(null);
  const [compareStatus, setCompareStatus] = useState<PredictState>({
    phase: "idle",
    message: "选择一个次模型后，可对同一张本地图片执行快速对比。"
  });
  const [historyItems, setHistoryItems] = useState<PredictionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [historyFilterMode, setHistoryFilterMode] = useState<"recent" | "all">("recent");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("全部");
  const [historySortMode, setHistorySortMode] = useState<HistorySortMode>("newest");
  const [status, setStatus] = useState<PredictState>(initialState);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scanPhase, setScanPhase] = useState<"uploading" | "analyzing" | "detecting" | "complete">("uploading");
  const [actionNotices, setActionNotices] = useState<ActionNotice[]>([]);
  
  // Error handling states
  const [lastError, setLastError] = useState<{
    type: ErrorType;
    message: string;
    timestamp: number;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const MAX_RETRIES = 3;
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [minConfidence, setMinConfidence] = useState(0.3);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [resultViewMode, setResultViewMode] = useState<"image" | "overlay">("image");

  const deferredCategoryFilter = useDeferredValue(categoryFilter);
  const deferredMinConfidence = useDeferredValue(minConfidence);

  const categories = result
    ? ["全部", ...new Set(result.detections.map((item) => item.category))]
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
      label: `${formatModelLabel(model)} · ${model.backend}${model.is_active ? " · active" : ""}`,
      disabled: !model.is_available
    }));
  const availableHistoryCategories = [...new Set(historyItems.flatMap((item) => item.categories))];
  const filteredHistoryItems = filterHistoryItems(historyItems, {
    query: historySearchQuery,
    category: historyCategoryFilter
  });
  const sortedHistoryItems = sortHistoryItems(filteredHistoryItems, historySortMode);
  const visibleHistoryItems =
    historyFilterMode === "recent" ? sortedHistoryItems.slice(0, 5) : sortedHistoryItems;

  useEffect(() => {
    if (actionNotices.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActionNotices((current) => current.slice(1));
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [actionNotices]);

  const pushActionNotice = useCallback((
    title: string,
    message: string,
    tone: ActionNoticeTone
  ) => {
    setActionNotices((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        title,
        message,
        tone
      }
    ]);
  }, []);

  const loadHistory = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const history = await listResults();
      setHistoryItems(history.items);
      if (!silent) {
        setStatus({
          phase: "success",
          message: `历史结果已刷新，当前共 ${history.items.length} 条记录。`
        });
        pushActionNotice("历史已刷新", `当前共 ${history.items.length} 条记录。`, "success");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "历史结果读取失败，请稍后重试。";
      setHistoryError(message);
      setStatus({
        phase: "error",
        message
      });
      pushActionNotice("历史加载失败", message, "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [pushActionNotice]);

  useEffect(() => {
    void loadHistory({ silent: true });
  }, [loadHistory]);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setModelsLoading(true);
      setModelsError(null);

      try {
        const catalog = await listModels();
        if (cancelled) {
          return;
        }
        setAvailableModels(catalog.items);
        setSelectedModelVersion((current) => {
          if (current) {
            return current;
          }
          const preferred =
            catalog.items.find(
              (item) => item.model_version === catalog.active_version && item.is_available
            ) ?? catalog.items.find((item) => item.is_available);
          return preferred?.model_version ?? null;
        });
        setCompareModelVersion((current) => {
          if (current) {
            return current;
          }
          const fallback = catalog.items.find(
            (item) => item.model_version !== catalog.active_version && item.is_available
          );
          return fallback?.model_version ?? null;
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "模型列表加载失败，请稍后重试。";
        setModelsError(message);
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSelectHistory(imageId: string) {
    setDeleteSuccessMessage(null);
    setStatus({
      phase: "running",
      message: `正在加载 ${imageId} 的历史结果。`
    });

    try {
      const nextResult = await getResult(imageId);
      startTransition(() => {
        setResult(nextResult);
        setComparisonResult(null);
        setSelectedFile(null);
        setPreviewUrl(getResultImageUrl(imageId));
        setCategoryFilter("全部");
        setSelectedDetectionId(nextResult.detections[0]?.id ?? null);
        setResultViewMode("image");
        setActiveNav("Home");
      });
      setCompareStatus({
        phase: "idle",
        message: "历史记录已打开，可直接选择其他模型版本继续做对比分析。"
      });
      setStatus({
        phase: "success",
        message: `已打开 ${imageId} 的历史结果。`
      });
      pushActionNotice("已打开历史结果", imageId, "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "历史结果加载失败，请稍后重试。";
      setStatus({
        phase: "error",
        message
      });
      pushActionNotice("历史加载失败", message, "error");
    }
  }

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
        message: "当前结果没有可导出的 overlay 产物。"
      });
      pushActionNotice("叠加图导出失败", "当前结果没有可导出的 overlay。", "error");
      return;
    }

    downloadRemoteFile(overlayUrl, `${result.image_id}-overlay.png`);
    setStatus({
      phase: "success",
      message: `已触发 ${result.image_id} 的 overlay 导出。`
    });
    pushActionNotice("叠加图已开始下载", `${result.image_id}-overlay.png`, "success");
  }

  function handleResetToUploader() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setActiveNav("Home");
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
      setRetryCount(0);
      setSelectedFile(file);
      setStatus(initialState);
    }
  }

  function handleClearFile() {
    setSelectedFile(null);
    setStatus(initialState);
    setValidationErrors([]);
    setLastError(null);
    setRetryCount(0);
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

  // Retry handler
  async function handleRetry() {
    if (!selectedFile || retryCount >= MAX_RETRIES) return;
    
    setRetryCount(prev => prev + 1);
    setLastError(null);
    
    const syntheticEvent = {
      preventDefault() { }
    } as React.FormEvent<HTMLFormElement>;
    
    await handleSubmit(syntheticEvent);
  }

  function getStatusSuggestion() {
    if (status.phase === "error") {
      return {
        title: "恢复建议",
        body: "你可以检查服务状态后重试，或切到历史记录继续回看已完成的分析。",
        primaryLabel: "查看历史",
        primaryAction: () => {
          setActiveNav("Scans");
          void loadHistory();
        },
        secondaryLabel: "重新上传",
        secondaryAction: handleResetToUploader
      };
    }

    if (status.phase === "success" && result?.detections.length === 0) {
      return {
        title: "结果为空",
        body: "当前图片未检出病害，建议降低阈值或重新分析同一张图片。",
        primaryLabel: "重新分析",
        primaryAction: () => {
          void handleRerunCurrentImage();
        },
        secondaryLabel: "更换图片",
        secondaryAction: handleResetToUploader
      };
    }

    return {
      title: "下一步建议",
      body:
        historyItems.length > 0
          ? `当前已有 ${historyItems.length} 条历史记录，可随时切回查看。`
          : "上传第一张巡检图后，系统会自动保存可回看的分析记录。",
      primaryLabel: historyItems.length > 0 ? "查看历史" : "开始上传",
      primaryAction:
        historyItems.length > 0
          ? () => {
            setActiveNav("Scans");
            void loadHistory();
          }
          : handleResetToUploader,
      secondaryLabel: "留在当前页",
      secondaryAction: () => { }
    };
  }

  const statusSuggestion = getStatusSuggestion();

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

    // Reset progress
    setUploadProgress(0);
    setScanPhase("uploading");

    // Simulate upload progress (0% to 30%)
    const uploadInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 30) {
          return prev;
        }
        return prev + Math.random() * 5;
      });
    }, 200);

    setStatus({
      phase: "uploading",
      message: `正在上传 ${selectedFile.name}，随后会进入推理流程。`
    });

    // Simulate upload time based on file size
    const uploadTime = Math.min(2000, 500 + selectedFile.size / 50000);
    await new Promise(resolve => setTimeout(resolve, uploadTime));

    clearInterval(uploadInterval);
    setUploadProgress(30);

    try {
      // Analyzing phase (30% to 60%)
      setScanPhase("analyzing");
      setStatus({
        phase: "running",
        message: "后端已接收任务，正在执行 YOLOv8-seg 推理。"
      });

      const analyzeInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 60) {
            return prev;
          }
          return prev + Math.random() * 3;
        });
      }, 300);

      const prediction = await predictImage(selectedFile, {
        confidence,
        exportOverlay,
        modelVersion: selectedModelVersion
      });

      clearInterval(analyzeInterval);

      // Detecting phase (60% to 100%)
      setScanPhase("detecting");
      const detectInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            return prev;
          }
          return prev + Math.random() * 4;
        });
      }, 150);

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 800));

      clearInterval(detectInterval);
      setUploadProgress(100);
      setScanPhase("complete");

      startTransition(() => {
        setResult(prediction);
        setComparisonResult(null);
        setCategoryFilter("全部");
        setSelectedDetectionId(prediction.detections[0]?.id ?? null);
        setResultViewMode("image");
        setActiveNav("Home");
      });
      setCompareStatus({
        phase: "idle",
        message: "主结果已生成，可继续选择其他模型版本做快速对比。"
      });

      void loadHistory();
      setAnalysisModalOpen(false);

      setStatus({
        phase: "success",
        message: `识别完成，已返回 ${prediction.detections.length} 条病害结果。`
      });
      pushActionNotice(
        "识别完成",
        `${prediction.detections.length} 条病害结果已生成。`,
        "success"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "识别失败，请检查服务状态后重试。";
      
      // Classify and store error for retry
      const errorType = classifyError(error);
      setLastError({
        type: errorType,
        message,
        timestamp: Date.now()
      });

      setStatus({
        phase: "error",
        message
      });
      pushActionNotice("识别失败", message, "error");
    }
  }

  async function handleDeleteHistory(imageId: string) {
    try {
      setDeletingImageId(imageId);
      await deleteResult(imageId);
      setHistoryItems((current) => current.filter((item) => item.image_id !== imageId));
      if (result?.image_id === imageId) {
        setResult(null);
        setSelectedDetectionId(null);
        setPreviewUrl(null);
        setResultViewMode("image");
        setActiveNav("Home");
      }
      if (historySearchQuery.trim()) {
        setHistorySearchQuery("");
      }
      setDeleteTargetId(null);
      setDeleteSuccessMessage(`记录 ${imageId} 已被移除。`);
      setStatus({
        phase: "success",
        message: `已删除 ${imageId} 的分析记录。`
      });
      pushActionNotice("记录已删除", imageId, "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "删除记录失败，请稍后重试。";
      setStatus({
        phase: "error",
        message
      });
      pushActionNotice("删除失败", message, "error");
    } finally {
      setDeletingImageId(null);
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
        exportOverlay,
        modelVersion: compareModelVersion
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
    <main className="flex h-screen w-full bg-black text-slate-200 overflow-hidden font-sans relative">
      {/* 纯黑设计背景纹理层 */}
      <div className="bg-grid" />
      <div className="bg-noise" />

      <aside className="w-20 lg:w-64 shrink-0 border-r border-white/5 bg-transparent flex flex-col relative z-10">
        <div className="flex h-16 items-center justify-center lg:justify-start lg:px-6 border-b border-white/5">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="h-8 w-8 rounded-lg bg-[#050505] border border-white/10 flex items-center justify-center">
              <span className="text-white font-bold font-mono">BDI</span>
            </div>
            <span className="hidden lg:block font-semibold tracking-[0.2em] uppercase text-white">INFRA-SCAN</span>
          </Link>
        </div>

        <div className="px-3 pt-6">
          <button
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white transition-colors hover:bg-white/10 lg:justify-start"
            type="button"
            onClick={handleResetToUploader}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
              +
            </span>
            <span className="hidden text-sm uppercase tracking-widest font-medium lg:block">新建分析</span>
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 flex flex-col gap-1">
          <button
            type="button"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${activeNav === "Home"
              ? "bg-white/[0.06] text-white font-medium shadow-[inset_2px_0_0_0_#fff]"
              : "text-white/50 hover:text-white hover:bg-white/[0.03]"
              }`}
            onClick={() => setActiveNav("Home")}
          >
            <svg 
              className={`shrink-0 w-5 h-5 transition-colors ${activeNav === "Home" ? "text-white" : "text-white/40"}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="hidden lg:block text-[11px] uppercase tracking-widest">主页</span>
          </button>

          <button
            type="button"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${activeNav === "Scans"
              ? "bg-white/[0.06] text-white font-medium shadow-[inset_2px_0_0_0_#fff]"
              : "text-white/50 hover:text-white hover:bg-white/[0.03]"
              }`}
            onClick={() => {
              setActiveNav("Scans");
              void loadHistory();
            }}
          >
            <svg 
              className={`shrink-0 w-5 h-5 transition-colors ${activeNav === "Scans" ? "text-white" : "text-white/40"}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden lg:block text-[11px] uppercase tracking-widest">最近记录</span>
            {historyItems.length > 0 && (
              <span className="hidden lg:flex ml-auto w-5 h-5 rounded-full bg-white/10 items-center justify-center text-[10px] font-medium text-white/70">
                {historyItems.length > 9 ? "9+" : historyItems.length}
              </span>
            )}
          </button>
        </nav>
      </aside>

      {/* 主视图区 (图传/回放/上传) */}
      <section className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-transparent backdrop-blur-[100px]">
          <h1 className="text-lg font-medium text-white uppercase tracking-[0.1em]">
            {activeNav === "Scans"
              ? "历史分析档案"
              : result
                ? result.image_id
                : "桥梁病害识别工作台"}
          </h1>
          <div className="flex items-center gap-4">
            <button
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-white transition-colors hover:bg-white/10"
              type="button"
              onClick={handleResetToUploader}
            >
              上传照片
            </button>
            <span className="px-2.5 py-1 rounded bg-white/10 backdrop-blur border border-white/20 text-[10px] uppercase font-mono tracking-widest text-slate-300">
              Phase 3
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 relative" style={{ scrollbarGutter: 'stable' }}>
          {activeNav === "Scans" ? (
            <HistoryPanel
              items={visibleHistoryItems}
              loading={historyLoading}
              errorMessage={historyError}
              deletingImageId={deletingImageId}
              deleteSuccessMessage={deleteSuccessMessage}
              filterMode={historyFilterMode}
              searchQuery={historySearchQuery}
              categoryFilter={historyCategoryFilter}
              sortMode={historySortMode}
              availableCategories={availableHistoryCategories}
              getImageUrl={getResultImageUrl}
              onDeleteRequest={(imageId) => {
                setDeleteTargetId(imageId);
              }}
              onFilterChange={setHistoryFilterMode}
              onSearchQueryChange={setHistorySearchQuery}
              onCategoryFilterChange={setHistoryCategoryFilter}
              onSortModeChange={setHistorySortMode}
              onOpenUploader={handleResetToUploader}
              onRefresh={() => {
                void loadHistory();
              }}
              onSelect={(imageId) => {
                void handleSelectHistory(imageId);
              }}
            />
          ) : !result ? (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-3">
                    工作台
                  </p>
                  <h2 className="text-3xl font-light tracking-[0.05em] text-white mb-3">
                    开始新的分析任务
                  </h2>
                  <p className="text-slate-400 text-sm max-w-xl mx-auto font-light">
                    上传桥梁巡检图像，AI 将自动识别裂缝、剥落等病害并生成检测报告。
                  </p>
                </div>

                {/* Stats Overview */}
                <DashboardStats historyItems={historyItems} />

                {/* Quick Actions */}
                <QuickActions
                  actions={[
                    {
                      id: "upload",
                      label: "单图分析",
                      description: "上传单张图片",
                      icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                      ),
                      onClick: handleResetToUploader,
                      accentColor: "#38bdf8"
                    },
                    {
                      id: "batch",
                      label: "批量分析",
                      description: "同时上传多张",
                      icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      ),
                      onClick: () => {
                        setStatus({
                          phase: "error",
                          message: "批量分析功能即将上线，敬请期待"
                        });
                      },
                      accentColor: "#a78bfa",
                      disabled: true
                    },
                    {
                      id: "history",
                      label: "历史档案",
                      description: "查看分析记录",
                      icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                      onClick: () => {
                        setActiveNav("Scans");
                        void loadHistory();
                      },
                      accentColor: "#f472b6"
                    },
                    {
                      id: "export",
                      label: "导出报告",
                      description: "批量导出结果",
                      icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      ),
                      onClick: () => {
                        if (historyItems.length === 0) {
                          setStatus({
                            phase: "error",
                            message: "暂无历史记录可导出"
                          });
                        } else {
                          setActiveNav("Scans");
                          void loadHistory();
                        }
                      },
                      accentColor: "#34d399",
                      disabled: historyItems.length === 0
                    }
                  ]}
                />

                {/* Main Actions */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <button
                    className="group rounded-[20px] border border-white/[0.06] bg-[#030303] p-6 text-left transition-all hover:bg-white/[0.03] hover:border-white/[0.12]"
                    type="button"
                    onClick={handleResetToUploader}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg tracking-wide font-medium text-white">上传分析</h3>
                        <p className="mt-1 text-xs text-white/40 leading-relaxed">
                          打开上传面板，选择巡检图片并调整模型版本与置信度阈值。
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    className="group rounded-[20px] border border-white/[0.06] bg-[#030303] p-6 text-left transition-all hover:bg-white/[0.03] hover:border-white/[0.12]"
                    type="button"
                    onClick={() => {
                      setActiveNav("Scans");
                      void loadHistory();
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg tracking-wide font-medium text-white">历史档案</h3>
                        <p className="mt-1 text-xs text-white/40 leading-relaxed">
                          进入沉浸式画廊，回看最近的分析记录与推理结果。
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Recent Scans & System Suggestion */}
                <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                  <RecentScans
                    items={historyItems}
                    maxItems={5}
                    onSelect={(imageId) => void handleSelectHistory(imageId)}
                    onViewAll={() => {
                      setActiveNav("Scans");
                      void loadHistory();
                    }}
                  />

                  <div className="rounded-[20px] border border-white/[0.04] bg-[#030303] p-6 shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-xl flex flex-col justify-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                      系统建议
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">
                      {statusSuggestion.body}
                    </p>
                    <div className="mt-5 flex gap-3">
                      <button
                        className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20 w-fit"
                        type="button"
                        onClick={statusSuggestion.primaryAction}
                      >
                        {statusSuggestion.primaryLabel}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full">
              <ResultDashboard
                result={result}
                comparisonResult={comparisonResult}
                compareStatus={compareStatus}
                compareModelVersion={compareModelVersion}
                compareOptions={compareOptions}
                categoryFilter={deferredCategoryFilter}
                minConfidence={deferredMinConfidence}
                previewUrl={previewUrl}
                overlayPreviewUrl={result.artifacts.overlay_path ?? null}
                comparisonPreviewUrl={comparisonPreviewUrl}
                comparisonOverlayPreviewUrl={comparisonOverlayPreviewUrl}
                viewMode={resultViewMode}
                onViewModeChange={setResultViewMode}
                onExportJson={handleExportJson}
                onExportOverlay={handleExportOverlay}
                overlayDisabled={!result.artifacts.overlay_path}
                selectedDetectionId={selectedDetectionId}
                onSelectDetection={(detection) => setSelectedDetectionId(detection.id)}
                onOpenHistory={() => {
                  setActiveNav("Scans");
                  void loadHistory();
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
              />
            </div>
          )}
        </div>
      </section>

      {/* 右侧边栏 (状态机/统计) */}
      <aside className="w-[360px] shrink-0 border-l border-white/5 bg-black flex flex-col z-10 relative shadow-[-20px_0_50px_rgba(0,0,0,0.8)]">
        <div className="p-6 border-b border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 mb-2">系统状态</p>
          <StatusCard 
            phase={status.phase} 
            message={status.message} 
            progress={uploadProgress}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 mb-3">展示筛选</p>
                <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">病害类别</span>
                    <select
                      className="bg-black border border-white/10 rounded-md text-xs text-white/80 px-2 py-1 outline-none focus:border-white/30"
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/60">最低置信度</span>
                      <span className="text-xs font-mono text-white/80">{(minConfidence * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                      max="0.95"
                      min="0"
                      step="0.05"
                      type="range"
                      value={minConfidence}
                      onChange={(event) => setMinConfidence(Number(event.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 mb-2">推理诊断</p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">耗时</span>
                    <span className="text-white/90">{result.inference_ms}ms</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">当前模型</span>
                    <span className="text-white/70">{formatModelLabel(result)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">当前参数</span>
                    <span className="text-white/70 flex gap-2">
                      <span className="px-1 bg-white/5 text-white/50 rounded">conf:{confidence}</span>
                      <span className="px-1 bg-white/5 text-white/50 rounded">iou:0.45</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {analysisModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-black/40 p-6 sm:p-10 shadow-[0_0_100px_rgba(0,0,0,1)] my-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2">
                  分析面板
                </p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-light tracking-[0.05em] uppercase text-white">
                  执行新视觉分析
                </h2>
                <p className="mt-3 text-sm text-slate-400 font-light">
                  请选择目标图像，并确认使用的模型版本后启动推理。
                </p>
              </div>
              <button
                className="rounded-full border border-white/10 bg-white/5 w-10 h-10 flex items-center justify-center text-slate-200 transition-colors hover:bg-white/10 flex-shrink-0"
                type="button"
                onClick={closeAnalysisModal}
              >
                ✕
              </button>
            </div>

            <form className="mt-8" onSubmit={handleSubmit}>
              <label
                className={`relative flex min-h-[200px] sm:min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden ${
                  isDragging
                    ? "border-sky-500/80 bg-sky-500/10 scale-[1.02]"
                    : selectedFile
                      ? "border-white/20 bg-white/[0.04]"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/30"
                } ${status.phase === "uploading" || status.phase === "running" ? "pointer-events-none" : ""}`}
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
                    
                    if (!nextFile) {
                      setSelectedFile(null);
                      return;
                    }
                    
                    // Validate file
                    const errors = validateDroppedFile(nextFile);
                    if (errors.length > 0) {
                      setValidationErrors(errors);
                      setSelectedFile(null);
                      setStatus({
                        phase: "error",
                        message: `文件验证失败: ${errors.map(e => e.message).join(", ")}`
                      });
                      event.target.value = "";
                      return;
                    }
                    
                    setValidationErrors([]);
                    setLastError(null);
                    setRetryCount(0);
                    setSelectedFile(nextFile);
                    setStatus(initialState);
                  }}
                />

                {/* 背景预览图 */}
                {previewUrl && !selectedFile && (
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 transition-opacity duration-700"
                    style={{ backgroundImage: `url(${previewUrl})` }}
                  />
                )}

                {/* 扫描动画 */}
                {(status.phase === "uploading" || status.phase === "running") && (
                  <div className="absolute inset-0">
                    <ScanAnimation phase={scanPhase} progress={uploadProgress} />
                  </div>
                )}

                {/* 拖拽悬停遮罩 */}
                {isDragging && (
                  <div className="absolute inset-0 bg-sky-500/10 backdrop-blur-[2px] flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-sky-500/20 flex items-center justify-center mb-4 animate-pulse">
                        <svg className="w-10 h-10 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <span className="text-lg font-medium text-sky-300">释放以上传文件</span>
                    </div>
                  </div>
                )}

                {/* 内容区域 */}
                {!isDragging && (
                  <div className="relative z-10 flex flex-col items-center text-center p-6 w-full">
                    {selectedFile ? (
                      // 文件预览模式
                      <div className="flex flex-col items-center w-full max-w-md">
                        {/* 缩略图 */}
                        {previewUrl ? (
                          <div className="relative mb-4">
                            <div className="w-32 h-32 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                              <img
                                src={previewUrl}
                                alt="预览"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {/* 清除按钮 */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleClearFile();
                              }}
                              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:bg-rose-500/80 hover:text-white hover:border-rose-500 transition-all duration-200"
                              title="移除文件"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                            <svg className="w-10 h-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}

                        {/* 文件信息 */}
                        <div className="text-center">
                          <p className="text-base font-medium text-white mb-1 truncate max-w-[280px]" title={selectedFile.name}>
                            {selectedFile.name}
                          </p>
                          <div className="flex items-center justify-center gap-3 text-xs text-white/40">
                            <span>{formatFileSize(selectedFile.size)}</span>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="uppercase">{selectedFile.type.split('/')[1] || 'image'}</span>
                          </div>
                        </div>

                        {/* 更换提示 */}
                        <p className="mt-4 text-xs text-white/30">
                          点击或拖拽新文件以更换
                        </p>
                      </div>
                    ) : (
                      // 空状态
                      <>
                        <div className={`w-16 h-16 mb-6 rounded-full border border-white/10 bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all duration-500 ${isDragging ? 'scale-125' : 'group-hover:scale-110'}`}>
                          <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </div>
                        <span className="text-lg font-light text-slate-200 tracking-wide">
                          点击或拖拽上传图像
                        </span>
                        <span className="mt-3 text-xs uppercase tracking-[0.28em] text-slate-500">
                          支持 JPG / JPEG / PNG，单张最大 {MAX_UPLOAD_SIZE_MB}MB
                        </span>
                      </>
                    )}
                  </div>
                )}
              </label>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="rounded-xl border border-white/5 bg-white/[0.02] p-4 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                    模型版本
                  </span>
                  <div className="mt-3">
                    <select
                      className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white/80 outline-none focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                      value={selectedModelVersion ?? ""}
                      disabled={modelsLoading || availableModels.length === 0}
                      onChange={(event) => setSelectedModelVersion(event.target.value || null)}
                    >
                      {availableModels.map((model) => (
                        <option
                          key={model.model_version}
                          value={model.model_version}
                          disabled={!model.is_available}
                        >
                          {formatModelLabel(model)} · {model.backend}
                          {!model.is_available ? " · unavailable" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-white/35 font-light">
                      {modelsLoading
                        ? "正在读取可用模型列表..."
                        : modelsError
                          ? modelsError
                          : selectedModelVersion
                            ? `当前将使用 ${
                              formatModelLabel(
                                availableModels.find(
                                  (model) => model.model_version === selectedModelVersion
                                ) ?? {
                                  model_name: "unknown",
                                  model_version: selectedModelVersion
                                }
                              )
                            } 执行推理。`
                            : "未读取到模型列表时，将回退到当前 active model。"}
                    </p>
                  </div>
                </label>

                <label className="rounded-xl border border-white/5 bg-white/[0.02] p-5 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">最低置信度</span>
                  <div className="mt-4 flex items-center gap-4">
                    <input
                      className="flex-1 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                      max="0.95"
                      min="0.1"
                      step="0.05"
                      type="range"
                      value={confidence}
                      onChange={(event) => setConfidence(Number(event.target.value))}
                    />
                    <span className="font-mono text-xs text-white bg-white/10 px-2 py-1 rounded">
                      {confidence.toFixed(2)}
                    </span>
                  </div>
                </label>

                <label className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex items-center justify-between cursor-pointer group hover:bg-white/[0.04] transition-colors">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">导出叠加图</span>
                    <span className="text-xs text-white/30 font-light">同步生成基带画框图</span>
                  </div>
                  <div className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${exportOverlay ? "bg-white/80" : "bg-white/10"}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-black transition-transform mt-1 ${exportOverlay ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={exportOverlay}
                    onChange={() => setExportOverlay(!exportOverlay)}
                  />
                </label>
              </div>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="mt-4">
                  <ValidationErrorList 
                    errors={validationErrors}
                    onDismiss={() => setValidationErrors([])}
                  />
                </div>
              )}

              {/* Error message with retry */}
              {status.phase === "error" && lastError && (
                <div className="mt-4">
                  <ErrorMessage
                    type={lastError.type}
                    message={lastError.message}
                    onRetry={retryCount < MAX_RETRIES ? handleRetry : undefined}
                    onDismiss={() => {
                      setLastError(null);
                      setStatus(initialState);
                    }}
                    retryCount={retryCount}
                    maxRetries={MAX_RETRIES}
                  />
                </div>
              )}

              <div className="mt-4">
                <StatusCard 
                  phase={status.phase} 
                  message={status.message} 
                  progress={uploadProgress}
                />
              </div>

              <div className="mt-6 flex gap-3 sticky bottom-0 bg-black/40 -mx-6 sm:-mx-10 px-6 sm:px-10 py-4 border-t border-white/5">
                <button
                  className="flex-1 rounded-xl bg-sky-500/10 border border-sky-500/50 px-6 py-3.5 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !selectedFile ||
                    status.phase === "uploading" ||
                    status.phase === "running" ||
                    availableModels.length === 0 ||
                    !selectedModelVersion
                  }
                  title={!selectedFile ? "请先选择一张待分析图片" : undefined}
                  type="submit"
                >
                  {status.phase === "idle" || status.phase === "error" ? "开始执行 AI 识别" : "推理中..."}
                </button>
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                  type="button"
                  onClick={closeAnalysisModal}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTargetId ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617]/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#111827] p-8 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
              删除记录
            </p>
            <h2 className="mt-3 text-2xl font-light tracking-tight text-white">
              确认删除这条分析记录？
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              删除后，这条记录对应的 JSON、原图和 overlay 都会一起移除，且无法恢复。
            </p>
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
              {deleteTargetId}
            </div>
            <div className="mt-8 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-rose-500/40 bg-rose-500/10 px-6 py-4 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deletingImageId === deleteTargetId}
                type="button"
                onClick={() => {
                  void handleDeleteHistory(deleteTargetId);
                }}
              >
                {deletingImageId === deleteTargetId ? "删除中..." : "确认删除"}
              </button>
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                disabled={deletingImageId === deleteTargetId}
                type="button"
                onClick={() => setDeleteTargetId(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actionNotices.length > 0 ? (
        <div className="pointer-events-none absolute right-6 top-6 z-[60] flex w-full max-w-sm flex-col gap-3">
          {actionNotices.map((notice) => (
            <div
              key={notice.id}
              className={`rounded-2xl border px-4 py-4 shadow-2xl backdrop-blur-md transition-all ${
                notice.tone === "success"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-50"
                  : "border-rose-500/30 bg-rose-500/15 text-rose-50"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                {notice.title}
              </p>
              <p className="mt-2 text-sm leading-6 opacity-90">{notice.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* 补充的自定义动画样式 */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
      `}} />
    </main>
  );
}
