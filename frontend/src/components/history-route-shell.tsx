"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  message: "选择桥梁与批次以查看任务轨迹，或开启单图历史回顾。",
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

  // Archive Visibility Toggle
  const [showSingleHistory, setShowSingleHistory] = useState(false);

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
            message: `载入完成，档案库中现有 ${history.total} 条数字化记录。`,
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
      const message = error instanceof Error ? error.message : "批次列表加载失败";
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
      const message = error instanceof Error ? error.message : "批次记录明细加载失败";
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
        message: `已成功移除 ID 为 ${imageId} 的分析记录。`,
      });
      await loadHistory({ silent: true, forceFresh: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "删除记录操作失败。";
      setStatus({ phase: "error", message });
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
      const deletedIds = response.results.filter((item) => item.deleted).map((item) => item.image_id);
      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setHistoryItems((current) => current.filter((item) => !deletedSet.has(item.image_id)));
        setDeleteSuccessMessage(`已批量删除 ${deletedIds.length} 条记录。`);
      }
      await loadHistory({ silent: true, forceFresh: true });
      setStatus({
        phase: response.failed_count > 0 ? "error" : "success",
        message: response.failed_count > 0 ? `部分删除成功：${response.deleted_count} 条，失败：${response.failed_count} 条。` : `批量删除任务已完成。`,
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
      message: `已开始导出 ${imageIds.length} 条历史记录的 ${exportLabel} 压缩包。`,
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
          eyebrow="历史档案层"
          title="巡检档案中心"
          subtitle="在此追溯所有已完成的资产巡检批次、历史识别结果以及数字化报告"
          accent="amber"
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSingleHistory(!showSingleHistory)}
                className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-black transition-all ${
                  showSingleHistory 
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-200" 
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                {showSingleHistory ? "隐藏单图库" : "查看单图历史"}
              </button>
              <Link
                href="/dashboard/ops"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black text-white/50 transition-all hover:bg-white/10 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                返回工作台
              </Link>
            </div>
          }
        />
      }
    >
      <div className="space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-white/5 bg-white/[0.02] px-6 py-4 text-sm text-white/40 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            <span className="font-medium">{status.message}</span>
          </div>
          <div className="rounded-full border border-white/5 bg-white/5 px-4 py-1 text-[10px] font-black uppercase tracking-widest">
            {batches.length} 个存证批次
          </div>
        </motion.div>

        {batchError && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{batchError}</div>}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
          {/* Batch Selector Card */}
          <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-2xl transition-all hover:border-white/20">
            <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-amber-500/5 blur-[120px]" />
            
            <div className="relative mb-8">
              <div className="mb-2 flex items-center gap-2 opacity-30">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12M16 2v4M8 2v4M3 10h18"/></svg>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">批次目录</p>
              </div>
              <h3 className="text-2xl font-black tracking-tight text-white uppercase">批次历史</h3>
              
              <div className="mt-6 flex flex-col gap-4">
                <div className="relative rounded-2xl border border-white/5 bg-black/40 p-1.5 ring-1 ring-white/5 focus-within:ring-amber-500/50 transition-all">
                  <select
                    value={selectedBridgeId}
                    onChange={(e) => setSelectedBridgeId(e.target.value)}
                    className="h-11 w-full bg-transparent px-4 text-sm font-bold text-white outline-none"
                  >
                    <option value="" className="bg-slate-900">按桥梁资产筛选...</option>
                    {bridges.map((bridge) => (
                      <option key={bridge.id} value={bridge.id} className="bg-slate-900">
                        {bridge.bridge_code} | {bridge.bridge_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-[500px] overflow-auto space-y-3 pr-2 custom-scrollbar">
                  {batches.map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => setSelectedBatchId(batch.id)}
                      className={`group/item w-full rounded-2xl border p-4 text-left transition-all ${
                        selectedBatchId === batch.id
                          ? "border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-500/30"
                          : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-black transition-colors ${selectedBatchId === batch.id ? "text-amber-300" : "text-white/80"}`}>
                          {batch.batch_code}
                        </p>
                        <span className="text-[9px] font-bold text-white/20 uppercase tabular-nums">
                          {new Date(batch.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-white/40 uppercase">
                        <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-emerald-400"/> {batch.succeeded_item_count} 成功</span>
                        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-neutral-700"/> {batch.status}</span>
                      </div>
                    </button>
                  ))}
                  {batches.length === 0 && <div className="py-20 text-center text-xs text-white/20">暂无符合条件的批次</div>}
                  {hasMoreBatches && (
                    <button onClick={handleLoadMoreBatches} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors">
                      加载更多批次记录
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Batch Items List Card */}
          <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-2xl transition-all hover:border-white/20">
            <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px]" />
            
            <div className="relative mb-8 flex items-center justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 opacity-30">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">记录清单</p>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white uppercase">
                  {selectedBridge?.bridge_name ?? "资产记录"}
                </h3>
                <p className="mt-1 text-xs font-medium text-white/40">
                  {selectedBatchId ? `批次: ${selectedBatchId.slice(-8)} / 存证详情` : "请选择一个批次以查看图片轨迹"}
                </p>
              </div>
              {selectedBridge && (
                <Link
                  href={`/dashboard/bridges/${encodeURIComponent(selectedBridge.id)}`}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 hover:text-white transition-all underline decoration-amber-500/30 underline-offset-4"
                >
                  资产底座
                </Link>
              )}
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-inner">
                <table className="w-full border-collapse text-left">
                  <thead className="border-b border-white/5 bg-white/[0.02]">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20">序号</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20">存证文件</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20 text-center">状态</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/20 text-right">诊断入口</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedBatchItems.map((item) => (
                      <tr key={item.id} className="group/row transition-colors hover:bg-white/[0.03]">
                        <td className="px-6 py-4 text-xs font-mono text-white/30 tabular-nums">#{item.sequence_no}</td>
                        <td className="px-6 py-4">
                          <p className="max-w-[200px] truncate text-xs font-bold text-white/70">{item.original_filename ?? item.id}</p>
                          <p className="mt-0.5 text-[10px] font-medium text-white/20 uppercase tracking-tighter">{item.id.slice(0, 12)}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${item.processing_status === "succeeded" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" : "bg-white/10"}`} title={item.processing_status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.latest_result_id ? (
                            <Link
                              href={`/dashboard/history/${encodeURIComponent(item.latest_result_id)}?returnTo=${encodeURIComponent(currentHistoryHref)}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </Link>
                          ) : (
                            <span className="text-[10px] font-bold text-white/10 uppercase tracking-widest">无结果</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {selectedBatchItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-24 text-center text-xs font-black uppercase tracking-[0.3em] text-white/10">
                          {batchLoading ? "数据同步中..." : "未选定有效批次"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <AnimatePresence>
          {showSingleHistory && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.015] p-8 backdrop-blur-3xl shadow-2xl">
                <div className="mb-8 border-b border-white/5 pb-8">
                    <div className="mb-2 flex items-center gap-2 opacity-30">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">视觉轨迹库</p>
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-white uppercase">单图历史全局回顾</h3>
                    <p className="mt-1 text-xs font-medium text-white/40">追溯历史识别轨迹，进行批量导出与深度检索</p>
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
                  onDeleteRequest={(imageId) => void handleDeleteHistory(imageId)}
                  onBatchDelete={handleBatchDeleteHistory}
                  onBatchExportJson={(imageIds) => handleBatchExportHistory(imageIds, "json")}
                  onBatchExportOverlay={(imageIds) => handleBatchExportHistory(imageIds, "overlay")}
                  onSearchQueryChange={setHistorySearchQuery}
                  onCategoryFilterChange={setHistoryCategoryFilter}
                  onSortModeChange={setHistorySortMode}
                  onOpenUploader={() => router.push("/dashboard/lab-single")}
                  onRefresh={() => void loadHistory()}
                  onSelect={(imageId) => {
                    router.push(`/dashboard/history/${encodeURIComponent(imageId)}?returnTo=${encodeURIComponent(currentHistoryHref)}`);
                  }}
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </OpsPageLayout>
  );
}
