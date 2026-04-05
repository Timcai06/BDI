"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HistoryPanel } from "@/components/history";
import { OpsPageLayout } from "@/components/ops/ops-page-layout";
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
  listV1Bridges,
} from "@/lib/predict-client";
import type { BatchItemV1, BatchV1, BridgeV1, PredictState, PredictionHistoryItem } from "@/lib/types";

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

  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [bridges, setBridges] = useState<BridgeV1[]>([]);
  const [selectedBridgeId, setSelectedBridgeId] = useState(searchParams.get("bridgeId") ?? "");
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
  const selectedBridge = useMemo(
    () => bridges.find((item) => item.id === selectedBridgeId) ?? null,
    [bridges, selectedBridgeId],
  );
  const currentHistoryHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedBridgeId) params.set("bridgeId", selectedBridgeId);
    if (selectedBatchId) params.set("batchId", selectedBatchId);
    if (batchOffset > 0) params.set("batchOffset", String(batchOffset));
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
    selectedBridgeId,
    selectedBatchId,
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
      const [batchResponse, bridgeResponse] = await Promise.all([
        listV1Batches({ limit: batchLimit, offset, bridgeId: selectedBridgeId || undefined }),
        listV1Bridges(200, 0),
      ]);
      setBridges(bridgeResponse.items);
      if (!selectedBridgeId && bridgeResponse.items[0]?.id) {
        setSelectedBridgeId(bridgeResponse.items[0].id);
      }
      setBatches((current) => (append ? [...current, ...batchResponse.items] : batchResponse.items));
      setHasMoreBatches(batchResponse.items.length === batchLimit);
      const firstBatchId = batchResponse.items[0]?.id ?? "";
      setSelectedBatchId((current) => current || firstBatchId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "批次历史读取失败";
      setBatchError(message);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedBridgeId]);

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
    setBatchOffset(0);
    setSelectedBatchId("");
    void loadBatches(0, false);
  }, [selectedBridgeId, loadBatches]);

  useEffect(() => {
    void loadSelectedBatchItems(selectedBatchId);
  }, [loadSelectedBatchItems, selectedBatchId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedBridgeId) params.set("bridgeId", selectedBridgeId);
    if (selectedBatchId) params.set("batchId", selectedBatchId);
    if (batchOffset > 0) params.set("batchOffset", String(batchOffset));
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
    selectedBridgeId,
    selectedBatchId,
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
    <OpsPageLayout
      containerClassName="min-h-full"
      header={
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
            <Link
              href="/dashboard/ops"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              返回实时工作台
            </Link>
          }
        />
      }
    >

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-3 text-sm text-white/55">
              <span>{status.message}</span>
              <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/45">
                批次视图与单图历史已统一展示
              </span>
            </div>

            {historyError ? (
              <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
                {historyError}
              </div>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] lg:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
                    批次历史视图 / Enterprise Batch Archive
                  </h2>
                  <p className="mt-2 text-sm text-white/45">
                    批次切换、批次内图片浏览、单图详情入口都保留在这里。
                  </p>
                </div>
                <div className="min-w-[240px] rounded-lg border border-white/10 bg-black/20 px-2">
                  <select
                    value={selectedBridgeId}
                    onChange={(e) => setSelectedBridgeId(e.target.value)}
                    className="w-full bg-transparent px-2 py-2 text-sm font-semibold text-white outline-none"
                  >
                    <option value="">选择桥梁资产...</option>
                    {bridges.map((bridge) => (
                      <option key={bridge.id} value={bridge.id}>
                        {bridge.bridge_code} | {bridge.bridge_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedBridge ? (
                <div className="mb-5 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/55">
                  <span>当前桥梁：{selectedBridge.bridge_name} / {selectedBridge.bridge_code}</span>
                  <Link
                    href={`/dashboard/bridges/${encodeURIComponent(selectedBridge.id)}`}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-bold text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    查看桥梁详情
                  </Link>
                </div>
              ) : null}

              {batchError ? (
                <div className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {batchError}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
                    批次列表
                  </p>
                  <div className="max-h-[380px] overflow-auto space-y-2">
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
                  <div className="max-h-[380px] overflow-auto">
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

            <div className="min-h-0 flex-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] lg:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
                      单图历史 / Individual Result Archive
                    </h2>
                    <p className="mt-2 text-sm text-white/45">
                      原始历史记录、筛选、批量导出与详情跳转统一保留在这里。
                    </p>
                  </div>
                </div>
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
            </div>
    </OpsPageLayout>
  );
}
