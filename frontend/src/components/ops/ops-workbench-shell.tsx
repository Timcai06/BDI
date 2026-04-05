"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  createV1Batch,
  deleteV1Batch,
  getV1Task,
  getV1BatchStats,
  ingestV1BatchItems,
  listV1BatchItems,
  listV1Batches,
  listV1Bridges,
  listV1Detections,
  retryV1Task
} from "@/lib/predict-client";
import { BatchHeader } from "./batch-header";
import { ItemGrid } from "./item-grid";
import { IngestionWizard } from "./ingestion-wizard";
import { OpsPageHeader } from "./ops-page-header";
import { OpsPageLayout } from "./ops-page-layout";
import { OpsWorkbenchSkeleton } from "./ops-workbench-skeleton";
import type { BatchWizardPayload } from "./ingestion-wizard";
import { BatchEmptyState } from "./batch-empty-state";
import type {
  BatchItemV1,
  BatchStatsV1Response,
  BatchV1,
  BridgeV1,
  DetectionRecordV1
} from "@/lib/types";

type FileWithRelativePath = File & { webkitRelativePath?: string };
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

export function OpsWorkbenchShell() {
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

  const createdBy = "ops-user";
  const sourceDevice = "drone-A";
  const modelPolicy = "fusion-default";
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

  // Notice Auto-hide Timer
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
    if (!selectedBatchId) {
      return;
    }
    const timer = window.setInterval(() => {
      setRefreshTick((value) => value + 1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedBatchId]);

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

  const selectedBatch = useMemo(
    () => batches.find((item) => item.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );
  const selectedBridge = useMemo(
    () => bridges.find((item) => item.id === selectedBridgeId) ?? null,
    [bridges, selectedBridgeId]
  );
  const batchStatusBreakdown = stats?.status_breakdown ?? {};
  const queuedCount = batchStatusBreakdown.queued ?? 0;
  const runningCount = batchStatusBreakdown.running ?? 0;
  const succeededCount = batchStatusBreakdown.succeeded ?? 0;
  const failedCount = batchStatusBreakdown.failed ?? 0;
  const reviewCount = Object.values(stats?.review_breakdown ?? {}).reduce((sum, value) => sum + value, 0);
  const defectCount = Object.values(stats?.category_breakdown ?? {}).reduce((sum, value) => sum + value, 0);
  const alertCount = Object.values(stats?.alert_breakdown ?? {}).reduce((sum, value) => sum + value, 0);

  useEffect(() => {
    setBatchItemOffset(0);
    setSelectedItemIds([]);
  }, [selectedBatchId, relativePathPrefix, showFailedItemsOnly]);

  useEffect(() => {
    setBatchOffset(0);
    setSelectedBatchId("");
  }, [selectedBridgeId]);

  async function handleCreateBatch(
    bridgeId: string,
    payload: {
      sourceType: string;
      expectedItemCount: number;
      createdBy?: string;
      inspectionLabel?: string;
      enhancementMode: "off" | "auto" | "always";
    },
  ) {
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createV1Batch({
        bridgeId,
        sourceType: payload.sourceType || "drone_image_stream",
        expectedItemCount: payload.expectedItemCount,
        createdBy: payload.createdBy || createdBy,
        inspectionLabel: payload.inspectionLabel,
        enhancementMode: payload.enhancementMode,
      });
      setNotice(`批次创建成功：${created.batch_code}`);
      setCurrentEnhancementMode(payload.enhancementMode);
      setBatchOffset(0);
      setSelectedBridgeId(bridgeId);
      setSelectedBatchId(created.id);
      setRefreshTick((v) => v + 1);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : "批次创建失败");
      throw err;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleIngestItems(batchId: string, files: File[]) {
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const relativePaths = files.map((file) => {
        const relativePath = (file as FileWithRelativePath).webkitRelativePath?.trim() ?? "";
        return relativePath;
      });
      const hasRelativePath = relativePaths.some((item) => item.length > 0);
      if (hasRelativePath) {
        setRecentPathPrefixes((current) => mergeRecentPathPrefixes(current, derivePathPrefixesFromItems(relativePaths)));
      }
      const chunkSize = 20;
      let acceptedCount = 0;
      let rejectedCount = 0;
      const errorCounter = new Map<string, number>();
      for (let index = 0; index < files.length; index += chunkSize) {
        const chunkFiles = files.slice(index, index + chunkSize);
        const chunkRelativePaths = hasRelativePath ? relativePaths.slice(index, index + chunkSize) : undefined;
        const response = await ingestV1BatchItems({
          batchId,
          files: chunkFiles,
          relativePaths: chunkRelativePaths,
          modelPolicy: modelPolicy.trim() || "fusion-default",
          enhancementMode: selectedBatch?.enhancement_mode ?? currentEnhancementMode,
          sourceDevice: sourceDevice.trim() || undefined
        });
        acceptedCount += response.accepted_count;
        rejectedCount += response.rejected_count;
        response.errors.forEach((item) => {
          const key = `${item.code}: ${item.message}`;
          errorCounter.set(key, (errorCounter.get(key) ?? 0) + 1);
        });
      }
      const topErrors = Array.from(errorCounter.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([message, count]) => `${count}x ${message}`);
      const summary = `上传完成：accepted=${acceptedCount}, rejected=${rejectedCount}, chunks=${Math.ceil(files.length / chunkSize)}`;
      setNotice(topErrors.length > 0 ? `${summary} | 失败原因：${topErrors.join(" ; ")}` : summary);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批次图片上传失败");
      throw err;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWizardFinish(bridgeId: string, batchPayload: BatchWizardPayload, files: File[]) {
    try {
      setCurrentEnhancementMode(batchPayload.enhancementMode);
      const batch = await handleCreateBatch(bridgeId, batchPayload);
      if (files.length > 0) {
        await handleIngestItems(batch.id, files);
      }
      setIsWizardOpen(false);
    } catch {
      // Errors are handled in the individual calls
    }
  }

  async function handleRetryBatchItemTask(taskId: string) {
    setRetryingTaskId(taskId);
    setError(null);
    setNotice(null);
    try {
      const task = await getV1Task(taskId);
      if (task.status !== "failed") {
        throw new Error("仅失败任务可以重试。");
      }
      const response = await retryV1Task({
        taskId,
        requestedBy: createdBy.trim() || "ops-user",
        reason: "manual retry from ops workbench"
      });
      setNotice(`重试已入队：old=${response.old_task_id} -> new=${response.new_task_id}`);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "任务重试失败");
    } finally {
      setRetryingTaskId(null);
    }
  }

  function handleToggleSelectItem(itemId: string) {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  function handleSelectVisibleItems() {
    const visibleIds = visibleItems.map((item) => item.id);
    setSelectedItemIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  async function handleRetrySelectedFailed() {
    const selectedFailedItems = items.filter(
      (item) => selectedItemIds.includes(item.id) && item.processing_status === "failed" && item.latest_task_id
    );
    if (selectedFailedItems.length === 0) {
      setNotice("当前选择中没有可重试的失败项。");
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      let queuedCount = 0;
      const failedReasons: string[] = [];
      for (const item of selectedFailedItems) {
        try {
          await retryV1Task({
            taskId: item.latest_task_id!,
            requestedBy: createdBy.trim() || "ops-user",
            reason: "bulk retry from ops workbench"
          });
          queuedCount += 1;
        } catch (err) {
          failedReasons.push(err instanceof Error ? err.message : "任务重试失败");
        }
      }
      if (failedReasons.length > 0) {
        const sample = failedReasons.slice(0, 2).join(" | ");
        setError(`批量重试部分失败：成功入队 ${queuedCount} 项，失败 ${failedReasons.length} 项。${sample}`);
      } else {
        setNotice(`批量重试已入队：${queuedCount} 项`);
      }
      setSelectedItemIds([]);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量重试失败");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteCurrentBatch() {
    if (!selectedBatchId) {
      return;
    }
    const current = batches.find((item) => item.id === selectedBatchId);
    const label = current?.batch_code ?? selectedBatchId;
    const confirmed = window.confirm(`确认删除批次 ${label}？该操作会删除批次及其任务、结果、告警记录。`);
    if (!confirmed) {
      return;
    }

    setDeletingBatch(true);
    setError(null);
    setNotice(null);
    try {
      await deleteV1Batch(selectedBatchId);
      setNotice(`批次已删除：${label}`);
      setSelectedBatchId("");
      setBatchItemOffset(0);
      setSelectedItemIds([]);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批次删除失败");
    } finally {
      setDeletingBatch(false);
    }
  }

  return (
    <>
      <OpsPageLayout
        contentClassName="space-y-8"
        header={
          <BatchHeader />
        }
      >
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative grid gap-6 lg:grid-cols-[1fr_auto_1fr] items-center"
        >
          {/* Bento Navigation: Layer 1 - Bridge Selection */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/20 hover:bg-white/[0.05] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]">
            <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-cyan-500/5 blur-[80px] transition-all group-hover:bg-cyan-500/10" />
            
            <div className="relative mb-6 flex items-start justify-between">
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/80">桥梁</p>
                </div>
                <h3 className="text-lg font-black tracking-tight text-white uppercase">选择桥梁</h3>
                <p className="mt-1 text-xs font-medium text-white/40">选择本次巡检关联的桥梁对象</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/dashboard/bridges"
                  title="资产地图"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                </Link>
                {selectedBridge && (
                  <Link
                    href={`/dashboard/bridges/${encodeURIComponent(selectedBridge.id)}`}
                    title="资产详情"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  </Link>
                )}
              </div>
            </div>

            <div className="relative rounded-2xl border border-white/5 bg-black/40 p-1.5 ring-1 ring-white/5 focus-within:ring-cyan-500/50 transition-all">
              <select
                value={selectedBridgeId}
                onChange={(e) => setSelectedBridgeId(e.target.value)}
                className="h-12 w-full appearance-none bg-transparent px-4 text-sm font-bold text-white outline-none"
              >
                <option value="" className="bg-[#121212]">选择桥梁...</option>
                {bridges.map((bridge) => (
                  <option key={bridge.id} value={bridge.id} className="bg-[#121212]">
                    {bridge.bridge_code} | {bridge.bridge_name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 opacity-30">
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L6 6L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Sequential Arrow Connector */}
          <div className="hidden lg:flex items-center justify-center">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-500 shadow-lg ${
              selectedBridgeId 
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                : "bg-white/5 border-white/10 text-white/20"
            }`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={selectedBridgeId ? "animate-pulse" : ""}>
                <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Bento Navigation: Layer 2 - Batch Selection */}
          <div className={`group relative overflow-hidden rounded-3xl border transition-all duration-500 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] ${
            selectedBridgeId 
              ? "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]" 
              : "border-white/5 bg-white/[0.01] opacity-60 grayscale"
          }`}>
            <div className={`absolute -right-12 -top-12 h-64 w-64 rounded-full blur-[80px] transition-all ${
              selectedBridgeId ? "bg-emerald-500/5 group-hover:bg-emerald-500/10" : "bg-white/0"
            }`} />

            <div className="relative mb-6 flex items-start justify-between">
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    selectedBridgeId ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-white/20"
                  }`} />
                  <p className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${
                    selectedBridgeId ? "text-emerald-400/80" : "text-white/20"
                  }`}>批次</p>
                </div>
                <h3 className="text-lg font-black tracking-tight text-white uppercase">批次列表</h3>
                <p className="mt-1 text-xs font-medium text-white/40">基于所选桥梁的巡检批次管理</p>
              </div>
              <div className="flex gap-2">
                {selectedBatch && (
                  <button
                    onClick={handleDeleteCurrentBatch}
                    disabled={deletingBatch}
                    title="删除当前批次"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300/80 transition-all hover:bg-rose-500/20 disabled:opacity-40"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                )}
                <button
                  onClick={() => setIsWizardOpen(true)}
                  disabled={!selectedBridgeId}
                  title="新建批次"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-black transition-all hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>

            <div className={`relative rounded-2xl border border-white/5 bg-black/40 p-1.5 ring-1 ring-white/5 transition-all ${
              selectedBridgeId ? "focus-within:ring-emerald-500/50" : ""
            }`}>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                disabled={!selectedBridgeId}
                className="h-12 w-full appearance-none bg-transparent px-4 text-sm font-bold text-white outline-none disabled:cursor-not-allowed"
              >
                <option value="" className="bg-[#121212]">
                  {selectedBridgeId ? "选择执行批次..." : "等待锁定桥梁..."}
                </option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id} className="bg-[#121212]">
                    {batch.batch_code} ({batch.status})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 opacity-30">
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L6 6L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </motion.section>



        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </motion.div>
        )}
        {notice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            {notice}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {loading && !lastRefreshedAt ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <OpsWorkbenchSkeleton />
            </motion.div>
          ) : !selectedBatchId ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <BatchEmptyState
                onCreateClick={() => setIsWizardOpen(true)}
                hasSelectedBridge={Boolean(selectedBridgeId)}
                onOpenBridgeAssets={() => router.push("/dashboard/bridges")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
            <section className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
              <button
                type="button"
                onClick={() => setSummaryExpanded((value) => !value)}
                className="group flex w-full flex-wrap items-center justify-between gap-6 px-8 py-6 text-left transition-all hover:bg-white/[0.04]"
              >
                <div className="grid flex-1 gap-8 md:grid-cols-4 lg:grid-cols-5">
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2 opacity-40">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7l9-4 9 4M5 7v14M19 7v14M10 21v-8h4v8m-7-8h10"/></svg>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">当前资产</p>
                    </div>
                    <p className="truncate text-sm font-black tracking-tight text-white uppercase">{selectedBridge?.bridge_name ?? "-"}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-cyan-400/60 tabular-nums">{selectedBridge?.bridge_code ?? "-"}</p>
                  </div>

                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2 opacity-40">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12M16 2v4M8 2v4M3 10h18"/></svg>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">任务批次</p>
                    </div>
                    <p className="truncate text-sm font-black tracking-tight text-white uppercase">{selectedBatch?.batch_code ?? "-"}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedBatch?.status === "completed" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"}`} />
                      <p className="text-[10px] font-bold text-white/50">{selectedBatch?.status ?? "-"}</p>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2 opacity-40">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">处理进度</p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <p className="text-sm font-black tracking-tight text-white tabular-nums">{succeededCount}</p>
                      <p className="text-[10px] font-bold text-white/30">/ {batchItemTotal}</p>
                    </div>
                    <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: batchItemTotal > 0 ? `${(succeededCount / batchItemTotal) * 100}%` : 0 }}
                        className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]" 
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2 opacity-40">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"/></svg>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">业务预警</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-black text-rose-400 tabular-nums">{alertCount}</p>
                        <p className="text-[9px] font-bold uppercase text-white/30">告警</p>
                      </div>
                      <div className="h-4 w-px bg-white/10" />
                      <div>
                        <p className="text-sm font-black text-amber-400 tabular-nums">{defectCount}</p>
                        <p className="text-[9px] font-bold uppercase text-white/30">病害</p>
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:block relative text-right">
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all ${summaryExpanded ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" : "border-white/10 bg-white/5 text-white/40 group-hover:text-white"}`}>
                      <span className="text-[9px] font-black uppercase tracking-widest">{summaryExpanded ? "收起面板" : "精细过滤"}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-500 ${summaryExpanded ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
              </button>

              <motion.div
                initial={false}
                animate={{ height: summaryExpanded ? "auto" : 0 }}
                className="overflow-hidden"
              >
                <div className="grid gap-6 border-t border-white/5 bg-black/20 px-8 py-8 lg:grid-cols-3">
                  {/* Card 1: Asset Summary */}
                  <div className="relative rounded-[2rem] border border-white/5 bg-white/[0.03] p-6 shadow-inner transition-all hover:bg-white/[0.04]">
                    <p className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">桥梁摘要</p>
                    <div className="grid grid-cols-2 gap-y-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">活跃批次</p>
                        <p className="mt-1 text-xl font-black text-white tabular-nums">{selectedBridge?.active_batch_count ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">异常批次</p>
                        <p className="mt-1 text-xl font-black text-rose-500/80 tabular-nums">{selectedBridge?.abnormal_batch_count ?? 0}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">智能增强策略</p>
                        <div className="mt-2 flex items-center gap-3">
                          <div className={`rounded-xl border px-3 py-1.5 text-xs font-black ${selectedBatch?.enhancement_mode === "off" ? "border-white/10 text-white/40" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"}`}>
                            {selectedBatch?.enhancement_mode === "always" ? "全量增强" : selectedBatch?.enhancement_mode === "off" ? "关闭增强" : "低照度自适应增强"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Filters */}
                  <div className="relative rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 shadow-inner transition-all hover:bg-white/[0.03]">
                    <p className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">检索与过滤</p>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">检测项总数</span>
                        <span className="text-sm font-black text-white tabular-nums">{detections.length}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">置信度过滤 (Confidence)</span>
                        <div className="mt-3 flex gap-2">
                          {["0.0", "0.6", "0.8", "0.9"].map((val) => (
                            <button
                              key={val}
                              onClick={() => setMinConfidence(val)}
                              className={`flex-1 rounded-xl border py-2 text-[10px] font-bold transition-all ${
                                minConfidence === val 
                                  ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]" 
                                  : "border-white/5 bg-white/5 text-white/30 hover:border-white/10 hover:text-white"
                              }`}
                            >
                              {val === "0.0" ? "ALL" : `>${val}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Batch Meta */}
                  <div className="relative rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 shadow-inner transition-all hover:bg-white/[0.03]">
                    <p className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">基础元数据 / 批次详情</p>
                    <div className="space-y-3">
                      {[
                        { label: "已选对比素材", value: selectedItemIds.length, color: "text-amber-400" },
                        { label: "素材过滤状态", value: showFailedItemsOnly ? "仅失败项" : "全部素材", color: "text-white" },
                        { label: "模型推理策略", value: modelPolicy, color: "text-white/60", truncate: true },
                        { label: "数据采集终端", value: sourceDevice, color: "text-white/60" },
                        { label: "当前操作员", value: createdBy, color: "text-white/60" }
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] font-medium leading-relaxed">
                          <span className="text-white/20">{item.label}</span>
                          <span className={`${item.color} ${item.truncate ? "max-w-[120px] truncate pl-4" : ""}`}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </section>


            <ItemGrid 
              items={visibleItems}
              pathFilter={relativePathPrefix}
              onPathFilterChange={setRelativePathPrefix}
              showFailedOnly={showFailedItemsOnly}
              onShowFailedOnlyToggle={() => setShowFailedItemsOnly(!showFailedItemsOnly)}
              onRetryTask={handleRetryBatchItemTask}
              retryingTaskId={retryingTaskId}
              selectedItemIds={selectedItemIds}
              onToggleSelectItem={handleToggleSelectItem}
              onSelectVisibleItems={handleSelectVisibleItems}
              onClearSelection={() => setSelectedItemIds([])}
              onRetrySelectedFailed={handleRetrySelectedFailed}
              batchItemOffset={batchItemOffset}
              batchItemLimit={batchItemLimit}
              batchItemTotal={batchItemTotal}
              onBatchItemPageChange={setBatchItemOffset}
            />
            </motion.div>
          )}
        </AnimatePresence>
        <footer className="border-t border-white/5 bg-white/[0.01] px-4 py-4 rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/40">
              系统存证批次总览 / Count: {batchTotal}
            </div>
          </div>
        </footer>
      </OpsPageLayout>

      {isWizardOpen ? (
        <IngestionWizard
          key={`${selectedBridgeId || "no-bridge"}-${refreshTick}`}
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onFinish={handleWizardFinish}
          selectedBridge={selectedBridge}
          isLoading={actionLoading}
        />
      ) : null}
    </>
  );
}
