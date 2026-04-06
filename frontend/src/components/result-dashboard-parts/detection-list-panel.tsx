import type { MutableRefObject } from "react";

import { formatDetectionSourceLabel } from "@/lib/model-labels";
import { getDefectColorHex, getDefectLabel } from "@/lib/defect-visuals";
import type { Detection } from "@/lib/types";

interface DetectionListPanelProps {
  detections: Detection[];
  selectedDetectionId: string | null;
  topPriorityDetectionId?: string | null;
  detectionItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  onFocusDetection: (detection: Detection) => void;
}

export function DetectionListPanel({
  detections,
  selectedDetectionId,
  topPriorityDetectionId = null,
  detectionItemRefs,
  onFocusDetection,
}: DetectionListPanelProps) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[#05080A]/60 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/5 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
          病害列表
        </p>
        <span className="font-mono text-xs text-slate-400" data-testid="detection-count">
          {detections.length} 项
        </span>
      </div>

      <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
        {detections.map((item, index) => {
          const colorCode = getDefectColorHex(item.category);
          const isSelected = item.id === selectedDetectionId;
          const isHighestPriority = item.id === topPriorityDetectionId;

          return (
            <article
              key={item.id}
              ref={(node) => {
                detectionItemRefs.current[item.id] = node;
              }}
              className={`group cursor-pointer rounded-xl border p-3 transition-colors ${
                isSelected ? "border-sky-500/40 bg-sky-500/[0.08]" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
              data-detection-id={item.id}
              onClick={() => onFocusDetection(item)}
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">
                    {String(index + 1).padStart(2, "0")}.
                  </span>
                  <h4 className="text-sm font-medium uppercase text-slate-200">
                    {getDefectLabel(item.category)}
                  </h4>
                  {isHighestPriority ? (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                      优先查看
                    </span>
                  ) : null}
                  {formatDetectionSourceLabel(item.source_role) ? (
                    <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                      {formatDetectionSourceLabel(item.source_role)}
                    </span>
                  ) : null}
                </div>
                <span
                  className="rounded border border-white/10 px-2 py-0.5 text-xs font-mono"
                  style={{ color: colorCode }}
                >
                  {(item.confidence * 100).toFixed(1)}%
                </span>
              </div>

              <div className="grid max-h-0 grid-cols-2 gap-y-2 overflow-hidden text-xs opacity-0 transition-all duration-300 group-hover:mt-3 group-hover:max-h-24 group-hover:opacity-100">
                <div className="flex items-center gap-2">
                  <span className="w-10 text-slate-500">Size</span>
                  <span className="font-mono text-slate-300">
                    {item.metrics.length_mm ? `${(item.metrics.length_mm / 10).toFixed(1)}cm` : "--"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-10 text-slate-500">Area</span>
                  <span className="font-mono text-slate-300">
                    {item.metrics.area_mm2 ? `${(item.metrics.area_mm2 / 100).toFixed(1)}cm²` : "--"}
                  </span>
                </div>
              </div>
            </article>
          );
        })}

        {detections.length === 0 ? (
          <div className="flex h-32 items-center justify-center font-mono text-sm text-slate-500">
            [ NO DATA MATCHES FILTERS, TRY LOWER CONFIDENCE ]
          </div>
        ) : null}
      </div>
    </div>
  );
}
