import type { RefObject, SyntheticEvent } from "react";

import { getDefectColorHex, getDefectLabel } from "@/lib/defect-visuals";
import {
  getDetectionMaskPolygonPoints,
  getDetectionOverlayStyle,
} from "@/lib/result-utils";
import type { Detection } from "@/lib/types";

interface ResultImageStageProps {
  activeCreatedAt: string;
  activePreviewUrl?: string | null;
  comparisonDetections: Detection[];
  comparisonViewMode: "master" | "comparison" | "diff";
  filteredDetectionCount: number;
  footerModelLabel: string;
  frameRef: RefObject<HTMLDivElement | null>;
  frameSize: { width: number; height: number };
  hasComparison: boolean;
  imageSize: { width: number; height: number };
  onFocusDetection: (detection: Detection) => void;
  onImageLoad: (event: SyntheticEvent<HTMLImageElement>) => void;
  prioritizedDetections: Detection[];
  selectedDetectionId: string | null;
  viewMode: "image" | "result" | "mask";
}

function formatStageTimestamp(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function ResultImageStage({
  activeCreatedAt,
  activePreviewUrl,
  comparisonDetections,
  comparisonViewMode,
  filteredDetectionCount,
  footerModelLabel,
  frameRef,
  frameSize,
  hasComparison,
  imageSize,
  onFocusDetection,
  onImageLoad,
  prioritizedDetections,
  selectedDetectionId,
  viewMode,
}: ResultImageStageProps) {
  return (
    <>
      <div className="relative z-10 min-h-[520px] flex-1 overflow-auto bg-[radial-gradient(circle_at_center,rgba(0,210,255,0.05),transparent_70%),linear-gradient(180deg,#05080A,#0B1120)] p-4 md:p-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col rounded-[1.75rem] border border-white/5 bg-[#05080A]/80 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
          <div className="relative z-20 flex items-center justify-between gap-3 border-b border-white/6 bg-[linear-gradient(to_bottom,currentColor_0%,transparent_100%)] px-4 py-2.5 text-sky-900/10">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-500/80">
              CAMERA FEED
            </span>
            <span className="shrink-0 text-[10px] font-mono text-white/40">
              {formatStageTimestamp(activeCreatedAt)} UTC
            </span>
          </div>

          <div className="flex-1 px-4 py-4">
            <div
              ref={frameRef}
              className="relative mx-auto aspect-[4/3] max-h-full w-full overflow-hidden rounded-[1.25rem] border border-white/8 bg-[#050b16] ring-1 ring-white/6 shadow-2xl"
            >
              {activePreviewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  alt="Inspection"
                  className="absolute inset-0 h-full w-full rounded-[1.25rem] object-contain opacity-90"
                  onLoad={onImageLoad}
                  src={activePreviewUrl}
                />
              ) : (
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] bg-repeat" />
              )}
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

              <div className="absolute inset-0 z-10">
                {viewMode === "image"
                  ? (() => {
                      const primaryDetections =
                        hasComparison && comparisonViewMode === "comparison" ? [] : prioritizedDetections;
                      const secondaryDetections =
                        hasComparison &&
                        (comparisonViewMode === "comparison" || comparisonViewMode === "diff")
                          ? comparisonDetections
                          : [];

                      return (
                        <>
                          {primaryDetections.map((item) => {
                            const colorCode = getDefectColorHex(item.category);
                            const isSelected = item.id === selectedDetectionId;
                            const overlayStyle = getDetectionOverlayStyle(item.bbox, imageSize, frameSize);
                            return (
                              <div
                                key={item.id}
                                className={`absolute rounded-sm group transition-all cursor-crosshair box-border hover:shadow-[0_0_15px_currentColor] ${isSelected ? "border-[3px] shadow-[0_0_18px_currentColor]" : "border-[1.5px] hover:border-[2.5px]"}`}
                                style={{ ...overlayStyle, borderColor: colorCode, color: colorCode }}
                                onClick={() => onFocusDetection(item)}
                              >
                                <span
                                  className="absolute left-0 top-0 -translate-y-[calc(100%+6px)] rounded-md border px-2 py-1 text-[10px] font-mono font-bold whitespace-nowrap shadow-md"
                                  style={{
                                    backgroundColor: colorCode,
                                    borderColor: colorCode,
                                    color: "#06131F",
                                  }}
                                >
                                  {getDefectLabel(item.category)} {(item.confidence * 100).toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                          {secondaryDetections.map((item) => {
                            const overlayStyle = getDetectionOverlayStyle(item.bbox, imageSize, frameSize);
                            return (
                              <div
                                key={`comp-${item.id}`}
                                className="absolute rounded-sm transition-all border-dashed border-[1.5px] border-emerald-400 opacity-60 hover:opacity-100 hover:border-solid"
                                style={overlayStyle}
                              >
                                <span className="absolute left-0 top-0 -translate-y-[calc(100%+6px)] rounded-md border border-emerald-500 bg-emerald-900/80 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 whitespace-nowrap">
                                  ALT: {getDefectLabel(item.category)}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()
                  : viewMode === "mask"
                    ? (
                        <>
                          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {prioritizedDetections.map((item) => {
                              const colorCode = getDefectColorHex(item.category);
                              const isSelected = item.id === selectedDetectionId;
                              const polygonPoints = getDetectionMaskPolygonPoints(item, imageSize, frameSize);
                              const bboxStyle = getDetectionOverlayStyle(item.bbox, imageSize, frameSize);
                              return polygonPoints ? (
                                <polygon
                                  key={item.id}
                                  points={polygonPoints}
                                  fill={colorCode}
                                  fillOpacity={isSelected ? "0.32" : "0.22"}
                                  stroke={colorCode}
                                  strokeOpacity={isSelected ? "1" : "0.82"}
                                  strokeWidth={isSelected ? "0.9" : "0.5"}
                                  className="cursor-crosshair"
                                  onClick={() => onFocusDetection(item)}
                                />
                              ) : (
                                <rect
                                  key={item.id}
                                  x={Number.parseFloat(bboxStyle.left)}
                                  y={Number.parseFloat(bboxStyle.top)}
                                  width={Number.parseFloat(bboxStyle.width)}
                                  height={Number.parseFloat(bboxStyle.height)}
                                  fill="none"
                                  stroke={colorCode}
                                  strokeDasharray="3 2"
                                  strokeWidth={isSelected ? "0.8" : "0.45"}
                                  className="cursor-crosshair"
                                  onClick={() => onFocusDetection(item)}
                                />
                              );
                            })}
                          </svg>
                          {prioritizedDetections.map((item) => {
                            const colorCode = getDefectColorHex(item.category);
                            const bboxStyle = getDetectionOverlayStyle(item.bbox, imageSize, frameSize);
                            return (
                              <button
                                key={`${item.id}-label`}
                                type="button"
                                className="absolute rounded-md border px-2 py-1 text-left text-[10px] font-mono font-bold whitespace-nowrap shadow-md"
                                style={{
                                  left: bboxStyle.left,
                                  top: bboxStyle.top,
                                  transform: "translateY(calc(-100% - 6px))",
                                  backgroundColor: colorCode,
                                  borderColor: colorCode,
                                  color: "#06131F",
                                }}
                                onClick={() => onFocusDetection(item)}
                              >
                                {getDefectLabel(item.category)} {(item.confidence * 100).toFixed(1)}%
                              </button>
                            );
                          })}
                        </>
                      )
                    : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 px-4 py-3 text-[11px] font-mono text-slate-500">
            <span>
              {viewMode === "result" ? "结果图视图" : viewMode === "mask" ? "掩膜图视图" : "原图视图"} /{" "}
              {filteredDetectionCount} 个病害
            </span>
            <span className="truncate text-right">{footerModelLabel}</span>
          </div>
        </div>
      </div>
    </>
  );
}
