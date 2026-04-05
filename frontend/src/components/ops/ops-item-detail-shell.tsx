"use client";

import { motion } from "framer-motion";
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
  const [imageSource, setImageSource] = useState<"original" | "enhanced">("original");
  const [resultSource, setResultSource] = useState<"original" | "enhanced">("original");
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
        setImageSource("original");
        setResultSource("original");
        setViewMode(resultData.overlay_uri ? "result" : "image");
      } catch (err) {
        console.warn("No result found for this item yet", err);
        setImageSource("original");
        setResultSource("original");
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
      setError("无可用识别结果进行复核。");
      return;
    }

    if (resultSource === "enhanced") {
      setError("增强结果当前仅供查看，请切回原图识别后提交复核结论。");
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
      setNotice("专家复核结论已同步至云端");
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
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400/60 animate-pulse">正在载入详情...</p>
        </div>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-black/40 backdrop-blur-3xl p-6">
        <div className="max-w-md w-full rounded-[2.5rem] border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-2xl backdrop-blur-2xl">
           <h3 className="text-xl font-black text-rose-400 uppercase tracking-tighter mb-4">载入错误</h3>
           <p className="text-sm text-rose-100/60 mb-6">{error}</p>
           <button onClick={() => window.location.reload()} className="rounded-xl bg-rose-500 px-6 py-2 text-xs font-bold text-white uppercase tracking-widest shadow-[0_8px_16px_rgba(244,63,94,0.4)]">重试</button>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const defaultReturnHref = `/dashboard/ops?batchId=${encodeURIComponent(item.batch_id)}`;
  const backHref = returnTo || defaultReturnHref;
  const primaryResult = result ? toPrimaryResult(result) : null;
  const enhancedResult = result?.secondary_result ?? null;
  const showEnhancedResult = resultSource === "enhanced" && enhancedResult;
  const showEnhancedImage = imageSource === "enhanced";
  const activeResult = showEnhancedResult ? enhancedResult : primaryResult;
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
  const enhancedUrl = result?.enhanced_path ? getEnhancedImageUrl(result.id) : null;
  const enhancedOverlayUrl = result?.enhanced_overlay_path ? getEnhancedOverlayUrl(result.id) : null;
  const activeImageUrl = showEnhancedImage
    ? (viewMode === "result" ? enhancedOverlayUrl ?? enhancedUrl : enhancedUrl ?? enhancedOverlayUrl)
    : (viewMode === "result" ? originalOverlayUrl ?? originalUrl : originalUrl ?? originalOverlayUrl);
  const activeModeLabel = showEnhancedResult ? "增强后识别" : "原图识别";
  const activeModeDescription = showEnhancedResult
    ? "基于异步图像增强管线推理"
    : "基于原始图像直接推理";
  const activeImageLabel = showEnhancedImage ? "增强后底图" : "原始底图";
  const enhancementInfo = enhancedResult?.enhancement_info ?? null;
  const reviewDisabled = isSubmitting || resultSource === "enhanced" || !result || result.detections.length === 0;

  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden bg-black/40 backdrop-blur-3xl">
      <div className="relative flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400 m-0">详情</p>
            </div>
            <h1 className="text-xl lg:text-3xl font-black tracking-tight text-white uppercase">病害详情</h1>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">
               ID: <span className="font-mono text-cyan-400/60">{item.id}</span>
            </p>
          </div>
          <Link
            href={backHref}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black text-white/50 transition-all hover:bg-white/10 hover:text-white"
          >
            返回
          </Link>
        </header>

        {notice && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[rgba(16,185,129,0.15)] px-8 py-5 text-emerald-100 backdrop-blur-3xl shadow-[0_30px_70px_rgba(0,0,0,0.6)]">
             <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-black font-black text-xs">✓</div>
             <span className="text-sm font-bold uppercase tracking-tight">{notice}</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 flex flex-col gap-6">
            <section className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] shadow-2xl backdrop-blur-3xl">
              <div className="absolute top-6 left-6 z-20 flex gap-2">
                <button
                  onClick={() => setResultSource("enhanced")}
                  disabled={!enhancedResult}
                  className={`rounded-xl border px-5 py-2 text-[10px] font-black tracking-widest transition-all ${
                    resultSource === "enhanced"
                    ? "border-cyan-500/50 bg-cyan-500/20 text-white shadow-[0_0_20px_rgba(6,182,212,0.2)]" 
                    : "border-white/10 bg-white/5 text-white/40"
                  } disabled:opacity-20`}
                >
                  增强识别
                </button>
                <button
                  onClick={() => setResultSource("original")}
                  className={`rounded-xl border px-5 py-2 text-[10px] font-black tracking-widest transition-all ${
                    resultSource === "original"
                    ? "border-white/50 bg-white/20 text-white shadow-xl" 
                    : "border-white/10 bg-white/5 text-white/40"
                  }`}
                >
                  原图识别
                </button>
              </div>
              <div className="absolute left-6 top-16 z-20 flex gap-2">
                <button
                  onClick={() => setImageSource("enhanced")}
                  disabled={!enhancedUrl}
                  className={`rounded-xl border px-5 py-2 text-[10px] font-black tracking-widest transition-all ${
                    imageSource === "enhanced"
                      ? "border-amber-500/50 bg-amber-500/20 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                      : "border-white/10 bg-white/5 text-white/40"
                  } disabled:opacity-20`}
                >
                  增强结果
                </button>
                <button
                  onClick={() => setImageSource("original")}
                  className={`rounded-xl border px-5 py-2 text-[10px] font-black tracking-widest transition-all ${
                    imageSource === "original"
                      ? "border-white/50 bg-white/20 text-white shadow-xl"
                      : "border-white/10 bg-white/5 text-white/40"
                  }`}
                >
                  原始底图
                </button>
              </div>
              <div className="absolute top-6 right-6 z-20 flex gap-2">
                <button
                  onClick={() => setViewMode("result")}
                  disabled={showEnhancedImage ? !enhancedOverlayUrl : !originalOverlayUrl}
                  className={`rounded-xl border px-4 py-2 text-[10px] font-black tracking-widest transition-all ${
                    viewMode === "result"
                      ? "border-emerald-500/50 bg-emerald-500/20 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                      : "border-white/10 bg-white/5 text-white/40"
                  } disabled:opacity-20`}
                >
                  结果
                </button>
                <button
                  onClick={() => setViewMode("image")}
                  className={`rounded-xl border px-4 py-2 text-[10px] font-black tracking-widest transition-all ${
                    viewMode === "image"
                      ? "border-white/50 bg-white/20 text-white shadow-xl"
                      : "border-white/10 bg-white/5 text-white/40"
                  }`}
                >
                  显示底图
                </button>
              </div>

               <div className="aspect-[4/3] w-full bg-black/60 overflow-hidden relative">
                {activeImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeImageUrl}
                    alt="分析视图"
                    className="h-full w-full object-contain transition-transform duration-1000 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-xs font-mono text-white/20">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    图像轨迹暂不可用
                  </div>
                )}
                <div className="absolute inset-0 pointer-events-none border border-white/5 z-10" />
              </div>
              
              <div className="p-6 bg-white/[0.03] border-t border-white/5 flex items-center justify-between backdrop-blur-xl">
                <div className="flex items-center gap-8">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">文件名</span>
                      <span className="text-xs font-mono font-bold text-white/60">{item.original_filename}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">序号</span>
                      <span className="text-xs font-mono font-bold text-white/60">BATCH_NO_{item.sequence_no}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">方式</span>
                      <span className="text-xs font-black text-white/70">{activeModeLabel}</span>
                   </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 ring-1 ring-white/5">
                   <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                   <span className="text-[10px] font-black text-emerald-400 tabular-nums tracking-widest">{viewMode === "result" ? "结果叠加视图" : "原始轨迹视图"}</span>
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
                {resultSource === "enhanced" && enhancedResult ? (
                  <p className={`mt-1 text-[10px] font-bold ${deltaCount >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                    {deltaCount >= 0 ? "增量 +" : "减量 "}{deltaCount} (相比原图)
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
                {resultSource === "enhanced" && enhancedResult ? (
                  <p className={`mt-1 text-[10px] font-bold ${deltaConfidence >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                    {deltaConfidence >= 0 ? "提升 +" : "下降 "}{(deltaConfidence * 100).toFixed(1)}%
                  </p>
                ) : null}
              </div>
            </section>
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            <section className="rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 space-y-6 shadow-2xl backdrop-blur-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 m-0 text-left">检出列表</h3>
                <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[9px] font-black text-white/30">{activeDetections.length} 项</span>
              </div>
              
              <div className="space-y-3 max-h-[440px] overflow-auto pr-2 custom-scrollbar">
                {activeDetections.map((det) => (
                  <div key={det.id} className="group/item flex items-center justify-between rounded-2xl border border-white/5 bg-black/40 p-4 transition-all hover:bg-white/[0.04]">
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
                    {det.metrics.area_mm2 && (
                       <span className="text-[10px] font-mono font-bold text-white/30 tabular-nums">{det.metrics.area_mm2.toFixed(1)} mm²</span>
                    )}
                  </div>
                ))}
                {activeDetections.length === 0 && (
                  <div className="py-20 text-center opacity-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">暂无检出数据</p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[2.5rem] border border-cyan-500/20 bg-cyan-500/[0.02] p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-3xl">
               <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-cyan-400">
                 <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                 </svg>
               </div>
               
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 m-0 text-left">复核结论</h3>
              
              <div className="space-y-6">
                <div className="flex gap-2 p-1.5 rounded-2xl bg-black/60 border border-white/5 ring-1 ring-white/5">
                  <button
                    onClick={() => setReviewAction("confirm")}
                    className={`flex-1 rounded-xl py-4 text-[11px] font-black tracking-[0.2em] transition-all ${
                      reviewAction === "confirm" 
                      ? "bg-emerald-500 text-black shadow-[0_8px_20px_rgba(16,185,129,0.3)]" 
                      : "text-white/20 hover:text-white/40"
                    }`}
                  >
                    确认病害 (CONFIRM)
                  </button>
                  <button
                    onClick={() => setReviewAction("reject")}
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
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={4}
                    placeholder="输入复核意见与备注..."
                    className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-xs font-bold text-white/80 focus:border-cyan-500/50 outline-none transition-shadow placeholder:text-white/10 ring-1 ring-white/5"
                  />
                </div>

                <button
                  onClick={handleSubmitReview}
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
          </div>
        </div>
      </div>
    </div>
  );
}
