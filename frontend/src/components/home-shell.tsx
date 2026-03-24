"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useState
} from "react";
import Link from "next/link";

import { AdaptiveImage } from "@/components/adaptive-image";
import { classifyError, ErrorMessage, type ErrorType } from "@/components/error-message";
import { ValidationErrorList, type ValidationError } from "@/components/file-validator";
import { HistoryPanel } from "@/components/history";
import { ResultDashboard } from "@/components/result-dashboard";
import { ScanAnimation } from "@/components/scan-animation";
import { StatusCard } from "@/components/status-card";
import { DashboardStats } from "@/components/dashboard-stats";
import { type HistorySortMode } from "@/lib/history-utils";
import { getCanonicalCategoryOptions, getDefectLabel } from "@/lib/defect-visuals";
import { formatModelLabel } from "@/lib/model-labels";
import {
  batchExportResults,
  batchDeleteResults,
  deleteResult,
  getOverlayDownloadUrl,
  getResultImageFile,
  getResultImageUrl,
  getResult,
  listAllResults,
  listModels,
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

function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function HomeShell() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confidence, setConfidence] = useState(0.45);
  const [activeNav, setActiveNav] = useState<NavItem>("Home");
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

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
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
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
  const [resultViewMode, setResultViewMode] = useState<"image" | "result" | "mask">("image");
  const [pixelsPerMm, setPixelsPerMm] = useState(10.0);

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
  const availableHistoryCategories = getCanonicalCategoryOptions().filter((category) =>
    historyItems.some((item) => item.categories.some((value) => getDefectLabel(value) === category))
  );
  const getHistoryPreviewUrl = useCallback(
    (item: PredictionHistoryItem) =>
      item.artifacts.overlay_path
        ? getOverlayDownloadUrl(item.image_id) ?? item.artifacts.overlay_path ?? null
        : getResultImageUrl(item.image_id),
    [],
  );

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

  const loadHistory = useCallback(async (
    {
      silent = false,
      forceFresh = false
    }: { silent?: boolean; forceFresh?: boolean } = {}
  ) => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const history = await listAllResults(forceFresh);
      setHistoryItems(history.items);
      setHistoryTotal(history.total);
      if (!silent) {
        setStatus({
          phase: "success",
          message: `历史结果已刷新，当前共 ${history.total} 条记录。`
        });
        pushActionNotice("历史已刷新", `当前共 ${history.total} 条记录。`, "success");
      }
      return history;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "历史结果读取失败，请稍后重试。";
      setHistoryError(message);
      setStatus({
        phase: "error",
        message
      });
      pushActionNotice("历史加载失败", message, "error");
      return null;
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

  const selectedModel =
    availableModels.find((model) => model.model_version === selectedModelVersion) ?? null;
  const selectedModelSupportsMasks = selectedModel?.supports_masks ?? true;
  const selectedModelSupportsSlicedInference =
    selectedModel?.supports_sliced_inference ?? false;

  useEffect(() => {
    if (selectedModelSupportsMasks || !exportOverlay) {
      return;
    }

    setExportOverlay(false);
    pushActionNotice("模型能力提示", "当前模型不支持结果图导出，已自动关闭该选项。", "error");
  }, [selectedModelSupportsMasks, exportOverlay, pushActionNotice]);

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
        message: "正在请求后端执行 YOLOv8-seg 推理..."
      });

      const prediction = await predictImage(selectedFile, {
        confidence,
        exportOverlay: exportOverlay && selectedModelSupportsMasks,
        modelVersion: selectedModelVersion,
        pixelsPerMm
      });

      // Update to detecting as results arrive
      setScanPhase("detecting");
      setUploadProgress(90);

      // Give a tiny visual confirmation frame before completion
      await new Promise(resolve => setTimeout(resolve, 200));

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

      void loadHistory({ forceFresh: true });
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

  async function handleBatchDeleteHistory(imageIds: string[]) {
    if (imageIds.length === 0) {
      return;
    }

    const beforeTotal = historyTotal;

    setDeletingImageId("batch");
    setDeleteSuccessMessage(null);

    try {
      const response = await batchDeleteResults(imageIds);
      const deletedIds = response.results
        .filter((item) => item.deleted)
        .map((item) => item.image_id);
      const failedIds = response.results
        .filter((item) => !item.deleted)
        .map((item) => item.image_id);

      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setHistoryItems((current) => current.filter((item) => !deletedSet.has(item.image_id)));
        if (result && deletedSet.has(result.image_id)) {
          setResult(null);
          setSelectedDetectionId(null);
          setPreviewUrl(null);
          setResultViewMode("image");
          setActiveNav("Home");
        }
        setDeleteSuccessMessage(`已提交批量删除 ${deletedIds.length} 条记录，正在同步列表...`);
      }

      const refreshed = await loadHistory({ silent: true, forceFresh: true });
      const afterTotal = refreshed?.total ?? historyTotal;

      if (failedIds.length === 0) {
        const viewHint = "当前显示全部记录。";
        setDeleteSuccessMessage(`批量删除完成：成功 ${deletedIds.length} 条（删除前 ${beforeTotal} 条，当前 ${afterTotal} 条）。`);
        setStatus({
          phase: "success",
          message: `批量删除完成：成功 ${deletedIds.length} 条（删除前 ${beforeTotal} 条，当前 ${afterTotal} 条）。${viewHint}`
        });
        pushActionNotice(
          "批量删除完成",
          `成功 ${deletedIds.length} 条（删除前 ${beforeTotal} 条，当前 ${afterTotal} 条）。${viewHint}`,
          "success"
        );
        return;
      }

      setDeleteSuccessMessage(
        `批量删除部分失败：成功 ${deletedIds.length} 条，失败 ${failedIds.length} 条。请重试失败项。`
      );
      setStatus({
        phase: "error",
        message: `批量删除部分失败：成功 ${deletedIds.length} 条，失败 ${failedIds.length} 条。`
      });
      pushActionNotice(
        "批量删除部分失败",
        `成功 ${deletedIds.length} 条，失败 ${failedIds.length} 条。`,
        "error"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "批量删除失败，请稍后重试。";
      setDeleteSuccessMessage(message);
      setStatus({
        phase: "error",
        message
      });
      pushActionNotice("批量删除失败", message, "error");
    } finally {
      setDeletingImageId(null);
    }
  }

  async function handleBatchExportHistory(
    imageIds: string[],
    assetType: "json" | "overlay"
  ) {
    const exportLabel = assetType === "json" ? "JSON" : "结果图";

    try {
      const { blob, filename } = await batchExportResults(imageIds, assetType);
      downloadBlobFile(blob, filename);
      setStatus({
        phase: "success",
        message: `已开始导出 ${imageIds.length} 条历史记录的${exportLabel}压缩包。`
      });
      pushActionNotice(
        `${exportLabel} 批量导出已开始`,
        filename,
        "success"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `批量导出${exportLabel}失败，请稍后重试。`;
      setStatus({
        phase: "error",
        message
      });
      pushActionNotice(`${exportLabel} 批量导出失败`, message, "error");
      throw error;
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
        exportOverlay: exportOverlay && selectedModelSupportsMasks,
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
    <main className="flex h-screen w-full bg-[#05080A] text-slate-200 overflow-hidden font-sans relative">
      {/* 深黑蓝及电光蓝渐变层 */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(0,210,255,0.08)_0%,rgba(5,8,10,1)_100%)] pointer-events-none z-0" />
      <div className="bg-grid opacity-30 z-0 relative" />
      <div className="bg-noise opacity-40 z-0 relative" />

      <aside className="w-20 lg:w-64 shrink-0 border-r border-white/5 bg-transparent flex flex-col relative z-20">
        <div className="flex h-16 items-center justify-center lg:justify-start lg:px-6 border-b border-white/5">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="h-8 w-8 rounded-lg bg-[#00D2FF]/10 border border-[#00D2FF]/20 flex items-center justify-center shadow-[0_0_15px_rgba(0,210,255,0.2)]">
              <span className="text-[#00D2FF] font-black font-mono tracking-tighter">BDI</span>
            </div>
            <span className="hidden lg:block font-bold tracking-[0.25em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">INFRA-SCAN</span>
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
            {historyTotal > 0 && (
              <span className="hidden lg:flex ml-auto w-5 h-5 rounded-full bg-white/10 items-center justify-center text-[10px] font-medium text-white/70">
                {historyTotal > 99 ? "99+" : historyTotal}
              </span>
            )}
          </button>
        </nav>
      </aside>

      {/* 主视图区 (图传/回放/上传) */}
      <section className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-transparent backdrop-blur-[100px]">
          <h1 className="text-lg font-medium text-white uppercase tracking-[0.1em]">
            {activeNav === "Scans" ? "历史记录" : result ? result.image_id : "桥梁病害识别工作台"}
          </h1>
          <span className="px-2.5 py-1 rounded bg-white/10 backdrop-blur border border-white/20 text-[10px] uppercase font-mono tracking-widest text-slate-300">
            Phase 4
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-6 relative" style={{ scrollbarGutter: 'stable' }}>
          {activeNav === "Scans" ? (
            <HistoryPanel
              items={historyItems}
              totalCount={historyTotal}
              loading={historyLoading}
              errorMessage={historyError}
              deletingImageId={deletingImageId}
              deleteSuccessMessage={deleteSuccessMessage}
              searchQuery={historySearchQuery}
              categoryFilter={historyCategoryFilter}
              sortMode={historySortMode}
              availableCategories={availableHistoryCategories}
              getImageUrl={getHistoryPreviewUrl}
              onDeleteRequest={(imageId) => {
                setDeleteTargetId(imageId);
              }}
              onBatchDelete={handleBatchDeleteHistory}
              onBatchExportJson={(imageIds) => handleBatchExportHistory(imageIds, "json")}
              onBatchExportOverlay={(imageIds) => handleBatchExportHistory(imageIds, "overlay")}
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
                    桥梁病害识别工作台
                  </h2>
                  <p className="text-slate-400 text-sm max-w-xl mx-auto font-light">
                    上传巡检照片，自动识别病害类型，生成可查看、可对比、可导出的分析结果。
                  </p>
                </div>

                {/* Main Entry */}
                <div className="space-y-3">
                  <button
                    className="group w-full rounded-[20px] border border-sky-500/25 bg-[linear-gradient(135deg,rgba(14,31,48,0.65),rgba(3,3,3,0.95))] p-6 text-left transition-all hover:border-sky-400/45 hover:shadow-[0_0_30px_rgba(56,189,248,0.12)]"
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
                        <h3 className="text-lg tracking-wide font-medium text-white">开始一次检测</h3>
                        <p className="mt-1 text-xs text-white/40 leading-relaxed">
                          上传一张桥梁巡检照片，系统将自动识别病害并生成结果。
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div
                  className="rounded-[20px] border border-white/[0.04] bg-[#030303] p-6 shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-xl"
                  data-home-section="workflow"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                        使用流程
                      </p>
                      <h3 className="mt-2 text-xl font-light text-white">三步完成一次识别</h3>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    {[
                      {
                        step: "01",
                        title: "上传照片",
                        description: "选择一张桥梁巡检照片，系统会先完成文件校验。"
                      },
                      {
                        step: "02",
                        title: "AI 自动识别病害",
                        description: "系统调用模型识别裂缝、破损、梳齿缺陷、孔洞、钢筋外露与渗水，并输出结果图。"
                      },
                      {
                        step: "03",
                        title: "查看结果并导出",
                        description: "在结果页查看病害详情，也可以回到历史记录继续复查。"
                      }
                    ].map((item) => (
                      <div
                        key={item.step}
                        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
                      >
                        <p className="text-[11px] font-mono tracking-[0.24em] text-sky-300/80">{item.step}</p>
                        <h4 className="mt-3 text-base font-medium text-white">{item.title}</h4>
                        <p className="mt-2 text-sm leading-relaxed text-white/50">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="px-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                      数据总览
                    </p>
                    <h3 className="mt-2 text-xl font-light text-white">检测运行指标</h3>
                  </div>
                  <DashboardStats historyItems={historyItems} totalHistoryCount={historyTotal} />
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
                overlayPreviewUrl={getOverlayDownloadUrl(result.image_id) ?? result.artifacts.overlay_path ?? null}
                comparisonPreviewUrl={comparisonPreviewUrl}
                comparisonOverlayPreviewUrl={comparisonOverlayPreviewUrl}
                viewMode={resultViewMode}
                onViewModeChange={setResultViewMode}
                onExportJson={handleExportJson}
                onExportOverlay={handleExportOverlay}
                resultDisabled={!result.artifacts.overlay_path}
                maskDisabled={!result.has_masks}
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

      {/* 右侧边栏已移除，避免弹窗关闭切到 ResultDashboard 时发生重心剧烈跳跃 */}

      {analysisModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020508]/60 p-4 sm:p-6 backdrop-blur-3xl overflow-y-auto">
          {/* 径向呼吸光晕背景 */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] rounded-full bg-sky-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-emerald-500/5 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
          </div>

          <div className="relative w-full max-w-3xl rounded-[2rem] border-t border-t-white/20 border-x border-x-white/5 border-b border-b-black/80 bg-[linear-gradient(145deg,rgba(10,15,20,0.8),rgba(5,8,10,0.95))] p-6 sm:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_0_80px_rgba(0,210,255,0.08),0_24px_64px_rgba(0,0,0,0.6)] my-auto overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            <div className="relative flex items-start justify-between gap-4 z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-400/80 m-0 leading-none">
                    分析面板
                  </p>
                </div>
                <h2 className="mt-2 text-2xl sm:text-3xl font-light tracking-[0.05em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
                  开始一次新分析
                </h2>
                <p className="mt-3 text-sm text-slate-400 font-light">
                  上传一张桥梁巡检照片，系统将自动完成识别并生成分析结果。
                </p>
              </div>
              <button
                className="rounded-full border border-white/10 bg-white/5 w-10 h-10 flex items-center justify-center text-slate-200 transition-colors hover:bg-white/10 hover:rotate-90 flex-shrink-0"
                type="button"
                onClick={closeAnalysisModal}
              >
                ✕
              </button>
            </div>

            <form className="mt-8" onSubmit={handleSubmit}>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300/80">
                  1 选择照片
                </p>
              <label
                className={`group relative flex min-h-[200px] sm:min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border transition-all duration-500 overflow-hidden ${
                  isDragging
                    ? "border-sky-400 bg-sky-500/10 scale-[1.02] shadow-[0_0_40px_rgba(56,189,248,0.2)]"
                    : selectedFile
                      ? "border-white/10 bg-black/40 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
                      : "border-white/10 bg-white/[0.015] hover:bg-sky-500/[0.03] hover:border-sky-500/40 hover:shadow-[0_0_30px_rgba(0,210,255,0.08)] hover:scale-[1.01]"
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
                  <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
                    <ScanAnimation phase={scanPhase} progress={uploadProgress} />
                    {status.phase === "running" && (
                      <div className="absolute inset-0">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px]" />
                        <div className="absolute left-0 right-0 h-[2px] bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,1),0_0_40px_rgba(56,189,248,0.5)] animate-[laser-sweep_2.5s_ease-in-out_infinite] opacity-80" />
                        <div className="absolute left-0 right-0 h-40 bg-gradient-to-b from-sky-400/20 to-transparent animate-[laser-sweep_2.5s_ease-in-out_infinite]" />
                        <div className="absolute bottom-6 left-6 flex flex-col gap-1.5">
                           <span className="text-[10px] font-mono text-sky-400 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-sky-500/30 uppercase tracking-[0.2em] shadow-lg w-fit">
                             [ NEURAL NET ACTIVE ]
                           </span>
                           <span className="text-xs font-mono font-bold text-white bg-black/80 px-2 py-1 rounded border border-white/10 uppercase tracking-widest shadow-xl w-fit animate-pulse">
                             EXTRACTING FEATURES... {Math.floor(uploadProgress)}%
                           </span>
                        </div>
                      </div>
                    )}
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
                      // HUD 文件预览模式
                      <div className="relative flex flex-col items-center justify-center w-full h-full min-h-[220px] p-2 sm:p-4 animate-in zoom-in-95 fade-in duration-500">
                        {/* 沉浸式图源氛围底色 */}
                        {previewUrl && (
                          <div
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-[60px] opacity-40 scale-110 saturate-150 transition-opacity duration-1000"
                            style={{ backgroundImage: `url(${previewUrl})` }}
                          />
                        )}
                        <div className="absolute inset-0 bg-black/20 pointer-events-none" />

                        {/* 主预览图与瞄准框 */}
                        <div className="relative w-full max-w-2xl flex-1 flex flex-col justify-center min-h-[160px] max-h-[340px]">
                            {/* 四角机甲准星边框 */}
                            <div className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 border-sky-400 opacity-80 z-20" />
                            <div className="absolute -top-2 -right-2 w-6 h-6 border-t-2 border-r-2 border-sky-400 opacity-80 z-20" />
                            <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-2 border-l-2 border-sky-400 opacity-80 z-20" />
                            <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-sky-400 opacity-80 z-20" />
                            
                            {/* 图片容器 */}
                            <div className="relative w-full h-full flex items-center justify-center bg-black/40 border border-white/10 overflow-hidden backdrop-blur-sm shadow-2xl group/preview rounded-sm">
                                {previewUrl ? (
                                  <AdaptiveImage
                                    src={previewUrl}
                                    alt="预览"
                                    className="max-w-full max-h-[340px] object-contain transition-transform duration-700 group-hover/preview:scale-[1.02]"
                                    sizes="(max-width: 1024px) 100vw, 768px"
                                  />
                                ) : (
                                  <div className="w-12 h-12 border-4 border-sky-500/30 border-t-sky-400 rounded-full animate-spin" />
                                )}

                                {/* 清除按钮 - 悬浮在右上角内部 */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleClearFile();
                                  }}
                                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-semibold tracking-widest text-white/70 hover:bg-rose-500/90 hover:text-white hover:border-rose-400 hover:shadow-[0_0_20px_rgba(244,63,94,0.5)] transition-all duration-300 z-50 group/btn"
                                  title="移除图像"
                                >
                                  <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>REMOVE</span>
                                </button>

                                {/* 数据参数平视显示仪 (Metadata HUD Overlay) */}
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-500/30 pt-3 px-1">
                                     <div className="flex items-center gap-3">
                                       <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-sky-400 bg-sky-950/80 px-2 py-1 rounded-sm border border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]">
                                         [ INPUT DETECTED ]
                                       </span>
                                       <span className="text-xs font-mono text-white/80 truncate max-w-[120px] sm:max-w-[200px]">
                                         {selectedFile.name}
                                       </span>
                                     </div>
                                     <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono text-sky-300/70 uppercase tracking-widest">
                                        <span>[ VOL: {formatFileSize(selectedFile.size)} ]</span>
                                        <span>[ FMT: {selectedFile.type.split('/')[1] || 'IMG'} ]</span>
                                     </div>
                                  </div>
                                </div>
                            </div>
                        </div>
                      </div>
                    ) : (
                      // 空状态
                      <>
                        <div className={`relative w-24 h-24 mb-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent flex items-center justify-center transition-all duration-700 shadow-2xl ${isDragging ? 'scale-110 border-sky-400/50 bg-sky-500/10 shadow-[0_0_50px_rgba(56,189,248,0.3)]' : 'group-hover:-translate-y-2 group-hover:border-sky-500/40 group-hover:bg-sky-500/5 group-hover:shadow-[0_15px_40px_rgba(0,210,255,0.15)]'}`}>
                          <div className="absolute inset-0 rounded-2xl bg-sky-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                          <svg className={`w-10 h-10 transition-colors duration-500 relative z-10 ${isDragging ? 'text-sky-300' : 'text-white/40 group-hover:text-sky-400'} animate-pulse`} style={{ animationDuration: '3s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 17V7m0 0l-3 3m3-3l3 3" />
                          </svg>
                        </div>
                        <span className="text-[22px] font-light text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-wide transition-colors group-hover:from-sky-100 group-hover:to-white">
                          点击或拖拽进行解析
                        </span>
                        <span className="mt-3 text-[10px] font-mono uppercase tracking-[0.35em] text-sky-500/50 group-hover:text-sky-400/80 transition-colors">
                          AI SCANNER READY · MAX {MAX_UPLOAD_SIZE_MB}MB
                        </span>
                        <span className="mt-5 max-w-sm text-xs leading-relaxed text-white/30 text-center font-light">
                          引擎已就绪，高分辨近景图像将获得更精确的六类病害识别与定位结果。
                        </span>
                      </>
                    )}
                  </div>
                )}
              </label>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">
                  2 分析设置
                </p>
                <p className="text-xs text-white/35">高级参数已预置默认值，首次使用可直接开始检测。</p>
              </div>

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
                            } 执行推理。${
                              selectedModelSupportsSlicedInference
                                ? " 支持切片推理。"
                                : " 当前仅支持 direct 推理。"
                            }`
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

                {/* Advanced Settings Accordion */}
                <div className="sm:col-span-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] px-4 py-3 text-sm text-white/50 transition-colors hover:bg-white/[0.03] hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      高级配置 (Advanced Settings)
                    </span>
                    <svg
                      className={`h-4 w-4 transform transition-transform duration-200 ${showAdvancedSettings ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Accordion Content */}
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showAdvancedSettings ? 'max-h-[500px] mt-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={`rounded-xl border border-white/5 bg-white/[0.02] p-4 flex items-center justify-between group transition-colors ${
                        selectedModelSupportsMasks
                          ? "cursor-pointer hover:bg-white/[0.04]"
                          : "cursor-not-allowed opacity-60"
                      }`}>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">导出结果图</span>
                          <span className="text-xs text-white/30 font-light">
                            {selectedModelSupportsMasks ? "同步生成可视化结果图文件" : "当前模型不支持结果图导出"}
                          </span>
                        </div>
                        <div className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${exportOverlay ? "bg-white/80" : "bg-white/10"}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-black transition-transform mt-1 ${exportOverlay ? "translate-x-5" : "translate-x-1"}`} />
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={exportOverlay}
                          disabled={!selectedModelSupportsMasks}
                          onChange={() => setExportOverlay(!exportOverlay)}
                        />
                      </label>

                      {/* GSD 物理尺寸换算配置 */}
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 group transition-colors hover:bg-white/[0.04]">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">物理换算比例 (GSD)</span>
                            <span className="text-xs text-white/30 font-light">
                              {pixelsPerMm} px/mm
                            </span>
                          </div>
                          <span className="font-mono text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                            1cm ≈ {Math.round(pixelsPerMm * 10)} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          step="0.5"
                          value={pixelsPerMm}
                          onChange={(e) => setPixelsPerMm(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-400 group-hover:bg-white/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300/80">
                    3 提交前确认
                  </p>
                  <p className="text-xs text-white/35">确认输入与输出后即可开始检测。</p>
                </div>
                <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">待分析图片</p>
                      <p className="mt-2 text-sm text-white">
                        {selectedFile ? selectedFile.name : "尚未选择图片"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">模型版本</p>
                      <p className="mt-2 text-sm text-white">
                        {selectedModel ? formatModelLabel(selectedModel) : "等待模型列表加载"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">最低置信度</p>
                      <p className="mt-2 text-sm text-white">{confidence.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">预计输出</p>
                      <p className="mt-2 text-sm text-white">
                        {exportOverlay ? "结构化结果 + 结果图" : "结构化结果"}
                      </p>
                    </div>
                  </div>
                </div>
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

              <div className="mt-8 flex gap-4 sticky bottom-0 bg-black/60 backdrop-blur-2xl -mx-6 sm:-mx-10 px-6 sm:px-10 py-5 border-t border-white/10 z-20">
                <button
                  className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-sky-600 to-emerald-500 px-6 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(14,165,233,0.3)] transition-all hover:shadow-[0_0_50px_rgba(14,165,233,0.5)] hover:bg-gradient-to-r hover:from-sky-500 hover:to-emerald-400 hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none border-t border-white/30"
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
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-[shimmer_1.5s_ease-in-out_infinite]" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {status.phase === "idle" || status.phase === "error" ? (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        启动深度检测分析
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        引擎处理中...
                      </>
                    )}
                  </span>
                </button>
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.98]"
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
        @keyframes laser-sweep {
          0% { top: -10%; opacity: 0; }
          10% { opacity: 1; top: 0%; }
          90% { opacity: 1; top: 100%; }
          100% { top: 110%; opacity: 0; }
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </main>
  );
}
