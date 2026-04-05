"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  createV1Review,
  getEnhancedImageUrl,
  getResultImageUrl,
  getV1BatchItemDetail,
  getV1BatchItemResult,
  listV1Detections,
} from "@/lib/predict-client";
import type { BatchItemDetailV1Response, DetectionRecordV1, BatchItemResultV1Response } from "@/lib/types";

interface Props {
  batchItemId?: string;
  itemId?: string;
}

export function OpsItemDetailShell({ batchItemId, itemId }: Props) {
  const searchParams = useSearchParams();
  const resolvedItemId = batchItemId ?? itemId ?? "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [item, setItem] = useState<BatchItemDetailV1Response | null>(null);
  const [result, setResult] = useState<BatchItemResultV1Response | null>(null);
  const [detections, setDetections] = useState<DetectionRecordV1[]>([]);

  // UI States
  const [showEnhanced, setShowEnhanced] = useState(true);
  const [reviewAction, setReviewAction] = useState<"confirm" | "reject">("confirm");
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnTo = searchParams.get("returnTo");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [itemData, detData] = await Promise.all([
        getV1BatchItemDetail(resolvedItemId),
        listV1Detections({ batchItemId: resolvedItemId, limit: 100, offset: 0 })
      ]);
      setItem(itemData);
      setDetections(detData.items);
      
      // Try fetching result details for enhanced image path
      try {
        const resultData = await getV1BatchItemResult(resolvedItemId);
        setResult(resultData);
        if (!resultData.secondary_result) {
          setShowEnhanced(false);
        }
      } catch (err) {
        console.warn("No result found for this item yet", err);
        setShowEnhanced(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片详情载入失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedItemId]);

  async function handleSubmitReview() {
    // We need a detection ID to submit a review in this API
    // If no specific detection is selected, we might need a different approach or default to first if exists
    if (detections.length === 0) {
      setError("No detections available to review.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      await createV1Review({
        detectionId: detections[0].id, // Default to first for bulk action/general item review
        reviewAction: reviewAction,
        reviewer: "ops-expert",
        reviewNote: reviewNote
      });
      setNotice("复核结论已同步至云端");
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "复核提交失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading && !item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-black/40 backdrop-blur-3xl">
        <div className="flex flex-col items-center gap-6">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 animate-ping rounded-full bg-cyan-500/20" />
            <div className="flex h-16 w-16 animate-spin items-center justify-center rounded-full border-t-2 border-cyan-500 border-r-2 border-transparent" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400/60 animate-pulse">Initializing Analysis Lab...</p>
        </div>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-black/40 backdrop-blur-3xl p-6">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-2xl">
           <h3 className="text-xl font-black text-rose-400 uppercase tracking-tighter mb-4">CRITICAL_SYSTEM_ERROR</h3>
           <p className="text-sm text-rose-100/60 mb-6">{error}</p>
           <button onClick={() => window.location.reload()} className="rounded-xl bg-rose-500 px-6 py-2 text-xs font-bold text-white uppercase tracking-widest">Retry Hardware Logic</button>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const defaultReturnHref = `/dashboard/ops?batchId=${encodeURIComponent(item.batch_id)}`;
  const backHref = returnTo || defaultReturnHref;
  const originalUrl = result ? getResultImageUrl(result.id) : null;
  const enhancedUrl =
    result && result.secondary_result ? getEnhancedImageUrl(result.id) : null;
  const activeImageUrl = showEnhanced && enhancedUrl ? enhancedUrl : originalUrl;

  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden bg-black/40 backdrop-blur-3xl">
      <div className="relative flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400 m-0">ANALYSIS LAB</p>
            </div>
            <h1 className="text-xl lg:text-3xl font-black tracking-tight text-white uppercase">单图深度诊断</h1>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">
               ITEM_ID: <span className="font-mono">{item.id}</span> / <span className="text-emerald-200/40">SLA SECURE</span>
            </p>
          </div>
          <Link
            href={backHref}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            返回批次工作台
          </Link>
        </header>

        {notice && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[rgba(16,185,129,0.15)] px-8 py-5 text-emerald-100 backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-6 shadow-[0_30px_70px_rgba(0,0,0,0.6)]">
             <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-black font-black text-xs">✓</div>
             <span className="text-sm font-bold uppercase tracking-tight">{notice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 flex flex-col gap-6">
            <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-2xl">
              <div className="absolute top-4 left-4 z-20 flex gap-2">
                <button
                  onClick={() => setShowEnhanced(true)}
                  disabled={!enhancedUrl}
                  className={`rounded-lg border px-4 py-1.5 text-[10px] font-black tracking-widest transition-all ${
                    showEnhanced 
                    ? "border-cyan-500/50 bg-cyan-500/20 text-white shadow-[0_0_20px_rgba(6,182,212,0.2)]" 
                    : "border-white/10 bg-white/5 text-white/40"
                  } disabled:opacity-40`}
                >
                  ENHANCED_V2
                </button>
                <button
                  onClick={() => setShowEnhanced(false)}
                  className={`rounded-lg border px-4 py-1.5 text-[10px] font-black tracking-widest transition-all ${
                    !showEnhanced 
                    ? "border-white/50 bg-white/20 text-white" 
                    : "border-white/10 bg-white/5 text-white/40"
                  }`}
                >
                  ORIGINAL_RAW
                </button>
              </div>

               <div className="aspect-[4/3] w-full bg-black/40 overflow-hidden relative group">
                {activeImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeImageUrl}
                    alt="analysis view"
                    className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-mono text-white/30">
                    RESULT IMAGE UNAVAILABLE
                  </div>
                )}
                <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 z-10" />
              </div>
              
              <div className="p-4 bg-white/[0.03] border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-6">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">ORIGINAL_FILENAME</span>
                      <span className="text-xs font-mono text-white/60">{item.original_filename}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">SEQUENCE</span>
                      <span className="text-xs font-mono text-white/60">NO_{item.sequence_no}</span>
                   </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10">
                   <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-mono text-emerald-400">CLOUD_READY</span>
                </div>
              </div>
            </section>
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:p-8 space-y-6 shadow-2xl">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 m-0">识别诊断 / NEURAL_OUTPUTS</h3>
              
              <div className="space-y-4 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
                {detections.map((det) => (
                  <div key={det.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.03]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-[9px] font-black text-cyan-400 border border-cyan-500/20">
                        {(det.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white uppercase tracking-tight">{det.category}</p>
                        <p className="text-[9px] font-mono text-white/20">VAL: {String(det.is_valid)}</p>
                      </div>
                    </div>
                    {det.area_mm2 && (
                       <span className="text-[10px] font-mono text-white/40">{det.area_mm2.toFixed(1)} mm²</span>
                    )}
                  </div>
                ))}
                {detections.length === 0 && (
                  <div className="py-12 text-center opacity-20">
                    <p className="text-[10px] font-black uppercase tracking-widest">No anomalies verified</p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.02] p-6 lg:p-8 space-y-6 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                 <svg className="w-16 h-16 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                 </svg>
               </div>
               
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 m-0">专家复核 / EXPERT ATTESTATION</h3>
              
              <div className="space-y-4">
                <div className="flex gap-2 p-1 rounded-xl bg-black/40 border border-white/5">
                  <button
                    onClick={() => setReviewAction("confirm")}
                    className={`flex-1 rounded-lg py-3 text-[11px] font-black tracking-widest transition-all ${
                      reviewAction === "confirm" 
                      ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
                      : "text-white/20 hover:text-white/40"
                    }`}
                  >
                    CONFIRM_SIG
                  </button>
                  <button
                    onClick={() => setReviewAction("reject")}
                    className={`flex-1 rounded-lg py-3 text-[11px] font-black tracking-widest transition-all ${
                      reviewAction === "reject" 
                      ? "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]" 
                      : "text-white/20 hover:text-white/40"
                    }`}
                  >
                    REJECT_SIG
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">ATTESTATION_NOTES</label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={4}
                    placeholder="Enter diagnostic logic..."
                    className="w-full rounded-xl border border-white/10 bg-black/60 p-4 text-xs font-medium text-white/80 focus:border-cyan-500/50 outline-none transition-shadow placeholder:text-white/10"
                  />
                </div>

                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmitting}
                  className={`w-full rounded-xl py-4 text-xs font-black tracking-[0.3em] uppercase transition-all active:scale-[0.98] ${
                    isSubmitting
                      ? "bg-white/5 text-white/20"
                      : "bg-white/10 text-white hover:bg-white/20 shadow-xl"
                  }`}
                >
                  {isSubmitting ? "COMMIT_PENDING..." : "COMMIT_ATTESTATION"}
                </button>

                <div className="flex items-center justify-center gap-4 text-[9px] font-mono text-white/10 uppercase tracking-[0.2em] py-2">
                   <span>AUTHENTICITY_VERIFIED</span>
                   <span className="h-1 w-1 rounded-full bg-white/20" />
                   <span>SECURE_PIPE_ENABLED</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
