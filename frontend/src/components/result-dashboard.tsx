import { useEffect, useRef, useState, type SyntheticEvent } from "react";

import { AdaptiveImage } from "@/components/adaptive-image";
import {
  filterDetections,
  getDetectionOverlayStyle,
  getDetectionSummary
} from "@/lib/result-utils";
import type { Detection, PredictionResult } from "@/lib/types";

interface ResultDashboardProps {
  result: PredictionResult;
  categoryFilter: string;
  minConfidence: number;
  previewUrl?: string | null;
  overlayPreviewUrl?: string | null;
  viewMode: "image" | "overlay";
  onViewModeChange: (mode: "image" | "overlay") => void;
  onExportJson: () => void;
  onExportOverlay: () => void;
  overlayDisabled: boolean;
  selectedDetectionId: string | null;
  onSelectDetection: (detection: Detection) => void;
  onOpenHistory: () => void;
  onReset: () => void;
  onRerun: () => void;
  rerunDisabled: boolean;
}

function getCategoryColor(category: string) {
  const norm = category.toLowerCase();
  if (norm.includes("crack") || norm.includes("裂缝")) return "border-[#FF4D4D] bg-[#FF4D4D]/10 text-[#FF4D4D]";
  if (norm.includes("spalling") || norm.includes("剥落")) return "border-[#FFC107] bg-[#FFC107]/10 text-[#FFC107]";
  if (norm.includes("efflo") || norm.includes("泛碱")) return "border-[#00D2FF] bg-[#00D2FF]/10 text-[#00D2FF]";
  return "border-emerald-400 bg-emerald-400/10 text-emerald-400";
}

