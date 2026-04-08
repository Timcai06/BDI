"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type {
  BatchItemV1,
  BatchStatsV1Response,
  BatchV1,
  BridgeV1,
  DetectionRecordV1
} from "@/lib/types";
import { useOpsWorkbenchData } from "./use-ops-workbench-data";
import { useOpsWorkbenchUrlSync } from "./use-ops-workbench-url-sync";

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

  useOpsWorkbenchUrlSync({
    batchOffset,
    category,
    detectionSortBy,
    detectionSortOrder,
    minConfidence,
    notice,
    pathname,
    ready,
    recentPathPrefixes,
    relativePathPrefix,
    router,
    searchParams,
    selectedBatchId,
    selectedBridgeId,
    setBatchOffset,
    setCategory,
    setDetectionSortBy,
    setDetectionSortOrder,
    setMinConfidence,
    setNotice,
    setReady,
    setRecentPathPrefixes,
    setRelativePathPrefix,
    setSelectedBatchId,
    setSelectedBridgeId
  });

  useOpsWorkbenchData({
    batchItemLimit,
    batchItemOffset,
    batchLimit,
    batchOffset,
    category,
    detectionSortBy,
    detectionSortOrder,
    isWizardOpen,
    minConfidence,
    ready,
    refreshTick,
    relativePathPrefix,
    selectedBatchId,
    selectedBatchStatus: selectedBatch?.status ?? null,
    selectedBridgeId,
    setBatchItemOffset,
    setBatchItemTotal,
    setBatchOffset,
    setBatchTotal,
    setBatches,
    setBridges,
    setDetections,
    setError,
    setItems,
    setLastRefreshedAt,
    setLoading,
    setRecentPathPrefixes,
    setRefreshTick,
    setSelectedBatchId,
    setSelectedBridgeId,
    setSelectedItemIds,
    setStats,
    showFailedItemsOnly
  });

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
