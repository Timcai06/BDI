"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  enhanceResultImage,
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
import { OpsItemDetailSidebar } from "./ops-item-detail-sidebar";
import { OpsItemDetailStage } from "./ops-item-detail-stage";

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
  const [overlayMode, setOverlayMode] = useState<"none" | "bbox" | "mask">("bbox");
  const [hoveredDetectionId, setHoveredDetectionId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"confirm" | "reject">("confirm");
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enhancementPending, setEnhancementPending] = useState(false);
  const returnTo = searchParams.get("returnTo");

  async function loadBatchItemResultWithRetry(
    batchItemIdToLoad: string,
    maxAttempts: number = 30,
    retryDelayMs: number = 2_000,
  ): Promise<BatchItemResultV1Response | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await getV1BatchItemResult(batchItemIdToLoad);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        const missingResult =
          message.includes("Result does not exist") ||
          message.includes("图片识别结果加载失败") ||
          message.includes("结果不存在");

        if (!missingResult) {
          throw err;
        }

        if (attempt === maxAttempts - 1) {
          return null;
        }

        await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
      }
    }

    return null;
  }

  function toPrimaryResult(resultData: BatchItemResultV1Response): PredictResponse {
    const normalizeInferenceBreakdown = (
      value: BatchItemResultV1Response["inference_breakdown"],
    ): Record<string, number> => {
      if (!value || typeof value !== "object") {
        return {};
      }

      return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
      );
    };

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

    const normalizeBoundingBox = (bbox: ResultDetectionV1["bbox"]) => ({
      x: typeof bbox?.x === "number" ? bbox.x : 0,
      y: typeof bbox?.y === "number" ? bbox.y : 0,
      width: typeof bbox?.width === "number" ? bbox.width : 0,
      height: typeof bbox?.height === "number" ? bbox.height : 0,
    });

    const normalizeMetrics = (metrics: ResultDetectionV1["metrics"]) => ({
      length_mm: typeof metrics?.length_mm === "number" ? metrics.length_mm : null,
      width_mm: typeof metrics?.width_mm === "number" ? metrics.width_mm : null,
      area_mm2: typeof metrics?.area_mm2 === "number" ? metrics.area_mm2 : null,
    });

    return {
      schema_version: resultData.schema_version,
      image_id: resultData.id,
      result_variant: "original",
      inference_ms: resultData.inference_ms,
      inference_breakdown: normalizeInferenceBreakdown(resultData.inference_breakdown),
      model_name: resultData.model_name,
      model_version: resultData.model_version,
      backend: resultData.backend,
      inference_mode: resultData.inference_mode,
      detections: (resultData.detections ?? []).map((det) => ({
        id: det.id,
        category: det.category,
        confidence: det.confidence,
        bbox: normalizeBoundingBox(det.bbox),
        mask: normalizeMask(det.mask),
        metrics: normalizeMetrics(det.metrics),
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
        const resultData = await loadBatchItemResultWithRetry(resolvedItemId);
        if (resultData) {
          setResult(resultData);
          setImageSource("original");
          setResultSource("original");
          setOverlayMode(resultData.detections.length > 0 ? "bbox" : "none");
        } else {
          setResult(null);
          setImageSource("original");
          setResultSource("original");
          setOverlayMode("none");
        }
      } catch (err) {
        void err;
        setResult(null);
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

  async function handleEnhancementAction() {
    if (!result) {
      return;
    }

    if (enhancedResult) {
      setResultSource((current) => (current === "enhanced" ? "original" : "enhanced"));
      return;
    }

    if (enhancementPending) {
      return;
    }

    setEnhancementPending(true);
    setError(null);
    setNotice(null);

    try {
      const enhancedPayload = await enhanceResultImage({
        imageId: result.id,
        requestedBy: "ops-detail",
        reason: "manual-enhancement",
      });
      setResult((current) => (current ? {
        ...current,
        enhanced_path: enhancedPayload.artifacts.enhanced_path ?? current.enhanced_path,
        enhanced_overlay_path: enhancedPayload.artifacts.enhanced_overlay_path ?? current.enhanced_overlay_path,
        secondary_result: enhancedPayload.secondary_result ?? current.secondary_result,
      } : current));
      setResultSource("enhanced");
      setNotice("增强识别结果已生成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "增强结果生成失败");
    } finally {
      setEnhancementPending(false);
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
  const enhancedUrl = result?.enhanced_path ? getEnhancedImageUrl(result.id) : null;
  const activeImageUrl = showEnhancedImage ? enhancedUrl ?? originalUrl : originalUrl;
  const activeModeLabel = showEnhancedResult ? "增强后识别" : "原图识别";
  const activeModeDescription = showEnhancedResult
    ? "基于异步图像增强管线推理"
    : "基于原始图像直接推理";
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
            <OpsItemDetailStage
              activeDetections={activeDetections}
              activeImageUrl={activeImageUrl}
              activeModeDescription={activeModeDescription}
              activeModeLabel={activeModeLabel}
              activeSummary={activeSummary}
              deltaConfidence={deltaConfidence}
              deltaCount={deltaCount}
              enhancedResultAvailable={Boolean(enhancedResult)}
              enhancedUrlAvailable={Boolean(enhancedUrl)}
              enhancementPending={enhancementPending}
              hoveredDetectionId={hoveredDetectionId}
              imageSource={imageSource}
              itemOriginalFilename={item.original_filename ?? item.id}
              onEnhancementAction={() => {
                void handleEnhancementAction();
              }}
              onHoveredDetectionIdChange={setHoveredDetectionId}
              onImageSourceChange={setImageSource}
              onOverlayModeChange={setOverlayMode}
              overlayMode={overlayMode}
              resultSource={resultSource}
              sequenceNo={item.sequence_no}
            />
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            <OpsItemDetailSidebar
              activeDetections={activeDetections}
              hoveredDetectionId={hoveredDetectionId}
              isSubmitting={isSubmitting}
              onHoveredDetectionIdChange={setHoveredDetectionId}
              onReviewActionChange={setReviewAction}
              onReviewNoteChange={setReviewNote}
              onSubmitReview={handleSubmitReview}
              resultSource={resultSource}
              reviewAction={reviewAction}
              reviewDisabled={reviewDisabled}
              reviewNote={reviewNote}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
