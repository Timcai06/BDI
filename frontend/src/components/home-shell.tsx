"use client";

import { startTransition, useDeferredValue, useState, useEffect } from "react";

import { ResultDashboard } from "@/components/result-dashboard";
import { StatusCard } from "@/components/status-card";
import { predictImage } from "@/lib/predict-client";
import type { PredictState, PredictionResult } from "@/lib/types";

const initialState: PredictState = {
  phase: "idle",
  message: "选择一张桥梁巡检图像后，即可触发单图识别与结果展示。"
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function HomeShell() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0.45);

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
  const [status, setStatus] = useState<PredictState>(initialState);
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [minConfidence, setMinConfidence] = useState(0.3);

  const deferredCategoryFilter = useDeferredValue(categoryFilter);
  const deferredMinConfidence = useDeferredValue(minConfidence);

  const categories = result
    ? ["全部", ...new Set(result.detections.map((item) => item.category))]
    : ["全部"];

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
      });

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

        <nav className="flex-1 py-6 px-3 flex flex-col gap-2">
          {["Dashboard", "Projects", "Scans", "Settings"].map((item, idx) => (
            <button
              key={item}
              className={`flex items-center gap-4 px-3 py-2.5 rounded-lg transition-colors ${idx === 0
                  ? "bg-white/10 text-sky-400 font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
            >
              <div className="shrink-0 h-5 w-5 bg-current opacity-70 mask-icon" />
              <span className="hidden lg:block text-sm">{item}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* 主视图区 (图传/回放/上传) */}
      <section className="flex-1 flex flex-col min-w-0 bg-[#0F172A]/50 relative">
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-[#0B1120]/80 backdrop-blur">
          <h1 className="text-lg font-medium text-slate-100">
            {result ? result.image_id : "Bridge Defect Identification MVP"}
          </h1>
          <div className="flex items-center gap-4">
            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-slate-400">
              Phase 2
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarGutter: 'stable' }}>
          {!result ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="w-full max-w-2xl">
                <form
                  className="rounded-[2rem] border border-white/10 bg-[#1E293B]/60 p-8 shadow-2xl backdrop-blur-xl"
                  onSubmit={handleSubmit}
                >
                  <div className="text-center mb-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500 mb-2">
                      Upload
                    </p>
                    <h2 className="text-3xl font-light tracking-tight text-white mb-4">上传巡检图像</h2>
                    <p className="text-slate-400 text-sm">
                      支持 jpg、jpeg、png。当前骨架阶段会在未连接后端时自动使用 mock识别结果。
                    </p>
                  </div>

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

                    {/* 本地图片预览图层 */}
                    {previewUrl && (
                      <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 transition-opacity group-hover:opacity-20"
                        style={{ backgroundImage: `url(${previewUrl})` }}
                      />
                    )}

                    {/* 扫描线动画 (上传后/推理中显示) */}
                    {(status.phase === "uploading" || status.phase === "running") && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="w-full h-[2px] bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                        <div className="absolute inset-0 bg-gradient-to-b from-sky-500/5 to-transparent animate-[scan_2s_ease-in-out_infinite]" style={{ height: '30%' }} />
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
                      {/* Hidden actual input for a11y, using onClick on label handles it usually but doing it explicitly here */}
                      <input type="checkbox" className="hidden" checked={exportOverlay} onChange={() => setExportOverlay(!exportOverlay)} />
                    </label>
                  </div>

                  <div className="mt-8">
                    <button
                      className="w-full relative overflow-hidden rounded-xl bg-sky-500/10 border border-sky-500/50 px-6 py-4 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500 hover:text-white"
                      disabled={status.phase === "uploading" || status.phase === "running"}
                      type="submit"
                    >
                      {status.phase === "idle" || status.phase === "error" ? "开始执行 AI 识别" : "推理中..."}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="h-full">
              <ResultDashboard
                result={result}
                categoryFilter={deferredCategoryFilter}
                minConfidence={deferredMinConfidence}
                previewUrl={previewUrl}
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

