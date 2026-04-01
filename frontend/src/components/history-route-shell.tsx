"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardRightRail } from "@/components/dashboard-right-rail";
import { HistoryPanel } from "@/components/history";
import { getCanonicalCategoryOptions, getDefectLabel } from "@/lib/defect-visuals";
import { type HistorySortMode } from "@/lib/history-utils";
import {
  batchDeleteResults,
  batchExportResults,
  deleteResult,
  getOverlayDownloadUrl,
  getResultImageUrl,
  listAllResults,
} from "@/lib/predict-client";
import type { PredictState, PredictionHistoryItem } from "@/lib/types";

const initialStatus: PredictState = {
  phase: "idle",
  message: "查看、筛选并打开历史识别结果。",
};

function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function HistoryRouteShell() {
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<PredictionHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("全部");
  const [historySortMode, setHistorySortMode] = useState<HistorySortMode>("newest");
  const [status, setStatus] = useState<PredictState>(initialStatus);

  const availableHistoryCategories = useMemo(
    () =>
      getCanonicalCategoryOptions().filter((category) =>
        historyItems.some((item) =>
          item.categories.some((value) => getDefectLabel(value) === category),
        ),
      ),
    [historyItems],
  );

  const getHistoryPreviewUrl = useCallback(
    (item: PredictionHistoryItem) =>
      item.artifacts.overlay_path
        ? getOverlayDownloadUrl(item.image_id) ?? item.artifacts.overlay_path ?? null
        : getResultImageUrl(item.image_id),
    [],
  );

  const loadHistory = useCallback(
    async ({ silent = false, forceFresh = false }: { silent?: boolean; forceFresh?: boolean } = {}) => {
      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const history = await listAllResults(forceFresh);
        setHistoryItems(history.items);
        setHistoryTotal(history.total);
        if (!silent) {
          setStatus({
            phase: "success",
            message: `历史结果已刷新，当前共 ${history.total} 条记录。`,
          });
        }
        return history;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "历史结果读取失败，请稍后重试。";
        setHistoryError(message);
        setStatus({
          phase: "error",
          message,
        });
        return null;
      } finally {
        setHistoryLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadHistory({ silent: true });
  }, [loadHistory]);

  async function handleDeleteHistory(imageId: string) {
    try {
      setDeletingImageId(imageId);
      await deleteResult(imageId);
      setHistoryItems((current) => current.filter((item) => item.image_id !== imageId));
      setDeleteSuccessMessage(`记录 ${imageId} 已被移除。`);
      setStatus({
        phase: "success",
        message: `已删除 ${imageId} 的分析记录。`,
      });
      await loadHistory({ silent: true, forceFresh: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "删除记录失败，请稍后重试。";
      setStatus({
        phase: "error",
        message,
      });
    } finally {
      setDeletingImageId(null);
    }
  }

  async function handleBatchDeleteHistory(imageIds: string[]) {
    if (imageIds.length === 0) return;

    setDeletingImageId("batch");
    setDeleteSuccessMessage(null);

    try {
      const response = await batchDeleteResults(imageIds);
      const deletedIds = response.results
        .filter((item) => item.deleted)
        .map((item) => item.image_id);

      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setHistoryItems((current) => current.filter((item) => !deletedSet.has(item.image_id)));
        setDeleteSuccessMessage(`已删除 ${deletedIds.length} 条记录。`);
      }

      await loadHistory({ silent: true, forceFresh: true });
      setStatus({
        phase: response.failed_count > 0 ? "error" : "success",
        message:
          response.failed_count > 0
            ? `批量删除部分失败：成功 ${response.deleted_count} 条，失败 ${response.failed_count} 条。`
            : `批量删除完成：成功 ${response.deleted_count} 条。`,
      });
    } finally {
      setDeletingImageId(null);
    }
  }

  async function handleBatchExportHistory(imageIds: string[], assetType: "json" | "overlay") {
    const exportLabel = assetType === "json" ? "JSON" : "结果图";
    const { blob, filename } = await batchExportResults(imageIds, assetType);
    downloadBlobFile(blob, filename);
    setStatus({
      phase: "success",
      message: `已开始导出 ${imageIds.length} 条历史记录的${exportLabel}压缩包。`,
    });
  }

  return (
      <>
      <section className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        <div className="flex-1 overflow-y-auto p-6 relative" style={{ scrollbarGutter: 'stable' }}>
          <div className="mx-auto flex min-h-full max-w-[1800px] flex-col lg:px-2">
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-500">
              Dashboard / History
            </p>
            <h1 className="mt-2 text-2xl font-light tracking-[0.04em] text-white">
              历史识别结果
            </h1>
            <p className="mt-2 text-sm text-white/40">
              这是独立的历史记录目录。点击卡片将进入对应的历史详情页。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/ops"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              返回批次中心
            </Link>
            <button
              type="button"
              onClick={() => router.push("/dashboard/lab-single")}
              className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition-colors hover:bg-sky-500/20"
            >
              单图实验台
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-3 text-sm text-white/55">
          {status.message}
        </div>

        <div className="min-h-0 flex-1">
          <HistoryPanel
            items={historyItems}
            totalCount={historyTotal}
            loading={historyLoading}
            errorMessage={historyError}
            deletingImageId={deletingImageId}
            deleteSuccessMessage={deleteSuccessMessage}
            searchQuery={historySearchQuery}
            categoryFilter={historyCategoryFilter}
            sortMode={historySortMode}
            availableCategories={availableHistoryCategories}
            getImageUrl={getHistoryPreviewUrl}
            onDeleteRequest={(imageId) => {
              void handleDeleteHistory(imageId);
            }}
            onBatchDelete={handleBatchDeleteHistory}
            onBatchExportJson={(imageIds) => handleBatchExportHistory(imageIds, "json")}
            onBatchExportOverlay={(imageIds) => handleBatchExportHistory(imageIds, "overlay")}
            onSearchQueryChange={setHistorySearchQuery}
            onCategoryFilterChange={setHistoryCategoryFilter}
            onSortModeChange={setHistorySortMode}
            onOpenUploader={() => router.push("/dashboard/lab-single")}
            onRefresh={() => {
              void loadHistory();
            }}
            onSelect={(imageId) => {
              router.push(`/dashboard/history/${encodeURIComponent(imageId)}`);
            }}
          />
        </div>
          </div>
        </div>
      </section>
      <DashboardRightRail
        eyebrow="History / Summary"
        title="列表状态"
        description="历史记录页的右侧保留筛选后的整体状态，避免进入列表后控制台骨架消失。"
        sections={[
          {
            title: "总记录数",
            value: `${historyTotal} 条`,
            hint: "当前历史目录内的全部识别结果。",
            tone: "sky",
          },
          {
            title: "病害类别",
            value: `${availableHistoryCategories.length} 类`,
            hint: "按标准六类病害语义统计。",
            tone: "emerald",
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
