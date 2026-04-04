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
  listV1BatchItems,
  listV1Batches,
  listAllResults,
} from "@/lib/predict-client";
import type { BatchItemV1, BatchV1, PredictState, PredictionHistoryItem } from "@/lib/types";

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
  const [batchHistoryLoading, setBatchHistoryLoading] = useState(false);
  const [batchHistoryError, setBatchHistoryError] = useState<string | null>(null);
  const [batchList, setBatchList] = useState<BatchV1[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedBatchItems, setSelectedBatchItems] = useState<BatchItemV1[]>([]);
  const [showLegacyHistory, setShowLegacyHistory] = useState(false);

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

  const loadBatchHistory = useCallback(async () => {
    setBatchHistoryLoading(true);
    setBatchHistoryError(null);
    try {
      const batchResp = await listV1Batches(50, 0);
      setBatchList(batchResp.items);
      const targetBatchId = selectedBatchId || batchResp.items[0]?.id || "";
      setSelectedBatchId(targetBatchId);
      if (targetBatchId) {
        const itemsResp = await listV1BatchItems(targetBatchId, 200, 0);
        setSelectedBatchItems(itemsResp.items);
      } else {
        setSelectedBatchItems([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "批次历史读取失败";
      setBatchHistoryError(message);
    } finally {
      setBatchHistoryLoading(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    void loadBatchHistory();
  }, [loadBatchHistory]);

  useEffect(() => {
    if (!selectedBatchId) {
      return;
    }
    let cancelled = false;
    async function refreshItems() {
      try {
        const itemsResp = await listV1BatchItems(selectedBatchId, 200, 0);
        if (!cancelled) {
          setSelectedBatchItems(itemsResp.items);
        }
      } catch {
        // noop
      }
    }
    void refreshItems();
    return () => {
      cancelled = true;
    };
  }, [selectedBatchId]);

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

        <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-cyan-100">批次历史视图（企业流程）</h2>
            <button
              type="button"
              onClick={() => {
                void loadBatchHistory();
              }}
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20"
            >
              刷新批次历史
            </button>
          </div>
          {batchHistoryError ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {batchHistoryError}
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">批次列表</p>
              <div className="max-h-[320px] overflow-auto space-y-2">
                {batchList.map((batch) => (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => setSelectedBatchId(batch.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                      selectedBatchId === batch.id
                        ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    <p className="font-semibold">{batch.batch_code}</p>
                    <p className="mt-1 text-[10px] opacity-80">
                      {batch.status} | success {batch.succeeded_item_count} | failed {batch.failed_item_count}
                    </p>
                  </button>
                ))}
                {!batchHistoryLoading && batchList.length === 0 ? (
                  <div className="text-xs text-white/40">暂无批次记录</div>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
                批次图片清单 {selectedBatchId ? `(${selectedBatchId})` : ""}
              </p>
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-white/40">
                    <tr>
                      <th className="py-2">序号</th>
                      <th className="py-2">文件</th>
                      <th className="py-2">状态</th>
                      <th className="py-2">结果数</th>
                      <th className="py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-white/80">
                    {selectedBatchItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2">{item.sequence_no}</td>
                        <td className="py-2">{item.original_filename ?? item.source_relative_path ?? item.id}</td>
                        <td className="py-2">{item.processing_status}</td>
                        <td className="py-2">{item.defect_count ?? 0}</td>
                        <td className="py-2 text-right">
                          {item.latest_result_id ? (
                            <Link
                              href={`/dashboard/history/${encodeURIComponent(item.latest_result_id)}`}
                              className="rounded-md border border-white/20 px-2 py-1 text-[10px] hover:bg-white/10"
                            >
                              查看详情
                            </Link>
                          ) : (
                            <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/35">
                              暂无结果
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!batchHistoryLoading && selectedBatchItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-white/40">
                          当前批次暂无图片
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs text-white/45">单图历史</div>
            <button
              type="button"
              onClick={() => setShowLegacyHistory((prev) => !prev)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
            >
              {showLegacyHistory ? "收起单图历史" : "展开单图历史"}
            </button>
          </div>
          {showLegacyHistory ? (
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
          ) : (
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-5 text-sm text-white/45">
              默认已切换为企业流程：先批次，再图片。需要查看单图历史时再展开。
            </div>
          )}
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
