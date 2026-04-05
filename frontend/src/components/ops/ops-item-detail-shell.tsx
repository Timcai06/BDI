"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  createV1Review,
  getEnhancedOverlayUrl,
  getEnhancedImageUrl,
  getOverlayDownloadUrl,
  getResultImageUrl,
  getV1BatchItemDetail,
  getV1BatchItemResult,
} from "@/lib/predict-client";
import type {
  BatchItemDetailV1Response,
  BatchItemResultV1Response,
  DetectionMask,
  PredictResponse,
  ResultDetectionV1,
} from "@/lib/types";

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

  // UI States
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [viewMode, setViewMode] = useState<"image" | "result">("result");
  const [reviewAction, setReviewAction] = useState<"confirm" | "reject">("confirm");
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnTo = searchParams.get("returnTo");

  function toPrimaryResult(resultData: BatchItemResultV1Response): PredictResponse {
    const normalizeMask = (mask: ResultDetectionV1["mask"]): DetectionMask | null | undefined => {
      if (
        mask &&
        typeof mask === "object" &&
        "format" in mask &&
        "points" in mask &&
        mask.format === "polygon" &&
        Array.isArray(mask.points)
      ) {
        return mask as unknown as DetectionMask;
      }
      return undefined;
    };

    return {
      schema_version: resultData.schema_version,
      image_id: resultData.id,
      result_variant: "original",
      inference_ms: resultData.inference_ms,
      inference_breakdown: resultData.inference_breakdown,
      model_name: resultData.model_name,
      model_version: resultData.model_version,
      backend: resultData.backend,
      inference_mode: resultData.inference_mode,
      detections: resultData.detections.map((det) => ({
        id: det.id,
        category: det.category,
        confidence: det.confidence,
        bbox: det.bbox,
        mask: normalizeMask(det.mask),
        metrics: det.metrics,
        source_role: det.source_role,
        source_model_name: det.source_model_name,
        source_model_version: det.source_model_version,
      })),
      has_masks: resultData.has_masks,
      mask_detection_count: resultData.mask_detection_count,
      artifacts: {
        upload_path: "",
        json_path: resultData.json_uri ?? "",
        overlay_path: resultData.overlay_uri ?? null,
        enhanced_path: resultData.enhanced_path ?? null,
        enhanced_overlay_path: resultData.enhanced_overlay_path ?? null,
      },
      created_at: resultData.created_at,
      secondary_result: resultData.secondary_result ?? null,
    };
  }

  function summarizeDetections(detectionItems: ResultDetectionV1[] | PredictResponse["detections"]) {
    const totalConfidence = detectionItems.reduce((sum, det) => sum + det.confidence, 0);
    const categories = new Set(detectionItems.map((det) => det.category));
    return {
      count: detectionItems.length,
      categories: categories.size,
      averageConfidence: detectionItems.length > 0 ? totalConfidence / detectionItems.length : 0,
    };
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const itemData = await getV1BatchItemDetail(resolvedItemId);
      setItem(itemData);
      
      try {
        const resultData = await getV1BatchItemResult(resolvedItemId);
        setResult(resultData);
        setShowEnhanced(false);
        setViewMode(resultData.overlay_uri ? "result" : "image");
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
    if (!result || result.detections.length === 0) {
      setError("No primary detections available to review.");
      return;
    }

    if (showEnhanced) {
      setError("增强结果当前仅供查看，请切回原图识别后提交复核。");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      await createV1Review({
        detectionId: result.detections[0].id,
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
  const primaryResult = result ? toPrimaryResult(result) : null;
  const enhancedResult = result?.secondary_result ?? null;
  const activeResult = showEnhanced && enhancedResult ? enhancedResult : primaryResult;
  const activeDetections = activeResult?.detections ?? [];
  const primarySummary = result ? summarizeDetections(result.detections) : null;
  const activeSummary = activeResult ? summarizeDetections(activeDetections) : null;
  const deltaCount = enhancedResult && primarySummary ? enhancedResult.detections.length - primarySummary.count : 0;
  const deltaConfidence =
    enhancedResult && primarySummary
      ? summarizeDetections(enhancedResult.detections).averageConfidence - primarySummary.averageConfidence
      : 0;
  const originalUrl = result ? getResultImageUrl(result.id) : null;
  const originalOverlayUrl = result ? getOverlayDownloadUrl(result.id) : null;
  const enhancedUrl = result && enhancedResult ? getEnhancedImageUrl(result.id) : null;
  const enhancedOverlayUrl = result && enhancedResult ? getEnhancedOverlayUrl(result.id) : null;
  const activeImageUrl = showEnhanced
    ? (viewMode === "result" ? enhancedOverlayUrl ?? enhancedUrl : enhancedUrl ?? enhancedOverlayUrl)
    : (viewMode === "result" ? originalOverlayUrl ?? originalUrl : originalUrl ?? originalOverlayUrl);
  const activeModeLabel = showEnhanced ? "增强后识别" : "原图识别";
  const activeModeDescription = showEnhanced
    ? "基于 Img_Enhance 低照度增强图像推理"
    : "基于原始图像推理";
  const enhancementInfo = enhancedResult?.enhancement_info ?? null;
  const reviewDisabled = isSubmitting || showEnhanced || !result || result.detections.length === 0;

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
                  disabled={!enhancedResult}
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
              <div className="absolute top-4 right-4 z-20 flex gap-2">
                <button
                  onClick={() => setViewMode("result")}
                  disabled={showEnhanced ? !enhancedOverlayUrl : !originalOverlayUrl}
                  className={`rounded-lg border px-3 py-1.5 text-[10px] font-black tracking-widest transition-all ${
                    viewMode === "result"
                      ? "border-emerald-500/50 bg-emerald-500/20 text-white"
                      : "border-white/10 bg-white/5 text-white/40"
                  } disabled:opacity-40`}
                >
                  结果图
                </button>
                <button
                  onClick={() => setViewMode("image")}
                  className={`rounded-lg border px-3 py-1.5 text-[10px] font-black tracking-widest transition-all ${
                    viewMode === "image"
                      ? "border-white/50 bg-white/20 text-white"
                      : "border-white/10 bg-white/5 text-white/40"
                  }`}
                >
                  原图
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
                   <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">RESULT_SOURCE</span>
                      <span className="text-xs font-semibold text-white/70">{activeModeLabel}</span>
                   </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10">
                   <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-mono text-emerald-400">{viewMode === "result" ? "RESULT_VIEW" : "SOURCE_VIEW"}</span>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">结果来源</p>
                <p className="mt-2 text-sm font-black text-white">{activeModeLabel}</p>
                <p className="mt-1 text-xs text-white/45">{activeModeDescription}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">病害数量</p>
                <p className="mt-2 text-sm font-black text-white">{activeSummary?.count ?? 0}</p>
                {showEnhanced && enhancedResult ? (
                  <p className={`mt-1 text-xs ${deltaCount >= 0 ? "text-emerald-300/70" : "text-rose-300/70"}`}>
                    {deltaCount >= 0 ? "+" : ""}{deltaCount} 相比原图
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">类别覆盖</p>
                <p className="mt-2 text-sm font-black text-white">{activeSummary?.categories ?? 0}</p>
                <p className="mt-1 text-xs text-white/45">独立病害类别数</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">平均置信度</p>
                <p className="mt-2 text-sm font-black text-white">
                  {((activeSummary?.averageConfidence ?? 0) * 100).toFixed(1)}%
                </p>
                {showEnhanced && enhancedResult ? (
                  <p className={`mt-1 text-xs ${deltaConfidence >= 0 ? "text-emerald-300/70" : "text-rose-300/70"}`}>
                    {deltaConfidence >= 0 ? "+" : ""}{(deltaConfidence * 100).toFixed(1)}% 相比原图
                  </p>
                ) : null}
              </div>
            </section>

            {showEnhanced && enhancementInfo ? (
              <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Enhancement Provenance</p>
                <p className="mt-2 text-sm text-white/80">
                  {enhancementInfo.algorithm} / {enhancementInfo.pipeline}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  revised: {enhancementInfo.revised_weights ?? "n/a"} | bridge: {enhancementInfo.bridge_weights ?? "n/a"}
                </p>
              </section>
            ) : null}
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:p-8 space-y-6 shadow-2xl">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 m-0">识别诊断 / NEURAL_OUTPUTS</h3>
              
              <div className="space-y-4 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
                {activeDetections.map((det) => (
                  <div key={det.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.03]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-[9px] font-black text-cyan-400 border border-cyan-500/20">
                        {(det.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white uppercase tracking-tight">{det.category}</p>
                        <p className="text-[9px] font-mono text-white/20">
                          {showEnhanced ? "SOURCE: ENHANCED" : "SOURCE: ORIGINAL"}
                        </p>
                      </div>
                    </div>
                    {det.metrics.area_mm2 && (
                       <span className="text-[10px] font-mono text-white/40">{det.metrics.area_mm2.toFixed(1)} mm²</span>
                    )}
                  </div>
                ))}
                {activeDetections.length === 0 && (
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
                  disabled={reviewDisabled}
                  className={`w-full rounded-xl py-4 text-xs font-black tracking-[0.3em] uppercase transition-all active:scale-[0.98] ${
                    reviewDisabled
                      ? "bg-white/5 text-white/20"
                      : "bg-white/10 text-white hover:bg-white/20 shadow-xl"
                  }`}
                >
                  {showEnhanced ? "SWITCH_TO_ORIGINAL_TO_REVIEW" : isSubmitting ? "COMMIT_PENDING..." : "COMMIT_ATTESTATION"}
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
