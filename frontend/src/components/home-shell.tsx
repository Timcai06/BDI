"use client";

import { startTransition, useDeferredValue, useState, useEffect } from "react";

import { HistoryPanel } from "@/components/history-panel";
import { ResultDashboard } from "@/components/result-dashboard";
import { StatusCard } from "@/components/status-card";
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type NavItem = "Home" | "Scans";

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
  const [status, setStatus] = useState<PredictState>(initialState);
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [minConfidence, setMinConfidence] = useState(0.3);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);

  const deferredCategoryFilter = useDeferredValue(categoryFilter);
  const deferredMinConfidence = useDeferredValue(minConfidence);

  const categories = result
    ? ["全部", ...new Set(result.detections.map((item) => item.category))]
    : ["全部"];

  useEffect(() => {
    void loadHistory({ silent: true });
  }, []);

  async function loadHistory({ silent = false }: { silent?: boolean } = {}) {
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
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "历史结果读取失败，请稍后重试。";
      setHistoryError(message);
      setStatus({
        phase: "error",
        message
      });
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSelectHistory(imageId: string) {
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
        setActiveNav("Home");
      });
      setStatus({
        phase: "success",
        message: `已打开 ${imageId} 的历史结果。`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "历史结果加载失败，请稍后重试。";
      setStatus({
        phase: "error",
        message
      });
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
      return;
    }

    downloadRemoteFile(overlayUrl, `${result.image_id}-overlay.png`);
    setStatus({
      phase: "success",
      message: `已触发 ${result.image_id} 的 overlay 导出。`
    });
  }

  function handleResetToUploader() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setActiveNav("Home");
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
      secondaryAction: () => {}
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
      preventDefault() {}
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
      await sleep(450);
      setStatus({
        phase: "running",
        message: "后端已接收任务，正在执行 YOLOv8-seg 推理。"
      });

      const prediction = await predictImage(selectedFile, {
        confidence,
        exportOverlay
      });

      await sleep(650);

      startTransition(() => {
        setResult(prediction);
        setCategoryFilter("全部");
        setSelectedDetectionId(prediction.detections[0]?.id ?? null);
        setActiveNav("Home");
      });

      void loadHistory();
      setAnalysisModalOpen(false);

      setStatus({
        phase: "success",
        message: `识别完成，已返回 ${prediction.detections.length} 条病害结果。`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "识别失败，请检查服务状态后重试。";

      setStatus({
        phase: "error",
        message
      });
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
        setActiveNav("Home");
      }
      setDeleteTargetId(null);
      setStatus({
        phase: "success",
        message: `已删除 ${imageId} 的分析记录。`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "删除记录失败，请稍后重试。";
      setStatus({
        phase: "error",
        message
      });
    } finally {
      setDeletingImageId(null);
    }
  }

  return (
    <main className="flex h-screen w-full bg-[#0B1120] text-slate-200 overflow-hidden font-sans">
      {/* 极简左侧侧边栏 */}
      <aside className="w-20 lg:w-64 shrink-0 border-r border-white/5 bg-[#0B1120] flex flex-col">
        <div className="flex h-16 items-center justify-center lg:justify-start lg:px-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-sky-500 flex items-center justify-center">
              <span className="text-white font-bold font-mono">BDI</span>
            </div>
            <span className="hidden lg:block font-semibold tracking-wide text-white">INFRA-SCAN</span>
          </div>
        </div>

        <div className="px-3 pt-6">
          <button
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-3 text-sky-300 transition-colors hover:bg-sky-500/20 lg:justify-start"
            type="button"
            onClick={handleResetToUploader}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-sm font-bold text-white">
              +
            </span>
            <span className="hidden text-sm font-semibold lg:block">新建分析</span>
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 flex flex-col gap-2">
          <button
            type="button"
            className={`flex items-center gap-4 px-3 py-2.5 rounded-lg transition-colors ${activeNav === "Home"
                ? "bg-white/10 text-sky-400 font-medium"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            onClick={() => setActiveNav("Home")}
          >
            <div className="shrink-0 h-5 w-5 bg-current opacity-70 mask-icon" />
            <span className="hidden lg:block text-sm">主页</span>
          </button>

          <button
            type="button"
            className={`flex items-center gap-4 px-3 py-2.5 rounded-lg transition-colors ${activeNav === "Scans"
                ? "bg-white/10 text-sky-400 font-medium"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            onClick={() => {
              setActiveNav("Scans");
              void loadHistory();
            }}
          >
            <div className="shrink-0 h-5 w-5 bg-current opacity-70 mask-icon" />
            <span className="hidden lg:block text-sm">最近记录</span>
          </button>
        </nav>
      </aside>

      {/* 主视图区 (图传/回放/上传) */}
      <section className="flex-1 flex flex-col min-w-0 bg-[#0F172A]/50 relative">
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-[#0B1120]/80 backdrop-blur">
          <h1 className="text-lg font-medium text-slate-100">
            {activeNav === "Scans"
              ? "Historical Scan Archive"
              : result
                ? result.image_id
                : "Bridge Defect Home"}
          </h1>
          <div className="flex items-center gap-4">
            <button
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/20"
              type="button"
              onClick={handleResetToUploader}
            >
              上传照片
            </button>
            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-slate-400">
              Phase 3
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarGutter: 'stable' }}>
          {activeNav === "Scans" ? (
            <HistoryPanel
              items={historyItems}
              loading={historyLoading}
              errorMessage={historyError}
              deletingImageId={deletingImageId}
              getImageUrl={getResultImageUrl}
              onDeleteRequest={(imageId) => {
                setDeleteTargetId(imageId);
              }}
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
              <div className="w-full max-w-2xl">
                <div className="rounded-[2rem] border border-white/10 bg-[#1E293B]/60 p-8 shadow-2xl backdrop-blur-xl">
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500 mb-2">
                      Workspace
                    </p>
                    <h2 className="text-3xl font-light tracking-tight text-white mb-4">
                      从左侧入口开始新的分析任务
                    </h2>
                    <p className="text-slate-400 text-sm max-w-xl mx-auto">
                      点击左侧“新建分析”上传照片并弹出分析面板，或进入“最近记录”继续查看已经完成的分析结果。
                    </p>
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <button
                      className="rounded-[1.5rem] border border-sky-500/30 bg-sky-500/10 p-6 text-left transition-colors hover:bg-sky-500/20"
                      type="button"
                      onClick={handleResetToUploader}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-sky-300">
                        Primary Entry
                      </p>
                      <h3 className="mt-3 text-xl font-medium text-white">上传照片并开始分析</h3>
                      <p className="mt-3 text-sm text-sky-100/80">
                        打开弹出式分析面板，选择图片、调整阈值并启动识别。
                      </p>
                    </button>

                    <button
                      className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 text-left transition-colors hover:bg-white/[0.06]"
                      type="button"
                      onClick={() => {
                        setActiveNav("Scans");
                        void loadHistory();
                      }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                        Secondary Entry
                      </p>
                      <h3 className="mt-3 text-xl font-medium text-white">进入最近分析记录</h3>
                      <p className="mt-3 text-sm text-slate-400">
                        查看最近的图片、检测结果和历史摘要，继续回看与导出。
                      </p>
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/40 p-5 shadow-xl backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                          Recent Activity
                        </p>
                        <h3 className="mt-2 text-lg font-medium text-white">
                          最近分析记录
                        </h3>
                      </div>
                      <button
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
                        type="button"
                        onClick={() => {
                          setActiveNav("Scans");
                          void loadHistory();
                        }}
                      >
                        打开历史
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {historyItems.length > 0 ? (
                        historyItems.slice(0, 3).map((item) => (
                          <button
                            key={item.image_id}
                            className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.06]"
                            type="button"
                            onClick={() => {
                              void handleSelectHistory(item.image_id);
                            }}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {item.image_id}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {item.model_version} / {item.detection_count} detections
                              </p>
                            </div>
                            <span className="text-xs font-mono text-sky-400">
                              {item.inference_ms}ms
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                          还没有历史记录。完成第一次分析后，这里会出现最近结果入口。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/40 p-5 shadow-xl backdrop-blur">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                      Guided Action
                    </p>
                    <h3 className="mt-2 text-lg font-medium text-white">
                      {statusSuggestion.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {statusSuggestion.body}
                    </p>
                    <div className="mt-5 flex gap-3">
                      <button
                        className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/20"
                        type="button"
                        onClick={statusSuggestion.primaryAction}
                      >
                        {statusSuggestion.primaryLabel}
                      </button>
                      <button
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
                        type="button"
                        onClick={statusSuggestion.secondaryAction}
                      >
                        {statusSuggestion.secondaryLabel}
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
      <aside className="w-[360px] shrink-0 border-l border-white/5 bg-[#0B1120] flex flex-col z-10 relative shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-6 border-b border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-2">System Status</p>
          <StatusCard phase={status.phase} message={status.message} />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-3">Display Filters</p>
                <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Class</span>
                    <select
                      className="bg-[#0F172A] border border-white/10 rounded-md text-xs text-slate-200 px-2 py-1 outline-none focus:border-sky-500"
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
                      <span className="text-xs text-slate-400">Min Conf.</span>
                      <span className="text-xs font-mono text-sky-400">{(minConfidence * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      className="w-full accent-sky-500 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:rounded-full"
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
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-2">Backend Diagnostics</p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-500">Latency</span>
                    <span className="text-sky-400">{result.inference_ms}ms</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-500">Model</span>
                    <span className="text-slate-300">{result.model_version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Params</span>
                    <span className="text-slate-300 flex gap-2">
                      <span className="px-1 bg-white/5 rounded">conf:{confidence}</span>
                      <span className="px-1 bg-white/5 rounded">iou:0.45</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {analysisModalOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617]/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[#111827] p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
                  Analysis Modal
                </p>
                <h2 className="mt-3 text-3xl font-light tracking-tight text-white">
                  上传照片并执行分析
                </h2>
                <p className="mt-3 text-sm text-slate-400">
                  选择一张巡检图像，系统会在当前工作台中打开分析结果。
                </p>
              </div>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
                type="button"
                onClick={closeAnalysisModal}
              >
                关闭
              </button>
            </div>

            <form className="mt-8" onSubmit={handleSubmit}>
              <label className="relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-white/10 bg-black/20 hover:bg-black/40 hover:border-sky-500/50 transition-all group overflow-hidden">
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
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 transition-opacity group-hover:opacity-20"
                    style={{ backgroundImage: `url(${previewUrl})` }}
                  />
                )}

                {(status.phase === "uploading" || status.phase === "running") && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="w-full h-[2px] bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-sky-500/5 to-transparent animate-[scan_2s_ease-in-out_infinite]" style={{ height: "30%" }} />
                  </div>
                )}

                <div className="relative z-10 flex flex-col items-center text-center p-6">
                  <div className="w-16 h-16 mb-4 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-slate-400 group-hover:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <span className="text-lg font-medium text-slate-200">
                    {selectedFile ? selectedFile.name : "点击或拖拽上传图片"}
                  </span>
                </div>
              </label>

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <label className="rounded-xl border border-white/5 bg-white/5 p-4 block">
                  <span className="text-sm font-medium text-slate-300">Minimum Confidence</span>
                  <div className="mt-3 flex items-center gap-4">
                    <input
                      className="flex-1 accent-sky-500"
                      max="0.95"
                      min="0.1"
                      step="0.05"
                      type="range"
                      value={confidence}
                      onChange={(event) => setConfidence(Number(event.target.value))}
                    />
                    <span className="font-mono text-sm text-sky-400 bg-sky-500/10 px-2 py-1 rounded">
                      {confidence.toFixed(2)}
                    </span>
                  </div>
                </label>

                <label className="rounded-xl border border-white/5 bg-white/5 p-4 flex items-center justify-between cursor-pointer group">
                  <div>
                    <span className="text-sm font-medium text-slate-300 block mb-1">Export Overlay</span>
                    <span className="text-xs text-slate-500">生成带 BBox 的渲染图</span>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${exportOverlay ? "bg-sky-500" : "bg-white/20"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-1 ${exportOverlay ? "translate-x-6" : "translate-x-1"}`} />
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
                  disabled={status.phase === "uploading" || status.phase === "running"}
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
              Delete Record
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
