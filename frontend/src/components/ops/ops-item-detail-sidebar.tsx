"use client";

import type { PredictResponse, ResultDetectionV1 } from "@/lib/types";

type DetailDetection = ResultDetectionV1 | PredictResponse["detections"][number];

interface OpsItemDetailSidebarProps {
  activeDetections: DetailDetection[];
  hoveredDetectionId: string | null;
  isSubmitting: boolean;
  onHoveredDetectionIdChange: (value: string | null) => void;
  onReviewActionChange: (value: "confirm" | "reject") => void;
  onReviewNoteChange: (value: string) => void;
  onSubmitReview: () => void;
  resultSource: "original" | "enhanced";
  reviewAction: "confirm" | "reject";
  reviewDisabled: boolean;
  reviewNote: string;
}

export function OpsItemDetailSidebar({
  activeDetections,
  hoveredDetectionId,
  isSubmitting,
  onHoveredDetectionIdChange,
  onReviewActionChange,
  onReviewNoteChange,
  onSubmitReview,
  resultSource,
  reviewAction,
  reviewDisabled,
  reviewNote,
}: OpsItemDetailSidebarProps) {
  return (
    <>
      <section className="rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 space-y-6 shadow-2xl backdrop-blur-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 m-0 text-left">检出列表</h3>
          <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[9px] font-black text-white/30">{activeDetections.length} 项</span>
        </div>

        <div className="space-y-3 max-h-[440px] overflow-auto pr-2 custom-scrollbar">
          {activeDetections.map((det) => (
            <div
              key={det.id}
              onMouseEnter={() => onHoveredDetectionIdChange(det.id)}
              onMouseLeave={() => onHoveredDetectionIdChange(null)}
              className={`group/item flex items-center justify-between rounded-2xl border transition-all hover:bg-white/[0.04] p-4 ${
                hoveredDetectionId === det.id ? "border-cyan-500/40 bg-white/[0.06]" : "border-white/5 bg-black/40"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-[10px] font-black text-cyan-400 border border-cyan-500/20 tabular-nums">
                  {(det.confidence * 100).toFixed(0)}%
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-black text-white uppercase tracking-tight">{det.category}</p>
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                    {resultSource === "enhanced" ? "ASSET: ENH_LAYER" : "ASSET: RAW_LAYER"}
                  </p>
                </div>
              </div>
              {typeof det.metrics?.area_mm2 === "number" ? (
                <span className="text-[10px] font-mono font-bold text-white/30 tabular-nums">{det.metrics.area_mm2.toFixed(1)} mm²</span>
              ) : null}
            </div>
          ))}
          {activeDetections.length === 0 ? (
            <div className="py-20 text-center opacity-10">
              <p className="text-[10px] font-black uppercase tracking-[0.4em]">暂无检出数据</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[2.5rem] border border-cyan-500/20 bg-cyan-500/[0.02] p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-3xl">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-cyan-400">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        </div>

        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 m-0 text-left">复核结论</h3>

        <div className="space-y-6">
          <div className="flex gap-2 p-1.5 rounded-2xl bg-black/60 border border-white/5 ring-1 ring-white/5">
            <button
              onClick={() => onReviewActionChange("confirm")}
              className={`flex-1 rounded-xl py-4 text-[11px] font-black tracking-[0.2em] transition-all ${
                reviewAction === "confirm"
                  ? "bg-emerald-500 text-black shadow-[0_8px_20px_rgba(16,185,129,0.3)]"
                  : "text-white/20 hover:text-white/40"
              }`}
            >
              确认病害 (CONFIRM)
            </button>
            <button
              onClick={() => onReviewActionChange("reject")}
              className={`flex-1 rounded-xl py-4 text-[11px] font-black tracking-[0.2em] transition-all ${
                reviewAction === "reject"
                  ? "bg-rose-500 text-white shadow-[0_8px_20px_rgba(244,63,94,0.3)]"
                  : "text-white/20 hover:text-white/40"
              }`}
            >
              误报
            </button>
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/20 px-2">复核意见</label>
            <textarea
              value={reviewNote}
              onChange={(event) => onReviewNoteChange(event.target.value)}
              rows={4}
              placeholder="输入复核意见与备注..."
              className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-xs font-bold text-white/80 focus:border-cyan-500/50 outline-none transition-shadow placeholder:text-white/10 ring-1 ring-white/5"
            />
          </div>

          <button
            onClick={onSubmitReview}
            disabled={reviewDisabled}
            className={`w-full rounded-2xl py-5 text-xs font-black tracking-[0.3em] uppercase transition-all active:scale-[0.98] ${
              reviewDisabled
                ? "bg-white/5 text-white/10"
                : "bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_12px_24px_rgba(6,182,212,0.3)]"
            }`}
          >
            {resultSource === "enhanced" ? "请切回原图提交" : isSubmitting ? "正在同步..." : "提交复核"}
          </button>

          <div className="flex items-center justify-center gap-4 text-[9px] font-black text-white/10 uppercase tracking-[0.2em] py-2">
            <span>AUTHENTICITY_VERIFIED</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>SECURE_PIPE_ENABLED</span>
          </div>
        </div>
      </section>
    </>
  );
}
