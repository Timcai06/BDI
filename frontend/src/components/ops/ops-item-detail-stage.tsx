"use client";

import { motion } from "framer-motion";

import { getDefectColorHex } from "@/lib/defect-visuals";
import type { DetectionMask, PredictResponse, ResultDetectionV1 } from "@/lib/types";

type DetailDetection = ResultDetectionV1 | PredictResponse["detections"][number];

interface OpsItemDetailStageProps {
  activeDetections: DetailDetection[];
  activeImageUrl: string | null;
  activeModeDescription: string;
  activeModeLabel: string;
  activeSummary: {
    count: number;
    categories: number;
    averageConfidence: number;
  } | null;
  deltaConfidence: number;
  deltaCount: number;
  enhancedResultAvailable: boolean;
  enhancedUrlAvailable: boolean;
  enhancementPending: boolean;
  hoveredDetectionId: string | null;
  imageSource: "original" | "enhanced";
  itemOriginalFilename: string;
  onEnhancementAction: () => void;
  onHoveredDetectionIdChange: (value: string | null) => void;
  onImageSourceChange: (value: "original" | "enhanced") => void;
  onOverlayModeChange: (value: "none" | "bbox" | "mask") => void;
  overlayMode: "none" | "bbox" | "mask";
  resultSource: "original" | "enhanced";
  sequenceNo: number;
}

function normalizeMask(mask: ResultDetectionV1["mask"] | PredictResponse["detections"][number]["mask"]): DetectionMask | null {
  if (mask && mask.format === "polygon" && Array.isArray(mask.points)) {
    return mask as DetectionMask;
  }
  return null;
}

