"use client";

import { useEffect } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";

import { RECENT_PATH_PREFIXES_STORAGE_KEY, normalizePathPrefix } from "./ops-workbench-paths";

type DetectionSortBy = "created_at" | "confidence" | "area_mm2";
type SortOrder = "asc" | "desc";

interface UseOpsWorkbenchUrlSyncParams {
  batchOffset: number;
  category: string;
  detectionSortBy: DetectionSortBy;
  detectionSortOrder: SortOrder;
  minConfidence: string;
  notice: string | null;
  pathname: string;
  ready: boolean;
  recentPathPrefixes: string[];
  relativePathPrefix: string;
  router: { replace: (href: string, options?: { scroll?: boolean }) => void };
  searchParams: ReadonlyURLSearchParams;
  selectedBatchId: string;
  selectedBridgeId: string;
  setBatchOffset: (value: number) => void;
  setCategory: (value: string) => void;
  setDetectionSortBy: (value: DetectionSortBy) => void;
  setDetectionSortOrder: (value: SortOrder) => void;
  setMinConfidence: (value: string) => void;
  setNotice: (value: string | null) => void;
  setReady: (value: boolean) => void;
  setRecentPathPrefixes: (value: string[]) => void;
  setRelativePathPrefix: (value: string) => void;
  setSelectedBatchId: (value: string) => void;
  setSelectedBridgeId: (value: string) => void;
}

export function useOpsWorkbenchUrlSync(params: UseOpsWorkbenchUrlSyncParams) {
  const {
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
  } = params;

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
  }, [setRecentPathPrefixes]);

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
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
}
