"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useState
} from "react";
import Link from "next/link";

import { HistoryPanel } from "@/components/history-panel";
import { ResultDashboard } from "@/components/result-dashboard";
import { StatusCard } from "@/components/status-card";
import {
  filterHistoryItems,
  sortHistoryItems,
  type HistorySortMode
} from "@/lib/history-utils";
import {
  deleteResult,
  getOverlayDownloadUrl,
  getResultImageUrl,
  getResult,
  listResults,
  predictImage
} from "@/lib/predict-client";
import type {
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
  const [result, setResult] = useState<PredictionResult | null>(null);
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
  const [actionNotices, setActionNotices] = useState<ActionNotice[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [minConfidence, setMinConfidence] = useState(0.3);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [resultViewMode, setResultViewMode] = useState<"image" | "overlay">("image");

  const deferredCategoryFilter = useDeferredValue(categoryFilter);
  const deferredMinConfidence = useDeferredValue(minConfidence);

  const categories = result
    ? ["全部", ...new Set(result.detections.map((item) => item.category))]
    : ["全部"];
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
        setSelectedFile(null);
        setPreviewUrl(getResultImageUrl(imageId));
        setCategoryFilter("全部");
        setSelectedDetectionId(nextResult.detections[0]?.id ?? null);
        setResultViewMode("image");
        setActiveNav("Home");
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

    setStatus({
      phase: "uploading",
      message: `正在上传 ${selectedFile.name}，随后会进入推理流程。`
    });

    try {
      setStatus({
        phase: "running",
        message: "后端已接收任务，正在执行 YOLOv8-seg 推理。"
      });

      const prediction = await predictImage(selectedFile, {
        confidence,
        exportOverlay
      });

      startTransition(() => {
        setResult(prediction);
        setCategoryFilter("全部");
        setSelectedDetectionId(prediction.detections[0]?.id ?? null);
        setResultViewMode("image");
        setActiveNav("Home");
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

  return (
    <main className="flex h-screen w-full bg-black text-slate-200 overflow-hidden font-sans">
      <aside className="w-20 lg:w-64 shrink-0 border-r border-white/5 bg-black flex flex-col">
        <div className="flex h-16 items-center justify-center lg:justify-start lg:px-6 border-b border-white/5">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="h-8 w-8 rounded-lg bg-black border border-white/20 flex items-center justify-center">
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

        <nav className="flex-1 py-6 px-3 flex flex-col gap-2">
          <button
            type="button"
            className={`flex items-center gap-4 px-3 py-2.5 rounded-lg transition-colors ${activeNav === "Home"
              ? "bg-white/10 text-white font-medium shadow-[inset_2px_0_0_0_#fff]"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            onClick={() => setActiveNav("Home")}
          >
            <div className="shrink-0 h-5 w-5 bg-current opacity-70 mask-icon" />
            <span className="hidden lg:block text-[11px] uppercase tracking-widest">主页</span>
          </button>

          <button
            type="button"
            className={`flex items-center gap-4 px-3 py-2.5 rounded-lg transition-colors ${activeNav === "Scans"
              ? "bg-white/10 text-white font-medium shadow-[inset_2px_0_0_0_#fff]"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            onClick={() => {
              setActiveNav("Scans");
              void loadHistory();
            }}
          >
            <div className="shrink-0 h-5 w-5 bg-current opacity-70 mask-icon" />
            <span className="hidden lg:block text-[11px] uppercase tracking-widest">最近记录</span>
          </button>
        </nav>
      </aside>

      {/* 主视图区 (图传/回放/上传) */}
      <section className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-black/60 backdrop-blur-3xl">
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
            <div className="h-full flex flex-col items-center justify-center">
              <div className="w-full max-w-2xl relative z-10">
                <div className="rounded-[2rem] border border-white/5 bg-black/40 p-8 shadow-2xl backdrop-blur-3xl">
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-3">
                      工作台
                    </p>
                    <h2 className="text-3xl font-light tracking-[0.05em] uppercase text-white mb-4">
                      开始新的分析任务
                    </h2>
                    <p className="text-slate-400 text-sm max-w-xl mx-auto font-light">
                      点击左侧“新建分析”上传照片并弹出分析面板，或进入“最近记录”继续查看已经完成的分析结果。
                    </p>
                  </div>

                  <div className="mt-12 grid gap-6 sm:grid-cols-2">
                    <button
                      className="group rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition-all hover:bg-white/10 hover:border-white/20"
                      type="button"
                      onClick={handleResetToUploader}
                    >
                      <div className="mb-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <h3 className="text-lg tracking-wider uppercase font-medium text-white">上传分析</h3>
                      <p className="mt-2 text-xs text-slate-400 leading-relaxed font-light">
                        打开上传面板，选择巡检图片并调整模型置信度阈值。
                      </p>
                    </button>

                    <button
                      className="group rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition-all hover:bg-white/10 hover:border-white/20"
                      type="button"
                      onClick={() => {
                        setActiveNav("Scans");
                        void loadHistory();
                      }}
                    >
                      <div className="mb-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <h3 className="text-lg tracking-wider uppercase font-medium text-white">历史档案</h3>
                      <p className="mt-2 text-xs text-slate-400 leading-relaxed font-light">
                        进入沉浸式画廊，回看最近的分析记录与推理结果。
                      </p>
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                  <div className="rounded-auth border border-white/5 bg-black/20 p-6 shadow-xl backdrop-blur-xl rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
                        最近记录
                      </p>
                      <button
                        className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white transition-colors"
                        type="button"
                        onClick={() => {
                          setActiveNav("Scans");
                          void loadHistory();
                        }}
                      >
                        查看全部
                      </button>
                    </div>

                    <div className="space-y-2">
                      {historyItems.length > 0 ? (
                        historyItems.slice(0, 3).map((item) => (
                          <button
                            key={item.image_id}
                            className="flex w-full items-center justify-between rounded-lg border border-transparent hover:border-white/10 bg-transparent hover:bg-white/5 px-3 py-2 text-left transition-all"
                            type="button"
                            onClick={() => {
                              void handleSelectHistory(item.image_id);
                            }}
                          >
                            <div className="min-w-0 flex items-center gap-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                              <p className="truncate text-sm tracking-wide text-white">
                                {item.image_id}
                              </p>
                            </div>
                            <span className="text-xs font-mono text-white/40">
                              {item.inference_ms}ms
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="py-4 text-center text-xs text-white/30 font-light">
                          暂无最近记录。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-black/20 p-6 shadow-xl backdrop-blur-xl flex flex-col justify-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
                      系统建议
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-slate-300 font-light">
                      {statusSuggestion.body}
                    </p>
                    <div className="mt-5 flex gap-3">
                      <button
                        className="rounded border border-white/20 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-white transition-colors hover:bg-white/20 w-fit"
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
                categoryFilter={deferredCategoryFilter}
                minConfidence={deferredMinConfidence}
                previewUrl={previewUrl}
                overlayPreviewUrl={result.artifacts.overlay_path ?? null}
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
                rerunDisabled={!selectedFile}
              />
            </div>
          )}
        </div>
      </section>

      {/* 右侧边栏 (状态机/统计) */}
      <aside className="w-[360px] shrink-0 border-l border-white/5 bg-black flex flex-col z-10 relative shadow-[-20px_0_50px_rgba(0,0,0,0.8)]">
        <div className="p-6 border-b border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 mb-2">系统状态</p>
          <StatusCard phase={status.phase} message={status.message} />
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
                    <span className="text-white/50">模型版本</span>
                    <span className="text-white/70">{result.model_version}</span>
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-black/40 p-10 shadow-[0_0_100px_rgba(0,0,0,1)]">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2">
                  分析面板
                </p>
                <h2 className="mt-2 text-3xl font-light tracking-[0.05em] uppercase text-white">
                  执行新视觉分析
                </h2>
                <p className="mt-3 text-sm text-slate-400 font-light">
                  请选择目标图像，引擎会即刻启动推理。
                </p>
              </div>
              <button
                className="rounded-full border border-white/10 bg-white/5 w-10 h-10 flex items-center justify-center text-slate-200 transition-colors hover:bg-white/10"
                type="button"
                onClick={closeAnalysisModal}
              >
                ✕
              </button>
            </div>

            <form className="mt-10" onSubmit={handleSubmit}>
              <label className="relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all duration-500 group overflow-hidden">
                <input
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  name="image"
                  type="file"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null);
                    setStatus(initialState);
                  }}
                />

                {previewUrl && (
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 transition-opacity duration-700 group-hover:opacity-10"
                    style={{ backgroundImage: `url(${previewUrl})` }}
                  />
                )}

                {(status.phase === "uploading" || status.phase === "running") && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="w-full h-[2px] bg-white/80 shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent animate-[scan_2s_ease-in-out_infinite]" style={{ height: "30%" }} />
                  </div>
                )}

                <div className="relative z-10 flex flex-col items-center text-center p-6">
                  <div className="w-16 h-16 mb-6 rounded-full border border-white/10 bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <svg className="w-6 h-6 text-white/70 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <span className="text-lg font-light text-slate-200 tracking-wide">
                    {selectedFile ? selectedFile.name : "点击或拖拽上传图像"}
                  </span>
                </div>
              </label>

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
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

                <label className="rounded-xl border border-white/5 bg-white/[0.02] p-5 flex items-center justify-between cursor-pointer group hover:bg-white/[0.04] transition-colors">
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

              <div className="mt-6">
                <StatusCard phase={status.phase} message={status.message} />
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  className="flex-1 rounded-xl bg-sky-500/10 border border-sky-500/50 px-6 py-4 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedFile || status.phase === "uploading" || status.phase === "running"}
                  title={!selectedFile ? "请先选择一张待分析图片" : undefined}
                  type="submit"
                >
                  {status.phase === "idle" || status.phase === "error" ? "开始执行 AI 识别" : "推理中..."}
                </button>
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
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