export function OpsItemDetailStage({
  activeDetections,
  activeImageUrl,
  activeModeDescription,
  activeModeLabel,
  activeSummary,
  deltaConfidence,
  deltaCount,
  enhancedResultAvailable,
  enhancedUrlAvailable,
  enhancementPending,
  hoveredDetectionId,
  imageSource,
  itemOriginalFilename,
  onEnhancementAction,
  onHoveredDetectionIdChange,
  onImageSourceChange,
  onOverlayModeChange,
  overlayMode,
  resultSource,
  sequenceNo,
}: OpsItemDetailStageProps) {
  return (
    <>
      <section className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] shadow-2xl backdrop-blur-3xl">
        <div className="absolute top-6 left-6 z-30 flex gap-2">
          <button
            onClick={onEnhancementAction}
            disabled={enhancementPending}
            className={`rounded-xl border px-5 py-2 text-[10px] font-black tracking-widest transition-all ${
              enhancedResultAvailable
                ? resultSource === "enhanced"
                  ? "border-cyan-500/50 bg-cyan-500/20 text-white shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                  : "border-white/10 bg-white/5 text-white/70"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            } disabled:opacity-40`}
          >
            {enhancementPending ? "增强中..." : enhancedResultAvailable ? (resultSource === "enhanced" ? "回看原图" : "查看增强") : "增强"}
          </button>
        </div>
        <div className="absolute left-6 top-16 z-30 flex gap-2">
          <button
            onClick={() => onImageSourceChange("enhanced")}
            disabled={!enhancedUrlAvailable}
            className={`rounded-xl border px-5 py-2 text-[10px] font-black tracking-widest transition-all ${
              imageSource === "enhanced"
                ? "border-amber-500/50 bg-amber-500/20 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                : "border-white/10 bg-white/5 text-white/40"
            } disabled:opacity-20`}
          >
            增强底图
          </button>
          <button
            onClick={() => onImageSourceChange("original")}
            className={`rounded-xl border px-5 py-2 text-[10px] font-black tracking-widest transition-all ${
              imageSource === "original"
                ? "border-white/50 bg-white/20 text-white shadow-xl"
                : "border-white/10 bg-white/5 text-white/40"
            }`}
          >
            原始底图
          </button>
        </div>
        <div className="absolute top-6 right-6 z-30 flex flex-wrap justify-end gap-2 max-w-[50%]">
          <button
            onClick={() => onOverlayModeChange("mask")}
            className={`rounded-xl border px-4 py-2 text-[10px] font-black tracking-widest transition-all ${
              overlayMode === "mask"
                ? "border-rose-500/50 bg-rose-500/20 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                : "border-white/10 bg-white/5 text-white/40"
            }`}
          >
            掩膜图
          </button>
          <button
            onClick={() => onOverlayModeChange("bbox")}
            className={`rounded-xl border px-4 py-2 text-[10px] font-black tracking-widest transition-all ${
              overlayMode === "bbox"
                ? "border-cyan-500/50 bg-cyan-500/20 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                : "border-white/10 bg-white/5 text-white/40"
            }`}
          >
            识别框图
          </button>
          <button
            onClick={() => onOverlayModeChange("none")}
            className={`rounded-xl border px-4 py-2 text-[10px] font-black tracking-widest transition-all ${
              overlayMode === "none"
                ? "border-white/50 bg-white/20 text-white shadow-xl"
                : "border-white/10 bg-white/5 text-white/40"
            }`}
          >
            无识别
          </button>
        </div>

        <div className="aspect-[4/3] w-full overflow-hidden bg-black/60 relative">
          {activeImageUrl ? (
            <div className="relative h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeImageUrl} alt="分析视图" className="h-full w-full object-contain pointer-events-none" />

              {overlayMode !== "none" ? (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full z-20 pointer-events-none">
                  <defs>
                    <pattern id="scan-pattern" x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="2" y2="2" stroke="white" strokeWidth="0.1" opacity="0.3" />
                      <line x1="2" y1="0" x2="0" y2="2" stroke="white" strokeWidth="0.1" opacity="0.1" />
                    </pattern>
                  </defs>

                  {activeDetections.map((det) => {
                    const isHovered = hoveredDetectionId === det.id;
                    const color = getDefectColorHex(det.category);
                    const polygonMask = normalizeMask(det.mask);
                    const polygonPoints = polygonMask?.points?.map((point) => point.join(",")).join(" ") ?? "";

                    return (
                      <motion.g
                        key={det.id}
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: isHovered || !hoveredDetectionId ? 1 : 0.2,
                          scale: isHovered ? 1.005 : 1,
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        {(overlayMode === "bbox" || overlayMode === "mask") ? (
                          <motion.rect
                            x={det.bbox.x}
                            y={det.bbox.y}
                            width={det.bbox.width}
                            height={det.bbox.height}
                            fill="none"
                            stroke={color}
                            strokeWidth={isHovered ? "0.8" : "0.5"}
                            strokeDasharray={isHovered ? "none" : "2 1"}
                            className="transition-all duration-300"
                          />
                        ) : null}

                        {overlayMode === "mask" && polygonMask ? (
                          <motion.g>
                            <polygon
                              points={polygonPoints}
                              fill="url(#scan-pattern)"
                              style={{ fillOpacity: isHovered ? 0.6 : 0.3 }}
                              className="transition-opacity duration-300"
                            />
                            <polygon
                              points={polygonPoints}
                              fill={color}
                              fillOpacity={isHovered ? 0.3 : 0.15}
                              stroke={color}
                              strokeWidth={isHovered ? "0.3" : "0.2"}
                              className="transition-opacity duration-300"
                            />
                            {isHovered || det.confidence > 0.95 ? (
                              <motion.foreignObject
                                x={det.bbox.x}
                                y={det.bbox.y - 4}
                                width={20}
                                height={6}
                                initial={{ y: det.bbox.y }}
                                animate={{ y: det.bbox.y - 4 }}
                              >
                                <div
                                  className="flex items-center gap-1 rounded-[2px] px-1 py-0.5 text-[2px] font-black uppercase text-white shadow-lg backdrop-blur-sm"
                                  style={{ backgroundColor: `${color}CC` }}
                                >
                                  <span className="truncate">{det.category}</span>
                                  <span className="opacity-60">{(det.confidence * 100).toFixed(0)}%</span>
                                </div>
                              </motion.foreignObject>
                            ) : null}
                          </motion.g>
                        ) : null}
                      </motion.g>
                    );
                  })}
                </svg>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-xs font-mono text-white/20">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              图像轨道暂不可用
            </div>
          )}
          <div className="absolute inset-0 pointer-events-none border border-white/5 z-10" />
        </div>

        <div className="p-6 bg-white/[0.03] border-t border-white/5 flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-8 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">文件名</span>
              <span className="text-xs font-mono font-bold text-white/60 truncate">{itemOriginalFilename}</span>
            </div>
            <div className="flex flex-col shrink-0">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">序号</span>
              <span className="text-xs font-mono font-bold text-white/60">BATCH_NO_{sequenceNo}</span>
            </div>
            <div className="flex flex-col shrink-0">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">模式</span>
              <span className="text-xs font-black text-white/70">{activeModeLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 ring-1 ring-white/5 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black text-emerald-400 tabular-nums tracking-widest">
              {overlayMode === "bbox" ? "识别框视图" : overlayMode === "mask" ? "掩膜视图" : "原始底图"}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="group rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 backdrop-blur-3xl transition-all hover:border-white/20">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">推理模式</p>
          <p className="mt-2 text-base font-black text-white">{activeModeLabel}</p>
          <p className="mt-1 text-[10px] font-medium text-white/40">{activeModeDescription}</p>
        </div>
        <div className="group rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 backdrop-blur-3xl transition-all hover:border-white/20">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">检出病害</p>
          <p className="mt-2 text-2xl font-black text-white tabular-nums">{activeSummary?.count ?? 0}</p>
          {resultSource === "enhanced" && enhancedResultAvailable ? (
            <p className={`mt-1 text-[10px] font-bold ${deltaCount >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
              {deltaCount >= 0 ? "增量 +" : "减量 "}
              {deltaCount} (相比原图)
            </p>
          ) : null}
        </div>
        <div className="group rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 backdrop-blur-3xl transition-all hover:border-white/20">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">算法覆盖</p>
          <p className="mt-2 text-2xl font-black text-white tabular-nums">{activeSummary?.categories ?? 0}</p>
          <p className="mt-1 text-[10px] font-medium text-white/40">独立病害标签数</p>
        </div>
        <div className="group rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 backdrop-blur-3xl transition-all hover:border-white/20">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">平均置信度</p>
          <p className="mt-2 text-2xl font-black text-white tabular-nums">
            {((activeSummary?.averageConfidence ?? 0) * 100).toFixed(1)}%
          </p>
          {resultSource === "enhanced" && enhancedResultAvailable ? (
            <p className={`mt-1 text-[10px] font-bold ${deltaConfidence >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
              {deltaConfidence >= 0 ? "提升 +" : "下降 "}
              {(deltaConfidence * 100).toFixed(1)}%
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
