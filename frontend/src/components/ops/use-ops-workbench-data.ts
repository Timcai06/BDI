"use client";

import { useEffect } from "react";

import {
  getV1BatchStats,
  listV1BatchItems,
  listV1Batches,
  listV1Bridges,
  listV1Detections
} from "@/lib/predict-client";
import { derivePathPrefixesFromItems, mergeRecentPathPrefixes } from "./ops-workbench-paths";
import type {
  BatchItemV1,
  BatchStatsV1Response,
  BatchV1,
  BridgeV1,
  DetectionRecordV1
} from "@/lib/types";

interface UseOpsWorkbenchDataParams {
  batchItemLimit: number;
  batchItemOffset: number;
  batchLimit: number;
  batchOffset: number;
  category: string;
  detectionSortBy: "created_at" | "confidence" | "area_mm2";
  detectionSortOrder: "asc" | "desc";
  isWizardOpen: boolean;
  minConfidence: string;
  ready: boolean;
  refreshTick: number;
  relativePathPrefix: string;
  selectedBatchId: string;
  selectedBridgeId: string;
  setBatchItemOffset: (value: number) => void;
  setBatchItemTotal: (value: number) => void;
  setBatchOffset: (value: number) => void;
  setBatchTotal: (value: number) => void;
  setBatches: (value: BatchV1[]) => void;
  setBridges: (value: BridgeV1[]) => void;
  setDetections: (value: DetectionRecordV1[]) => void;
  setError: (value: string | null) => void;
  setItems: (value: BatchItemV1[]) => void;
  setLastRefreshedAt: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  setRecentPathPrefixes: (updater: (current: string[]) => string[]) => void;
  setRefreshTick: (updater: (value: number) => number) => void;
  setSelectedBatchId: (value: string | ((current: string) => string)) => void;
  setSelectedBridgeId: (value: string | ((current: string) => string)) => void;
  setSelectedItemIds: (value: string[] | ((current: string[]) => string[])) => void;
  setStats: (value: BatchStatsV1Response | null) => void;
  showFailedItemsOnly: boolean;
}

export function useOpsWorkbenchData(params: UseOpsWorkbenchDataParams) {
  const {
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
  } = params;

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
          setSelectedBridgeId((prev) => (prev ? prev : bridgeResp.items[0].id));
        }
        if (batchResp.items.length > 0) {
          setSelectedBatchId((prev) => (prev ? prev : batchResp.items[0].id));
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
  }, [ready, batchOffset, refreshTick, selectedBridgeId, batchLimit, setBatches, setBatchTotal, setBridges, setError, setLoading, setSelectedBatchId, setSelectedBridgeId]);

  useEffect(() => {
    if (!selectedBatchId || isWizardOpen) {
      return;
    }
    const timer = window.setInterval(() => {
      setRefreshTick((value) => value + 1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedBatchId, isWizardOpen, setRefreshTick]);

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
    refreshTick,
    batchItemLimit,
    setBatchItemTotal,
    setDetections,
    setError,
    setItems,
    setLastRefreshedAt,
    setLoading,
    setRecentPathPrefixes,
    setSelectedItemIds,
    setStats
  ]);

  useEffect(() => {
    setBatchItemOffset(0);
    setSelectedItemIds([]);
  }, [selectedBatchId, relativePathPrefix, showFailedItemsOnly, setBatchItemOffset, setSelectedItemIds]);

  useEffect(() => {
    setBatchOffset(0);
    setSelectedBatchId("");
  }, [selectedBridgeId, setBatchOffset, setSelectedBatchId]);
}
