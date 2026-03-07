"use client";

import { startTransition, useDeferredValue, useState } from "react";

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
  const [confidence, setConfidence] = useState(0.45);
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10">
        <section className="rounded-[2.5rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700">
                Bridge Defect Intelligence
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                面向无人机桥检的病害识别 MVP 前端骨架
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                当前版本优先完成单图上传、任务状态反馈、结果展示和标准协议承接，
                让评审能够直接看懂系统的输入、输出与结果可信度。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {["单图上传", "Mask 叠加", "结构化结果", "可扩展量化字段"].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <StatusCard phase={status.phase} message={status.message} />
              <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  System Notes
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <li>当前默认消费统一结果协议，不直接解析模型原始输出。</li>
                  <li>未配置后端地址时，页面会自动回退到 mock 结果，便于独立联调。</li>
                  <li>后续接入真实 overlay 图和历史任务页时，主布局无需重写。</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            onSubmit={handleSubmit}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Upload
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">上传与参数面板</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                Phase 2
              </span>
            </div>

            <label className="mt-6 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-sky-400 hover:bg-sky-50">
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
              <span className="text-lg font-semibold text-slate-950">
                {selectedFile ? selectedFile.name : "点击选择桥梁巡检图像"}
              </span>
              <span className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                支持 jpg、jpeg、png。当前骨架阶段会在未连接后端时自动使用 mock 识别结果。
              </span>
            </label>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-sm font-medium text-slate-700">置信度阈值</span>
                <input
                  className="mt-4 w-full accent-slate-950"
                  max="0.95"
                  min="0.1"
                  step="0.05"
                  type="range"
                  value={confidence}
                  onChange={(event) => setConfidence(Number(event.target.value))}
                />
                <span className="mt-2 block text-sm text-slate-500">{confidence.toFixed(2)}</span>
              </label>

              <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-sm font-medium text-slate-700">输出设置</span>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">导出叠加图</p>
                    <p className="text-sm text-slate-500">为结果页保留 overlay 链接位</p>
                  </div>
                  <button
                    aria-pressed={exportOverlay}
                    className={`relative inline-flex h-8 w-14 rounded-full transition ${
                      exportOverlay ? "bg-slate-950" : "bg-slate-300"
                    }`}
                    type="button"
                    onClick={() => setExportOverlay((value) => !value)}
                  >
                    <span
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                        exportOverlay ? "left-7" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </label>
            </div>

            <button
              className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              type="submit"
            >
              开始识别
            </button>
          </form>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Explainability
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">前端承接的统一字段</h2>
              </div>
              <a
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-slate-950 hover:text-slate-950"
                href="/results/demo"
              >
                查看 demo 结果页
              </a>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "image_id",
                "inference_ms",
                "model_version",
                "detections",
                "category",
                "confidence",
                "bbox",
                "mask",
                "metrics"
              ].map((field) => (
                <div
                  key={field}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  {field}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.75rem] bg-slate-950 p-5 text-slate-200">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                Frontend Contract
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                页面只消费标准化后的结构化结果；模型内部差异、张量对象和 Ultralytics
                原始输出都应留在后端适配层。
              </p>
            </div>
          </div>
        </section>

        {result ? (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
                <span>病害类别</span>
                <select
                  className="bg-transparent outline-none"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
                <span>最小置信度</span>
                <input
                  className="accent-slate-950"
                  max="0.95"
                  min="0"
                  step="0.05"
                  type="range"
                  value={minConfidence}
                  onChange={(event) => setMinConfidence(Number(event.target.value))}
                />
              </label>
            </div>

            <ResultDashboard
              result={result}
              categoryFilter={deferredCategoryFilter}
              minConfidence={deferredMinConfidence}
            />
          </section>
        ) : (
          <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Result Area
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-950">结果页区域已就绪</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
              一旦完成上传和推理，这里会呈现主画面、病害列表、推理信息与量化字段。
              当前你也可以先从右上角入口查看内置的 demo 结果页。
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
