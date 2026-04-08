"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  getV1BatchStats,
  listV1BatchItems,
  listV1Batches,
  listV1Bridges,
  listV1Detections
} from "@/lib/predict-client";
import type {
  BatchItemV1,
  BatchStatsV1Response,
  BatchV1,
  BridgeV1,
  DetectionRecordV1
} from "@/lib/types";

const RECENT_PATH_PREFIXES_STORAGE_KEY = "ops.recentPathPrefixes.v1";

function normalizePathPrefix(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function mergeRecentPathPrefixes(current: string[], next: string[], limit: number = 8): string[] {
  const merged = [...next, ...current]
    .map(normalizePathPrefix)
    .filter(Boolean);
  return Array.from(new Set(merged)).slice(0, limit);
}

function derivePathPrefixesFromItems(paths: Array<string | null | undefined>, limit: number = 6): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const normalized = normalizePathPrefix(raw ?? "");
    if (!normalized) {
      continue;
    }
    const parts = normalized.split("/").filter(Boolean);
    const prefix = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
    if (!seen.has(prefix)) {
      seen.add(prefix);
      result.push(prefix);
    }
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}

export function useOpsWorkbenchState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [ready, setReady] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const [bridges, setBridges] = useState<BridgeV1[]>([]);
  const [selectedBridgeId, setSelectedBridgeId] = useState("");
  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchOffset, setBatchOffset] = useState(0);
  const batchLimit = 20;
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [showFailedItemsOnly, setShowFailedItemsOnly] = useState(false);
  const [relativePathPrefix, setRelativePathPrefix] = useState("");
  const [recentPathPrefixes, setRecentPathPrefixes] = useState<string[]>([]);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [currentEnhancementMode, setCurrentEnhancementMode] = useState<"off" | "auto" | "always">("auto");
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const [stats, setStats] = useState<BatchStatsV1Response | null>(null);
  const [items, setItems] = useState<BatchItemV1[]>([]);
  const [batchItemTotal, setBatchItemTotal] = useState(0);
  const [batchItemOffset, setBatchItemOffset] = useState(0);
  const batchItemLimit = 50;
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [detections, setDetections] = useState<DetectionRecordV1[]>([]);

  const [category, setCategory] = useState("");
  const [minConfidence, setMinConfidence] = useState("0.0");
  const [detectionSortBy, setDetectionSortBy] = useState<"created_at" | "confidence" | "area_mm2">("created_at");
  const [detectionSortOrder, setDetectionSortOrder] = useState<"asc" | "desc">("desc");

  const visibleItems = useMemo(
    () => (showFailedItemsOnly ? items.filter((item) => item.processing_status === "failed") : items),
    [items, showFailedItemsOnly]
  );

  const selectedBatch = useMemo(
    () => batches.find((item) => item.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );
  const selectedBridge = useMemo(
    () => bridges.find((item) => item.id === selectedBridgeId) ?? null,
    [bridges, selectedBridgeId]
  );

  useEffect(() => {
    const batchId = searchParams.get("batchId");
    const bridgeId = searchParams.get("bridgeId");
    const offset = Number(searchParams.get("batchOffset") ?? "0");
    const urlCategory = searchParams.get("category");
    const urlMinConfidence = searchParams.get("minConfidence");
    const urlDetSortBy = searchParams.get("dSortBy");
    const urlDetSortOrder = searchParams.get("dSortOrder");
    const urlPathPrefix = searchParams.get("pathPrefix");

    if (bridgeId) {
      setSelectedBridgeId(bridgeId);
    }
    if (batchId) {
      setSelectedBatchId(batchId);
    }
    if (Number.isFinite(offset) && offset >= 0) {
      setBatchOffset(offset);
    }
    if (urlCategory !== null) {
      setCategory(urlCategory);
    }
    if (urlMinConfidence !== null) {
      setMinConfidence(urlMinConfidence);
    }
    if (urlDetSortBy === "created_at" || urlDetSortBy === "confidence" || urlDetSortBy === "area_mm2") {
      setDetectionSortBy(urlDetSortBy);
    }
    if (urlDetSortOrder === "asc" || urlDetSortOrder === "desc") {
      setDetectionSortOrder(urlDetSortOrder);
    }
    if (urlPathPrefix !== null) {
      setRelativePathPrefix(urlPathPrefix);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(RECENT_PATH_PREFIXES_STORAGE_KEY);
      if (!value) {
        return;
      }
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        setRecentPathPrefixes(
          parsed
            .map((item) => (typeof item === "string" ? normalizePathPrefix(item) : ""))
            .filter(Boolean)
            .slice(0, 8)
        );
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(RECENT_PATH_PREFIXES_STORAGE_KEY, JSON.stringify(recentPathPrefixes));
    } catch {
      // noop
    }
  }, [recentPathPrefixes]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const next = new URLSearchParams();
    if (selectedBatchId) {
      next.set("batchId", selectedBatchId);
    }
    if (selectedBridgeId) {
      next.set("bridgeId", selectedBridgeId);
    }
    if (batchOffset > 0) {
      next.set("batchOffset", String(batchOffset));
    }
    if (category) {
      next.set("category", category);
    }
    if (minConfidence && minConfidence !== "0.0") {
      next.set("minConfidence", minConfidence);
    }
    if (detectionSortBy !== "created_at") {
      next.set("dSortBy", detectionSortBy);
    }
    if (detectionSortOrder !== "desc") {
      next.set("dSortOrder", detectionSortOrder);
    }
    if (relativePathPrefix.trim()) {
      next.set("pathPrefix", relativePathPrefix.trim());
    }
    const nextQuery = next.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [
    ready,
    selectedBatchId,
    selectedBridgeId,
    batchOffset,
    category,
    minConfidence,
    detectionSortBy,
    detectionSortOrder,
    relativePathPrefix,
    pathname,
    router,
    searchParams
  ]);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function loadBatches() {
      setLoading(true);
      setError(null);
      try {
        const [batchResp, bridgeResp] = await Promise.all([
          listV1Batches({ limit: batchLimit, offset: batchOffset, bridgeId: selectedBridgeId || undefined }),
          listV1Bridges(200, 0)
        ]);
        if (cancelled) {
          return;
        }
        setBatches(batchResp.items);
        setBatchTotal(batchResp.total);
        setBridges(bridgeResp.items);
        if (bridgeResp.items.length > 0) {
          setSelectedBridgeId((prev) => prev || bridgeResp.items[0].id);
        }
        if (batchResp.items.length > 0) {
          setSelectedBatchId((prev) => prev || batchResp.items[0].id);
        } else {
          setSelectedBatchId("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "批次加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBatches();
    return () => {
      cancelled = true;
    };
  }, [ready, batchOffset, refreshTick, selectedBridgeId]);

  useEffect(() => {
    if (!selectedBatchId || isWizardOpen) {
      return;
    }
    const timer = window.setInterval(() => {
      setRefreshTick((value) => value + 1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedBatchId, isWizardOpen]);

  useEffect(() => {
    let cancelled = false;
    if (!ready || !selectedBatchId) {
      setStats(null);
      setItems([]);
      setBatchItemTotal(0);
      setSelectedItemIds([]);
      setDetections([]);
      return;
    }

    async function loadBatchPanels() {
      setLoading(true);
      setError(null);
      try {
        const [statsResp, itemsResp, detectionsResp] = await Promise.all([
          getV1BatchStats(selectedBatchId),
          listV1BatchItems(selectedBatchId, batchItemLimit, batchItemOffset, relativePathPrefix.trim() || undefined),
          listV1Detections({
            batchId: selectedBatchId,
            category: category || undefined,
            minConfidence: minConfidence ? Number(minConfidence) : undefined,
            sortBy: detectionSortBy,
            sortOrder: detectionSortOrder,
            limit: 100,
            offset: 0
          })
        ]);

        if (cancelled) {
          return;
        }

        setStats(statsResp);
        setItems(itemsResp.items);
        setBatchItemTotal(itemsResp.total);
        setSelectedItemIds((current) =>
          current.filter((itemId) => itemsResp.items.some((item) => item.id === itemId))
        );
        setDetections(detectionsResp.items);
        setLastRefreshedAt(new Date().toISOString());
        setRecentPathPrefixes((current) =>
          mergeRecentPathPrefixes(
            current,
            derivePathPrefixesFromItems(itemsResp.items.map((item) => item.source_relative_path))
          )
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "批次详情加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBatchPanels();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    selectedBatchId,
    category,
    minConfidence,
    detectionSortBy,
    detectionSortOrder,
    relativePathPrefix,
    batchItemOffset,
    refreshTick
  ]);

  useEffect(() => {
    setBatchItemOffset(0);
    setSelectedItemIds([]);
  }, [selectedBatchId, relativePathPrefix, showFailedItemsOnly]);

  useEffect(() => {
    setBatchOffset(0);
    setSelectedBatchId("");
  }, [selectedBridgeId]);

  return {
    actionLoading,
    batchItemLimit,
    batchItemOffset,
    batchItemTotal,
    batchLimit,
    batchOffset,
    batchTotal,
    batches,
    bridges,
    category,
    currentEnhancementMode,
    deletingBatch,
    detections,
    detectionSortBy,
    detectionSortOrder,
    error,
    isWizardOpen,
    items,
    lastRefreshedAt,
    loading,
    minConfidence,
    notice,
    ready,
    recentPathPrefixes,
    refreshTick,
    relativePathPrefix,
    retryingTaskId,
    selectedBatch,
    selectedBatchId,
    selectedBridge,
    selectedBridgeId,
    selectedItemIds,
    setActionLoading,
    setBatchItemOffset,
    setBatchOffset,
    setCategory,
    setCurrentEnhancementMode,
    setDeletingBatch,
    setError,
    setIsWizardOpen,
    setMinConfidence,
    setNotice,
    setRecentPathPrefixes,
    setRefreshTick,
    setRelativePathPrefix,
    setRetryingTaskId,
    setSelectedBatchId,
    setSelectedBridgeId,
    setSelectedItemIds,
    setShowFailedItemsOnly,
    setSummaryExpanded,
    showFailedItemsOnly,
    stats,
    summaryExpanded,
    visibleItems
  };
}