export function ResultDashboard({
  result,
  categoryFilter,
  minConfidence,
  previewUrl,
  overlayPreviewUrl,
  viewMode,
  onViewModeChange,
  onExportJson,
  onExportOverlay,
  overlayDisabled,
  selectedDetectionId,
  onSelectDetection,
  onOpenHistory,
  onReset,
  onRerun,
  rerunDisabled
}: ResultDashboardProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const filteredDetections = filterDetections(
    result.detections,
    categoryFilter,
    minConfidence
  );
  const averageConfidence = filteredDetections.length
    ? (
      filteredDetections.reduce((sum, item) => sum + item.confidence, 0) /
      filteredDetections.length *
      100
    ).toFixed(1)
    : "--";
  const activePreviewUrl =
    viewMode === "overlay" && overlayPreviewUrl ? overlayPreviewUrl : previewUrl;
  const current =
    filteredDetections.find((item) => item.id === selectedDetectionId) ??
    filteredDetections[0] ??
    null;

  useEffect(() => {
    const node = frameRef.current;
    if (!node) {
      return;
    }

    const updateFrameSize = () => {
      const rect = node.getBoundingClientRect();
      setFrameSize({
        width: rect.width,
        height: rect.height
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
      height: target.naturalHeight
    });
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full">
      {/* 图像监控主界面区 */}
      <div className="flex-1 rounded-[1.5rem] border border-white/10 bg-[#1E293B]/70 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col xl:col-span-2 min-h-[500px]">
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0B1120]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-xs font-mono text-slate-300">实时结果 / {result.image_id}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-md border border-white/10 bg-black/20 p-1">
              <button
                aria-pressed={viewMode === "image"}
                className={`h-7 rounded px-3 text-xs font-semibold transition-colors ${
                  viewMode === "image"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5"
                }`}
                type="button"
                onClick={() => onViewModeChange("image")}
              >
                查看原图
              </button>
              <button
                aria-label="查看叠加图"
                aria-pressed={viewMode === "overlay"}
                className={`h-7 rounded px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  viewMode === "overlay"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5"
                }`}
                disabled={overlayDisabled}
                title={overlayDisabled ? "当前结果没有可切换的叠加图" : "切换到叠加图"}
                type="button"
                onClick={() => onViewModeChange("overlay")}
              >
                查看叠加图
              </button>
            </div>
            <button
              className="h-8 rounded-md border border-white/10 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
              type="button"
              onClick={onOpenHistory}
            >
              历史记录
            </button>
            <button
              className="h-8 rounded-md border border-white/10 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
              type="button"
              onClick={onReset}
            >
              更换图片
            </button>
            <button
              className="h-8 rounded-md border border-white/10 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={rerunDisabled}
              title={rerunDisabled ? "历史记录无法直接重跑，请重新上传原图后再分析" : "使用当前本地图片重新分析"}
              type="button"
              onClick={onRerun}
            >
              重新分析
            </button>
            <button
              aria-label="导出 JSON"
              className="h-8 rounded-md border border-white/10 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
              type="button"
              onClick={onExportJson}
            >
              JSON
            </button>
            <button
              aria-label="导出叠加图"
              className="h-8 rounded-md border border-white/10 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={overlayDisabled}
              title={overlayDisabled ? "当前结果没有可导出的 overlay 文件" : "导出叠加图"}
              type="button"
              onClick={onExportOverlay}
            >
              叠加图
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.03),transparent_70%),linear-gradient(180deg,#0B1120,#0F172A)] relative p-6 flex items-center justify-center overflow-auto">
          {/* 画布主内容 - 带框图展示 */}
          <div
            ref={frameRef}
            className="relative max-h-full max-w-full rounded-lg ring-1 ring-white/10 shadow-2xl inline-block bg-[#0B1120] pb-[56.25%] w-full"
          >
            {/* 实际图传底图或占位 SVG */}
            {activePreviewUrl ? (
              <AdaptiveImage
                alt="Inspection"
                className="rounded-lg object-contain opacity-90"
                onLoad={handleImageLoad}
                sizes="(min-width: 1280px) 70vw, 100vw"
                src={activePreviewUrl}
              />
            ) : (
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] bg-repeat" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

            <div className="absolute inset-0 z-10">
              {filteredDetections.map((item) => {
                const colorCls = getCategoryColor(item.category);
                const isSelected = item.id === selectedDetectionId;
                const overlayStyle = getDetectionOverlayStyle(
                  item.bbox,
                  imageSize,
                  frameSize
                );
                return (
                  <div
                    key={item.id}
                    className={`absolute rounded-sm group transition-all cursor-crosshair box-border hover:shadow-[0_0_15px_currentColor] ${isSelected ? "border-[3px] shadow-[0_0_18px_currentColor]" : "border-[1.5px] hover:border-[2.5px]"} ${colorCls}`}
                    style={{
                      ...overlayStyle,
                      backgroundColor: "transparent"
                    }}
                    onClick={() => onSelectDetection(item)}
                  >
                    <div className="absolute inset-0 bg-current opacity-10 group-hover:opacity-20 transition-opacity" />
                    <span className="absolute -top-[21px] left-[-1.5px] px-1.5 py-0.5 text-[10px] font-mono font-bold bg-current text-[#0B1120] whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity shadow-sm">
                      {item.category.toUpperCase()} {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="absolute bottom-4 left-6 right-6 flex justify-between text-[10px] font-mono text-slate-500 pointer-events-none">
            <span>{viewMode === "overlay" ? "叠加图视图" : "原图视图"} / {filteredDetections.length} 个病害</span>
            <span>{new Date().toISOString().split("T")[1].slice(0, 8)} UTC</span>
          </div>
        </div>
      </div>

      {/* 病害详情列表 - 嵌入主画布右侧作为辅助，或者在窄屏时下放 */}
      <aside className="w-full xl:w-96 shrink-0 flex flex-col gap-6">
        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 p-5 shadow-lg backdrop-blur shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-2">结果摘要</p>
          <h3 className="text-xl text-slate-100 font-light tracking-tight">{getDetectionSummary(result)}</h3>
          <p className="mt-3 text-sm text-slate-400">
            {activePreviewUrl
              ? `当前正在查看${viewMode === "overlay" ? "叠加图" : "原图"}，可继续筛选、导出或重新分析。`
              : "当前为历史记录回看模式，已恢复结构化结果和病害详情。"}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">病害总数</div>
              <div className="text-xl font-mono text-white">{filteredDetections.length}</div>
            </div>
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">平均置信度</div>
              <div className="text-xl font-mono text-sky-400">
                {averageConfidence === "--" ? "--" : `${averageConfidence}%`}
              </div>
            </div>
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">推理耗时</div>
              <div className="text-xl font-mono text-white">{result.inference_ms}ms</div>
            </div>
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">当前视图</div>
              <div className="text-xl font-medium text-white">
                {viewMode === "overlay" ? "叠加图" : "原图"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 shadow-lg backdrop-blur flex-1 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">病害列表</p>
            <span className="font-mono text-xs text-slate-400">{filteredDetections.length} 项</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredDetections.map((item, index) => {
              const colorCls = getCategoryColor(item.category);
              const colorCode = colorCls.match(/text-\[(.*?)\]/)?.[1] || "#10B981";
              const isSelected = item.id === selectedDetectionId;

              return (
                <article
                  key={item.id}
                  className={`rounded-xl border p-3 transition-colors group cursor-pointer ${isSelected ? "border-sky-500/40 bg-sky-500/[0.08]" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}
                  onClick={() => onSelectDetection(item)}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">{String(index + 1).padStart(2, '0')}.</span>
                      <h4 className="text-sm font-medium text-slate-200 uppercase">{item.category}</h4>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded border border-white/10" style={{ color: colorCode }}>
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 truncate w-10">Id</span>
                      <span className="font-mono text-slate-300 truncate" title={item.id}>{item.id.split('-')[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-10">Size</span>
                      <span className="font-mono text-slate-300">
                        {item.metrics.length_mm ? `${(item.metrics.length_mm / 10).toFixed(1)}cm` : "--"}
                      </span>
                    </div>
                    <div className="flex gap-2 col-span-2">
                      <span className="text-slate-500 w-10">Area</span>
                      <span className="font-mono text-slate-300">
                        {item.metrics.area_mm2 ? `${(item.metrics.area_mm2 / 100).toFixed(1)}cm²` : "--"}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredDetections.length === 0 && (
              <div className="h-32 flex items-center justify-center text-sm text-slate-500 font-mono">
                [ NO DATA MATCHES FILTERS, TRY LOWER CONFIDENCE ]
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 p-5 shadow-lg backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            当前病害详情
          </p>
          {filteredDetections.length > 0 ? (
            current ? (
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">病害类型</span>
                    <span className="font-medium text-white">{current.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">置信度</span>
                    <span className="font-mono text-sky-400">
                      {(current.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">边界框</span>
                    <span className="font-mono text-xs text-slate-300">
                      {Math.round(current.bbox.width)} x {Math.round(current.bbox.height)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">长度</span>
                    <span className="font-mono text-xs text-slate-300">
                      {current.metrics.length_mm
                        ? `${(current.metrics.length_mm / 10).toFixed(1)} cm`
                        : "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">面积</span>
                    <span className="font-mono text-xs text-slate-300">
                      {current.metrics.area_mm2
                        ? `${(current.metrics.area_mm2 / 100).toFixed(1)} cm²`
                      : "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">检测编号</span>
                    <span className="font-mono text-xs text-slate-300">{current.id}</span>
                  </div>
                </div>
              ) : null
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              当前筛选条件下没有病害结果，建议降低置信度阈值或切回“全部”类别。
            </p>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 p-5 shadow-lg backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            下一步建议
          </p>
          {result.detections.length === 0 ? (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>本次未检出病害，建议先降低置信度阈值后重新分析当前图片。</p>
              <p className="text-slate-400">
                如果这是历史记录，也可以切回历史列表，改看其他样本的结果差异。
              </p>
            </div>
          ) : filteredDetections.length === 0 ? (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>当前筛选条件把结果全部过滤掉了，可以降低阈值或切回“全部”。</p>
              <p className="text-slate-400">
                右侧筛选器会实时生效，不需要重新上传图片。
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>你可以继续导出结果、切换到历史记录，或更换图片重新分析。</p>
              <p className="text-slate-400">
                当前选中的病害已在图像和列表中同步高亮，适合用于答辩演示和人工复核。
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
