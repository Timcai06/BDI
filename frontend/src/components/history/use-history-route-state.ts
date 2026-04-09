"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
import { downloadBlobFile, initialHistoryRouteStatus } from "@/components/history/history-route-utils";

export function useHistoryRouteState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PredictState>(initialHistoryRouteStatus);
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
  const [hasMoreBatches, setHasMoreBatches] = useState(true);
  const initialBatchOffsetRef = useRef(batchOffset);
  const batchLimit = 50;

  const selectedBridge = useMemo(
    () => bridges.find((item) => item.id === selectedBridgeId) ?? null,
    [bridges, selectedBridgeId],
  );

  const availableHistoryCategories = useMemo(
    () =>
      getCanonicalCategoryOptions().filter((category) =>
        historyItems.some((item) =>
          (item.categories ?? []).some((value) => getDefectLabel(value) === category),
        ),
      ),
    [historyItems],
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
            message: `载入完成，现有 ${history.total} 条记录。`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "历史结果读取失败，请稍后重试。";
        setHistoryError(message);
        setStatus({ phase: "error", message });
      } finally {
        setHistoryLoading(false);
      }
    },
    [],
  );

  const loadBatches = useCallback(
    async (offset: number, append: boolean) => {
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
    },
    [selectedBridgeId],
  );

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

  const handleDeleteHistory = useCallback(async (imageId: string) => {
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
      const message = error instanceof Error ? error.message : "删除记录操作失败。";
      setStatus({ phase: "error", message });
    } finally {
      setDeletingImageId(null);
    }
  }, [loadHistory]);

  const handleBatchDeleteHistory = useCallback(async (imageIds: string[]) => {
    if (imageIds.length === 0) return;
    setDeletingImageId("batch");
    setDeleteSuccessMessage(null);
    try {
      const response = await batchDeleteResults(imageIds);
      const deletedIds = (response.results ?? []).filter((item) => item.deleted).map((item) => item.image_id);
      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setHistoryItems((current) => current.filter((item) => !deletedSet.has(item.image_id)));
        setDeleteSuccessMessage(`已批量删除 ${deletedIds.length} 条记录。`);
      }
      await loadHistory({ silent: true, forceFresh: true });
      setStatus({
        phase: response.failed_count > 0 ? "error" : "success",
        message:
          response.failed_count > 0
            ? `部分删除成功：${response.deleted_count} 条，失败：${response.failed_count} 条。`
            : "批量删除任务已完成。",
      });
    } finally {
      setDeletingImageId(null);
    }
  }, [loadHistory]);

  const handleBatchExportHistory = useCallback(async (imageIds: string[], assetType: "json" | "overlay") => {
    const exportLabel = assetType === "json" ? "JSON" : "结果图";
    const { blob, filename } = await batchExportResults(imageIds, assetType);
    downloadBlobFile(blob, filename);
    setStatus({
      phase: "success",
      message: `已开始导出 ${imageIds.length} 条历史记录的 ${exportLabel} 压缩包。`,
    });
  }, []);

  const handleLoadMoreBatches = useCallback(() => {
    const nextOffset = batchOffset + batchLimit;
    setBatchOffset(nextOffset);
    void loadBatches(nextOffset, true);
  }, [batchLimit, batchOffset, loadBatches]);

  const openUploader = useCallback(() => {
    router.push("/dashboard/ops");
  }, [router]);

  const openHistoryDetail = useCallback((imageId: string) => {
    router.push(`/dashboard/history/${encodeURIComponent(imageId)}?returnTo=${encodeURIComponent(currentHistoryHref)}`);
  }, [currentHistoryHref, router]);

  return {
    availableHistoryCategories,
    batchError,
    batchLoading,
    batches,
    bridges,
    currentHistoryHref,
    deleteSuccessMessage,
    deletingImageId,
    getHistoryPreviewUrl,
    handleBatchDeleteHistory,
    handleBatchExportHistory,
    handleDeleteHistory,
    handleLoadMoreBatches,
    hasMoreBatches,
    historyCategoryFilter,
    historyError,
    historyItems,
    historyLoading,
    historySearchQuery,
    historySortMode,
    historyTotal,
    loadHistory,
    openHistoryDetail,
    openUploader,
    selectedBatchId,
    selectedBatchItems,
    selectedBridge,
    selectedBridgeId,
    setHistoryCategoryFilter,
    setHistorySearchQuery,
    setHistorySortMode,
    setSelectedBatchId,
    setSelectedBridgeId,
    setShowSingleHistory,
    showSingleHistory,
    status,
  };
}
