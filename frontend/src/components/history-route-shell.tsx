"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardRightRail } from "@/components/dashboard-right-rail";
import { HistoryPanel } from "@/components/history";
import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { getCanonicalCategoryOptions, getDefectLabel } from "@/lib/defect-visuals";
import type { HistorySortMode } from "@/lib/history-utils";
import {
  batchDeleteResults,
  batchExportResults,
  deleteResult,
  getOverlayDownloadUrl,
  getResultImageUrl,
  listAllResults,
  listV1BatchItems,
  listV1Batches,
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PredictState>(initialStatus);

  const [historyItems, setHistoryItems] = useState<PredictionHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState(searchParams.get("search") ?? "");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState(searchParams.get("category") ?? "全部");
  const [historySortMode, setHistorySortMode] = useState<HistorySortMode>(
    (searchParams.get("sort") as HistorySortMode) || "newest",
  );
  const [showLegacyHistory, setShowLegacyHistory] = useState(searchParams.get("legacy") === "1");

  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState(searchParams.get("batchId") ?? "");
  const [selectedBatchItems, setSelectedBatchItems] = useState<BatchItemV1[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchOffset, setBatchOffset] = useState(Number(searchParams.get("batchOffset") ?? "0"));
  const batchLimit = 50;
  const [hasMoreBatches, setHasMoreBatches] = useState(true);
  const initialBatchOffsetRef = useRef(batchOffset);

  const availableHistoryCategories = useMemo(
    () =>
      getCanonicalCategoryOptions().filter((category) =>
        historyItems.some((item) =>
          item.categories.some((value) => getDefectLabel(value) === category),
        ),
      ),
    [historyItems],
  );

  const selectedBatch = useMemo(
    () => batches.find((item) => item.id === selectedBatchId) ?? null,
    [batches, selectedBatchId],
  );
  const currentHistoryHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedBatchId) params.set("batchId", selectedBatchId);
    if (batchOffset > 0) params.set("batchOffset", String(batchOffset));
    if (showLegacyHistory) params.set("legacy", "1");
    if (historySearchQuery) params.set("search", historySearchQuery);
    if (historyCategoryFilter !== "全部") params.set("category", historyCategoryFilter);
    if (historySortMode !== "newest") params.set("sort", historySortMode);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [
    batchOffset,
    historyCategoryFilter,
    historySearchQuery,
    historySortMode,
    pathname,
    selectedBatchId,
    showLegacyHistory,
  ]);

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
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "历史结果读取失败，请稍后重试。";
        setHistoryError(message);
        setStatus({
          phase: "error",
          message,
        });
      } finally {
        setHistoryLoading(false);
      }
    },
    [],
  );

  const loadBatches = useCallback(async (offset: number, append: boolean) => {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const response = await listV1Batches(batchLimit, offset);
      setBatches((current) => (append ? [...current, ...response.items] : response.items));
      setHasMoreBatches(response.items.length === batchLimit);
      const firstBatchId = response.items[0]?.id ?? "";
      setSelectedBatchId((current) => current || firstBatchId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "批次历史读取失败";
      setBatchError(message);
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const loadSelectedBatchItems = useCallback(async (batchId: string) => {
    if (!batchId) {
      setSelectedBatchItems([]);
      return;
    }
    setBatchLoading(true);
    setBatchError(null);
    try {
      const response = await listV1BatchItems(batchId, 200, 0);
      setSelectedBatchItems(response.items);
    } catch (error) {
      const message = error instanceof Error ? error.message : "批次图片清单读取失败";
      setBatchError(message);
      setSelectedBatchItems([]);
    } finally {
      setBatchLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory({ silent: true });
    void loadBatches(initialBatchOffsetRef.current, false);
  }, [loadBatches, loadHistory]);

  useEffect(() => {
    void loadSelectedBatchItems(selectedBatchId);
  }, [loadSelectedBatchItems, selectedBatchId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedBatchId) params.set("batchId", selectedBatchId);
    if (batchOffset > 0) params.set("batchOffset", String(batchOffset));
    if (showLegacyHistory) params.set("legacy", "1");
    if (historySearchQuery) params.set("search", historySearchQuery);
    if (historyCategoryFilter !== "全部") params.set("category", historyCategoryFilter);
    if (historySortMode !== "newest") params.set("sort", historySortMode);
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [
    batchOffset,
    historyCategoryFilter,
    historySearchQuery,
    historySortMode,
    pathname,
    router,
    selectedBatchId,
    showLegacyHistory,
  ]);

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
    if (imageIds.length === 0) {
      return;
    }

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

  function handleLoadMoreBatches() {
    const nextOffset = batchOffset + batchLimit;
    setBatchOffset(nextOffset);
    void loadBatches(nextOffset, true);
  }

  return (
    <>
      <section className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden bg-black/40 backdrop-blur-3xl">
        <div className="relative flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mx-auto flex min-h-full max-w-[1800px] flex-col lg:px-2">
            <OpsPageHeader
              eyebrow="ARCHIVE"
              title="任务历史"
              subtitle={
                <>
                  BATCH REGISTRY /{" "}
                  <span className="font-mono text-amber-200/50">{batches.length} RECORDS ATTESTED</span>
                </>
              }
              accent="amber"
              actions={
                <>
                <Link
                  href="/dashboard/ops"
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  返回实时工作台
                </Link>
                <button
                  type="button"
                  onClick={() => setShowLegacyHistory((current) => !current)}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-2.5 text-xs font-bold text-cyan-100 transition-all hover:bg-cyan-500/20"
                >
                  {showLegacyHistory ? "收起单图历史" : "展开单图历史"}
                </button>
                </>
              }
            />

            <div className="mb-4 mt-6 rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-3 text-sm text-white/55">
              {status.message}
            </div>

            {historyError ? (
              <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
                {historyError}
              </div>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] lg:p-8">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
                    批次历史视图 / Enterprise Batch Archive
                  </h2>
                  <p className="mt-2 text-sm text-white/45">
                    批次切换、批次内图片浏览、单图详情入口都保留在这里。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBatchOffset(0);
                  }}
                  className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20"
                >
                  刷新批次历史
                </button>
              </div>

              {batchError ? (
                <div className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {batchError}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
                    批次列表
                  </p>
                  <div className="max-h-[420px] overflow-auto space-y-2">
                    {batches.map((batch) => (
                      <button
                        key={batch.id}
                        type="button"
                        onClick={() => setSelectedBatchId(batch.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          selectedBatchId === batch.id
                            ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <p className="font-semibold">{batch.batch_code}</p>
                        <p className="mt-1 text-[10px] opacity-80">
                          {batch.status} | success {batch.succeeded_item_count} | failed {batch.failed_item_count}
                        </p>
                      </button>
                    ))}
                    {!batchLoading && batches.length === 0 ? (
                      <div className="text-xs text-white/40">暂无批次记录</div>
                    ) : null}
                  </div>
                  {hasMoreBatches && !batchLoading ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handleLoadMoreBatches}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45 hover:bg-white/10 hover:text-white"
                      >
                        加载更多批次
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                      批次图片清单 {selectedBatch ? `(${selectedBatch.batch_code})` : ""}
                    </p>
                    {selectedBatch ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50">
                        {selectedBatch.status}
                      </span>
                    ) : null}
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="border-b border-white/5 text-white/35">
                        <tr>
                          <th className="pb-3">序号</th>
                          <th className="pb-3">文件</th>
                          <th className="pb-3">状态</th>
                          <th className="pb-3">结果数</th>
                          <th className="pb-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03] text-white/80">
                        {selectedBatchItems.map((item) => (
                          <tr key={item.id} className="transition-colors hover:bg-white/[0.02]">
                            <td className="py-3">{item.sequence_no}</td>
                            <td className="py-3">{item.original_filename ?? item.source_relative_path ?? item.id}</td>
                            <td className="py-3">{item.processing_status}</td>
                            <td className="py-3">{item.defect_count ?? 0}</td>
                            <td className="py-3 text-right">
                              {item.latest_result_id ? (
                                <Link
                                  href={`/dashboard/history/${encodeURIComponent(item.latest_result_id)}?returnTo=${encodeURIComponent(currentHistoryHref)}`}
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
                        {!batchLoading && selectedBatchItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-white/40">
                              当前批次暂无图片
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-6 min-h-0 flex-1">
              {showLegacyHistory ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
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
                      router.push(`/dashboard/history/${encodeURIComponent(imageId)}?returnTo=${encodeURIComponent(currentHistoryHref)}`);
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-5 text-sm text-white/45">
                  默认展示企业批次视图。需要按旧方式查看单图历史时，展开上方“单图历史”即可。
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <DashboardRightRail
        eyebrow="History / Summary"
        title="列表状态"
        description="历史档案页保留批次浏览，同时恢复单图历史入口与详情跳转。"
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
            hint: "按标准病害语义统计。",
            tone: "emerald",
          },
          {
            title: "当前批次",
            value: selectedBatch?.batch_code ?? "未选择",
            hint: selectedBatch ? `${selectedBatch.succeeded_item_count} 成功 / ${selectedBatch.failed_item_count} 失败` : "请选择一个批次查看清单。",
            tone: "amber",
          },
        ]}
      />
    </>
  );
}
