"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardRightRail } from "@/components/dashboard-right-rail";
import { classifyError, type ErrorType } from "@/components/error-message";
import { type ValidationError } from "@/components/file-validator";
import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { ScanAnimation } from "@/components/scan-animation";
import { StatusCard } from "@/components/status-card";
import { useActionNotices } from "@/hooks/use-action-notices";
import { useHistorySummary } from "@/hooks/use-history-summary";
import { useModelCatalog } from "@/hooks/use-model-catalog";
import { formatModelLabel } from "@/lib/model-labels";
import { predictImage } from "@/lib/predict-client";
import { getUploadSizeError } from "@/lib/upload-validation";
import type { PredictState } from "@/lib/types";

const DEFAULT_PIXELS_PER_MM = 10.0;

const initialState: PredictState = {
  phase: "idle",
  message: "该页面仅用于单图实验。主业务流程请优先使用桥梁 -> 批次工作台。",
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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
  const [status, setStatus] = useState<PredictState>(initialState);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scanPhase, setScanPhase] = useState<"uploading" | "analyzing" | "detecting" | "complete">("uploading");
  const { actionNotices, pushActionNotice } = useActionNotices();
  const [, setLastError] = useState<{ type: ErrorType; message: string } | null>(null);
  const [, setValidationErrors] = useState<ValidationError[]>([]);
  const {
    availableModels,
    modelsError,
    modelsLoading,
    selectedModelVersion,
    setSelectedModelVersion,
  } = useModelCatalog();
  const { historyTotal, loadHistory } = useHistorySummary({
    onLoadError: (message) => {
      setStatus({ phase: "error", message });
      pushActionNotice("历史加载失败", message, "error");
    },
    onLoadSuccess: (history, options) => {
      if (options.silent) {
        return;
      }
      setStatus({
        phase: "success",
        message: `历史结果已刷新，当前共 ${history.total} 条记录。`,
      });
      pushActionNotice("历史已刷新", `当前共 ${history.total} 条记录。`, "success");
    },
  });

  useEffect(() => {
    void loadHistory({ silent: true });
  }, [loadHistory]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function resetSelectedFile() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
  }

  function handleResetToUploader() {
    resetSelectedFile();
    setStatus(initialState);
    setAnalysisModalOpen(true);
  }

  function closeAnalysisModal() {
    setAnalysisModalOpen(false);
  }

  function validateDroppedFile(file: File): ValidationError[] {
    const errors: ValidationError[] = [];
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      errors.push({
        type: "type",
        message: `${file.name} 不是支持的格式 (JPG, JPEG, PNG)`,
        fileName: file.name,
      });
    }

    const uploadSizeError = getUploadSizeError(file);
    if (uploadSizeError) {
      errors.push({
        type: "size",
        message: uploadSizeError,
        fileName: file.name,
      });
    }
    return errors;
  }

  function applySelectedFile(file: File) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setStatus(initialState);
  }

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
    const rect = event.currentTarget.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
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

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    const errors = validateDroppedFile(file);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setStatus({
        phase: "error",
        message: `文件验证失败: ${errors.map((item) => item.message).join(", ")}`,
      });
      return;
    }

    setValidationErrors([]);
    setLastError(null);
    applySelectedFile(file);
  }

  function handleClearFile() {
    resetSelectedFile();
    setStatus(initialState);
    setValidationErrors([]);
    setLastError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setStatus({
        phase: "error",
        message: "请先选择一张 jpg、jpeg 或 png 图像。",
      });
      return;
    }

    const uploadSizeError = getUploadSizeError(selectedFile);
    if (uploadSizeError) {
      setStatus({
        phase: "error",
        message: uploadSizeError,
      });
      return;
    }

    setUploadProgress(10);
    setScanPhase("uploading");
    setStatus({
      phase: "uploading",
      message: `正在准备 ${selectedFile.name}...`,
    });

    const selectedModel =
      availableModels.find((model) => model.model_version === selectedModelVersion) ?? null;
    const selectedModelSupportsOverlay = selectedModel?.supports_overlay ?? true;

    try {
      setScanPhase("analyzing");
      setUploadProgress(40);
      setStatus({
        phase: "running",
        message: `正在请求后端执行 ${selectedModel ? formatModelLabel(selectedModel) : "当前模型"} 推理...`,
      });

      const prediction = await predictImage(selectedFile, {
        confidence,
        exportOverlay: exportOverlay && selectedModelSupportsOverlay,
        modelVersion: selectedModelVersion,
        pixelsPerMm: DEFAULT_PIXELS_PER_MM,
        enhance,
      });

      setScanPhase("detecting");
      setUploadProgress(90);
      await new Promise((resolve) => setTimeout(resolve, 200));

      setUploadProgress(100);
      setScanPhase("complete");
      void loadHistory({ forceFresh: true });
      setAnalysisModalOpen(false);
      pushActionNotice("识别完成", `${prediction.detections.length} 条病害结果已生成。`, "success");
      router.push(`/dashboard/history/${prediction.image_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "识别失败，请检查服务状态后重试。";
      const errorType = classifyError(error);
      setLastError({ type: errorType, message });
      setStatus({ phase: "error", message });
      pushActionNotice("识别失败", message, "error");
    }
  }

  const selectedModel =
    availableModels.find((model) => model.model_version === selectedModelVersion) ?? null;
  const rightRailSections = [
    {
      title: "模型数",
      value: `${availableModels.length} 个`,
      hint: modelsLoading ? "正在读取模型目录…" : modelsError ?? "当前可用模型版本总数。",
      tone: "sky" as const,
    },
    {
      title: "历史记录",
      value: `${historyTotal} 条`,
      hint: "实验页识别完成后会直接跳转到历史详情。",
      tone: "emerald" as const,
    },
    {
      title: "当前模型",
      value: selectedModel ? formatModelLabel(selectedModel) : "未选择",
      hint: status.message,
    },
  ];

  return (
    <>
      <section className="flex-1 flex flex-col min-w-0 bg-black/40 relative z-10 page-enter">
        <div className="px-6 pt-6">
          <OpsPageHeader
            eyebrow="LAB"
            title="单图实验页"
            subtitle="SECONDARY ENTRY / SINGLE IMAGE DIAGNOSTIC"
            actions={
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/40">
                SECONDARY_ENTRY
              </span>
            }
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative" style={{ scrollbarGutter: "stable" }}>
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="text-center py-12 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 mb-2">
                  <span className="h-1 w-1 rounded-full bg-cyan-400" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400 m-0">
                    SINGLE IMAGE LAB
                  </p>
                </div>
                <h2 className="text-4xl lg:text-6xl font-black tracking-tighter text-white uppercase leading-none">
                  单图 AI 实验入口
                </h2>
                <p className="text-white/40 text-sm max-w-2xl mx-auto font-medium uppercase tracking-widest leading-relaxed">
                  仅用于单图快速试跑。正式业务流程请优先走桥梁资产与批次工作台。
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
                        <svg className="w-10 h-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ animationDuration: "3s" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-3xl font-black tracking-tight text-white uppercase">打开实验上传器</h3>
                        <p className="text-sm text-white/30 uppercase tracking-[0.2em] font-medium">
                          SINGLE_IMAGE_ONLY / RESULT_REDIRECTS_TO_HISTORY
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DashboardRightRail
        eyebrow="Dashboard / Status"
        title="实验页状态"
        description="单图实验页保留上传试跑能力，但不再承接主业务工作流。"
        sections={rightRailSections}
      />

      {analysisModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-3xl overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-[2.5rem] border border-white/10 bg-black/60 p-8 sm:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.8)] my-auto overflow-hidden">
            <div className="relative flex items-start justify-between gap-6 z-10">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 m-0">DIAGNOSTIC_INITIATOR</p>
                </div>
                <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter text-white">启动单图实验</h2>
                <p className="mt-4 text-xs text-white/30 font-medium uppercase tracking-[0.2em] leading-relaxed max-w-xl">
                  SECONDARY LAB / 上传后将直接跳转历史详情，不在本页承接结果看板。
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
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">01_SOURCE_SELECTION</p>
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
                      applySelectedFile(nextFile);
                    }
                  }}
                />

                {previewUrl ? (
                  <div className="absolute inset-0 z-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="preview" className="h-full w-full object-cover opacity-20 blur-xl" />
                  </div>
                ) : null}

                <div className="relative z-10 flex flex-col items-center gap-4 text-center p-8">
                  {selectedFile ? (
                    <div className="space-y-4">
                      <div className="h-20 w-32 rounded-xl border border-white/20 bg-black/40 overflow-hidden mx-auto shadow-2xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl ?? ""} alt="mini-preview" className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-white uppercase tracking-tight">{selectedFile.name}</p>
                        <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mt-1">
                          FILE_READY / {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                      <button type="button" onClick={(event) => {
                        event.preventDefault();
                        handleClearFile();
                      }} className="text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest border-b border-rose-500/30 pb-0.5">
                        DISCARD_FILE
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">注入影像数据</h3>
                      <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">DROP_FILE_TO_BEGIN_ANALYSIS</p>
                    </>
                  )}
                </div>

                {status.phase === "uploading" || status.phase === "running" ? (
                  <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-12">
                    <ScanAnimation phase={scanPhase} progress={uploadProgress} />
                    <div className="mt-12 w-full max-w-md">
                      <StatusCard phase={status.phase} message={status.message} progress={uploadProgress} />
                    </div>
                  </div>
                ) : null}
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
                        onChange={(event) => setSelectedModelVersion(event.target.value)}
                      >
                        {availableModels.map((model) => (
                          <option key={model.model_version} value={model.model_version}>
                            {formatModelLabel(model)}
                          </option>
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
                        onChange={(event) => setConfidence(parseFloat(event.target.value))}
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

      {actionNotices.length > 0 ? (
        <div className="pointer-events-none fixed right-8 top-8 z-[100] flex flex-col gap-4 max-w-sm w-full">
          {actionNotices.map((notice) => (
            <div
              key={notice.id}
              className={`p-6 rounded-2xl border backdrop-blur-3xl shadow-2xl animate-in slide-in-from-right-8 ${
                notice.tone === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-100"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-widest mb-1">{notice.title}</p>
              <p className="text-xs font-medium opacity-60 leading-relaxed uppercase">{notice.message}</p>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
