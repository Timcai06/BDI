"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardRightRail } from "@/components/dashboard-right-rail";
import { ResultDashboard } from "@/components/result-dashboard";
import { getDefectLabel } from "@/lib/defect-visuals";
import { formatModelLabel } from "@/lib/model-labels";
import {
  getOverlayDownloadUrl,
  getResult,
  getResultImageFile,
  getResultImageUrl,
  listModels,
  predictImage,
} from "@/lib/predict-client";
import type { ModelCatalogItem, PredictState, PredictionResult } from "@/lib/types";

const DEFAULT_CONFIDENCE = 0.45;
const DEFAULT_PIXELS_PER_MM = 10.0;

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadRemoteFile(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.click();
}

interface HistoryDetailShellProps {
  imageId: string;
}

export function HistoryDetailShell({ imageId }: HistoryDetailShellProps) {
  const router = useRouter();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<PredictionResult | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelCatalogItem[]>([]);
  const [compareModelVersion, setCompareModelVersion] = useState<string | null>(null);
  const [compareStatus, setCompareStatus] = useState<PredictState>({
    phase: "idle",
    message: "可对当前历史记录执行模型对比。",
  });
  const [status, setStatus] = useState<PredictState>({
    phase: "running",
    message: `正在加载 ${imageId} 的历史详情。`,
  });
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [minConfidence, setMinConfidence] = useState(0.3);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"image" | "result" | "mask">("image");

  const deferredCategoryFilter = useDeferredValue(categoryFilter);
  const deferredMinConfidence = useDeferredValue(minConfidence);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      try {
        const nextResult = await getResult(imageId);
        if (cancelled) return;
        startTransition(() => {
          setResult(nextResult);
          setSelectedDetectionId(nextResult.detections[0]?.id ?? null);
          setCategoryFilter("全部");
          setViewMode("image");
          setComparisonResult(null);
        });
        setStatus({
          phase: "success",
          message: `已载入 ${imageId} 的历史识别结果。`,
        });
      } catch (error) {
        if (cancelled) return;
        setStatus({
          phase: "error",
          message: error instanceof Error ? error.message : "历史详情加载失败。",
        });
      }
    }

    async function loadModels() {
      try {
        const catalog = await listModels();
        if (cancelled) return;
        setAvailableModels(catalog.items);
        setCompareModelVersion((current) => {
          if (current) return current;
          const fallback = catalog.items.find((item) => item.is_available);
          return fallback?.model_version ?? null;
        });
      } catch {
        if (!cancelled) {
          setAvailableModels([]);
        }
      }
    }

    void Promise.all([loadDetail(), loadModels()]);

    return () => {
      cancelled = true;
    };
  }, [imageId]);

  const categories = result
    ? ["全部", ...new Set(result.detections.map((item) => getDefectLabel(item.category)))]
    : ["全部"];
  const compareOptions = useMemo(
    () =>
      availableModels
        .filter((model) => model.model_version !== result?.model_version)
        .map((model) => ({
          value: model.model_version,
          label: `${formatModelLabel(model)} · ${model.backend}${model.is_active ? " · active" : ""}${!model.is_available ? " (环境未就绪)" : ""}`,
          disabled: !model.is_available,
        })),
    [availableModels, result?.model_version],
  );

  async function handleRunComparison() {
    if (!result) return;
    if (!compareModelVersion) {
      setCompareStatus({
        phase: "error",
        message: "请先选择一个用于对比的模型版本。",
      });
      return;
    }

    setCompareStatus({
      phase: "running",
      message: `正在使用 ${compareModelVersion} 对同一张历史图片执行二次推理。`,
    });

    try {
      const sourceFile = await getResultImageFile(result.image_id);
      const nextComparison = await predictImage(sourceFile, {
        confidence: DEFAULT_CONFIDENCE,
        exportOverlay: true,
        modelVersion: compareModelVersion,
        pixelsPerMm: DEFAULT_PIXELS_PER_MM,
      });
      setComparisonResult(nextComparison);
      setCompareStatus({
        phase: "success",
        message: `对比完成：${formatModelLabel(result)} vs ${formatModelLabel(nextComparison)}。`,
      });
    } catch (error) {
      setCompareStatus({
        phase: "error",
        message: error instanceof Error ? error.message : "模型对比失败。",
      });
    }
  }

  function handleExportJson() {
    if (!result) return;
    downloadTextFile(
      `${result.image_id}.json`,
      JSON.stringify(result, null, 2),
      "application/json",
    );
    setStatus({
      phase: "success",
      message: `已导出 ${result.image_id} 的 JSON 结果。`,
    });
  }

  function handleExportOverlay() {
    if (!result) return;
    const overlayUrl = getOverlayDownloadUrl(result.image_id);
    if (!overlayUrl) {
      setStatus({
        phase: "error",
        message: "当前结果没有可导出的结果图产物。",
      });
      return;
    }

    downloadRemoteFile(overlayUrl, `${result.image_id}-overlay.png`);
    setStatus({
      phase: "success",
      message: `已触发 ${result.image_id} 的结果图导出。`,
    });
  }

  if (!result && status.phase === "running") {
    return (
      <section className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        <div className="flex-1 overflow-y-auto p-6 relative">
          <div className="mx-auto max-w-[1800px] lg:px-2">
            <div className="rounded-2xl border border-white/6 bg-white/[0.025] px-6 py-5 text-white/60">
              {status.message}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        <div className="flex-1 overflow-y-auto p-6 relative">
          <div className="mx-auto max-w-[1800px] lg:px-2">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-rose-100">
              {status.message}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
    <section className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
      <div className="flex-1 overflow-y-auto p-6 relative" style={{ scrollbarGutter: 'stable' }}>
        <div className="mx-auto flex min-h-full max-w-[1800px] flex-col lg:px-2">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-500">
              Dashboard / History / Detail
            </p>
            <h1 className="mt-2 text-2xl font-light tracking-[0.04em] text-white">
              历史记录详情
            </h1>
            <p className="mt-2 text-sm text-white/40">
              当前查看的是独立历史详情页，不再回跳到主页工作台。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/history"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              返回历史列表
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition-colors hover:bg-sky-500/20"
            >
              返回工作台
            </Link>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-3 text-sm text-white/55">
          {status.message}
        </div>

        <ResultDashboard
          result={result}
          comparisonResult={comparisonResult}
          compareStatus={compareStatus}
          compareModelVersion={compareModelVersion}
          compareOptions={compareOptions}
          categoryFilter={deferredCategoryFilter}
          minConfidence={deferredMinConfidence}
          previewUrl={getResultImageUrl(result.image_id)}
          overlayPreviewUrl={getOverlayDownloadUrl(result.image_id) ?? result.artifacts.overlay_path ?? null}
          comparisonPreviewUrl={comparisonResult ? getResultImageUrl(comparisonResult.image_id) : null}
          comparisonOverlayPreviewUrl={
            comparisonResult
              ? getOverlayDownloadUrl(comparisonResult.image_id) ??
                comparisonResult.artifacts.overlay_path ??
                null
              : null
          }
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onExportJson={handleExportJson}
          onExportOverlay={handleExportOverlay}
          resultDisabled={!result.artifacts.overlay_path}
          maskDisabled={!result.has_masks}
          selectedDetectionId={selectedDetectionId}
          onSelectDetection={(detection) => setSelectedDetectionId(detection.id)}
          onOpenHistory={() => router.push("/dashboard/history")}
          onReset={() => router.push("/dashboard")}
          onRerun={() => router.push("/dashboard")}
          onCompareModelVersionChange={setCompareModelVersion}
          onRunComparison={() => {
            void handleRunComparison();
          }}
          onClearComparison={() => {
            setComparisonResult(null);
            setCompareStatus({
              phase: "idle",
              message: "已清除对比结果，你可以重新选择一个模型版本再次比较。",
            });
          }}
          rerunDisabled
          compareDisabled={compareOptions.length === 0}
          status={status}
          onCategoryFilterChange={setCategoryFilter}
          onMinConfidenceChange={setMinConfidence}
          categories={categories}
        />
      </div>
      </div>
    </section>
    <DashboardRightRail
      eyebrow="History / Detail"
      title="记录摘要"
      description="右侧摘要保留当前历史记录的核心指标，进入详情页后仍然维持控制台式的信息密度。"
      sections={[
        {
          title: "当前文件",
          value: result.image_id,
          hint: formatModelLabel(result),
          tone: "sky",
        },
        {
          title: "病害结果",
          value: `${result.detections.length} 处`,
          hint: result.has_masks ? `包含 ${result.mask_detection_count} 处掩膜。` : "当前记录仅返回边界框。",
          tone: result.has_masks ? "emerald" : "amber",
        },
        {
          title: "页面状态",
          value: status.phase.toUpperCase(),
          hint: status.message,
        },
      ]}
    />
    </>
  );
}
