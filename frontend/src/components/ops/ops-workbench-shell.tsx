"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

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
import { OpsPageLayout } from "./ops-page-layout";
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
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.16)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">第一层 / 桥梁资产</p>
                <p className="mt-1 text-sm text-white/45">先选择桥梁资产，再进入该桥下的批次工作流。</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/bridges"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                >
                  资产列表
                </Link>
                {selectedBridge ? (
                  <Link
                    href={`/dashboard/bridges/${encodeURIComponent(selectedBridge.id)}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    资产详情
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="rounded-xl border border-white/10 bg-black/30 px-2">
                <select
                  value={selectedBridgeId}
                  onChange={(e) => setSelectedBridgeId(e.target.value)}
                  className="h-12 w-full bg-transparent px-2 text-sm font-bold text-white outline-none"
                >
                  <option value="">选择桥梁资产...</option>
                  {bridges.map((bridge) => (
                    <option key={bridge.id} value={bridge.id}>
                      {bridge.bridge_code} | {bridge.bridge_name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => router.push("/dashboard/bridges")}
                className="h-12 rounded-xl bg-cyan-500 px-4 text-xs font-bold text-black hover:bg-cyan-400"
              >
                新建桥梁资产
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.16)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">第二层 / 批次工作台</p>
                <p className="mt-1 text-sm text-white/45">批次只属于当前桥梁资产，新建和切换都在这一层完成。</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedBatch ? (
                  <button
                    onClick={handleDeleteCurrentBatch}
                    disabled={deletingBatch}
                    className="h-12 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 text-xs font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
                  >
                    {deletingBatch ? "删除中..." : "删除批次"}
                  </button>
                ) : null}
                <button
                  onClick={() => setIsWizardOpen(true)}
                  disabled={!selectedBridgeId}
                  className="h-12 rounded-xl bg-cyan-500 px-4 text-xs font-bold text-black hover:bg-cyan-400 disabled:opacity-40"
                >
                  新建批次
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 px-2">
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="h-12 w-full bg-transparent px-2 text-sm font-bold text-white outline-none"
              >
                <option value="">{selectedBridgeId ? "选择当前桥梁的批次..." : "请先选择桥梁资产..."}</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_code} ({batch.status})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

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
        {loading && !lastRefreshedAt && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-white/45">
            正在刷新批次状态与任务结果...
          </div>
        )}

        {!selectedBatchId ? (
          <BatchEmptyState
            onCreateClick={() => setIsWizardOpen(true)}
            hasSelectedBridge={Boolean(selectedBridgeId)}
            onOpenBridgeAssets={() => router.push("/dashboard/bridges")}
          />
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setSummaryExpanded((value) => !value)}
                className="flex w-full flex-wrap items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
              >
                <div className="grid flex-1 gap-3 md:grid-cols-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">当前桥梁</p>
                    <p className="mt-1 text-sm font-black text-white">{selectedBridge?.bridge_name ?? "-"}</p>
                    <p className="text-xs text-white/45">{selectedBridge?.bridge_code ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">当前批次</p>
                    <p className="mt-1 text-sm font-black text-white">{selectedBatch?.batch_code ?? "-"}</p>
                    <p className="text-xs text-white/45">{selectedBatch?.status ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">处理状态</p>
                    <p className="mt-1 text-sm font-black text-white">
                      Q {queuedCount} / R {runningCount} / S {succeededCount} / F {failedCount}
                    </p>
                    <p className="text-xs text-white/45">{batchItemTotal} 项素材</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">业务状态</p>
                    <p className="mt-1 text-sm font-black text-white">
                      病害 {defectCount} / 复核 {reviewCount}
                    </p>
                    <p className="text-xs text-white/45">告警 {alertCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">展开详情</p>
                    <p className="mt-1 text-sm font-black text-white">{summaryExpanded ? "收起总览" : "查看过滤与策略"}</p>
                    <p className="text-xs text-white/45">点击切换</p>
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                  {summaryExpanded ? "expanded" : "collapsed"}
                </div>
              </button>

              {summaryExpanded ? (
                <div className="grid gap-6 border-t border-white/5 px-5 py-5 lg:grid-cols-[1.2fr_1fr_1fr]">
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">状态与桥梁摘要</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/20">活跃批次</p>
                        <p className="mt-1 text-sm font-black text-white">{selectedBridge?.active_batch_count ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/20">异常批次</p>
                        <p className="mt-1 text-sm font-black text-white">{selectedBridge?.abnormal_batch_count ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/20">增强策略</p>
                        <p className="mt-1 text-sm font-black text-white">
                          {selectedBatch?.enhancement_mode === "always" ? "全量增强" : selectedBatch?.enhancement_mode === "off" ? "关闭增强" : "低照度自动增强"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/20">总素材</p>
                        <p className="mt-1 text-sm font-black text-white">{batchItemTotal}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">过滤与检索</p>
                    <div className="mt-4 space-y-4">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-white/40">Detections</span>
                        <span className="tabular-nums text-white/80">{detections.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-white/40">Confidence</span>
                        <span className="font-bold text-cyan-400">{minConfidence}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setMinConfidence("0.0")}
                          className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                            minConfidence === "0.0"
                              ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-200"
                              : "border-white/5 bg-white/5 text-white/40 hover:border-white/10 hover:text-white/60"
                          }`}
                        >
                          全部
                        </button>
                        <button
                          onClick={() => setMinConfidence("0.8")}
                          className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                            minConfidence === "0.8"
                              ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-200"
                              : "border-white/5 bg-white/5 text-white/40 hover:border-white/10 hover:text-white/60"
                          }`}
                        >
                          高置信
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">批量动作与策略</p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-white/40">Selected</span>
                        <span className="font-bold tabular-nums text-amber-400">{selectedItemIds.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-white/40">Failed Filter</span>
                        <span className="text-white/80">{showFailedItemsOnly ? "仅失败项" : "全部素材"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-white/40">Model Policy</span>
                        <span className="truncate pl-4 text-white/80">{modelPolicy}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-white/40">Collector</span>
                        <span className="text-white/80">{sourceDevice}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-white/40">Operator</span>
                        <span className="text-white/80">{createdBy}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
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
          </div>
        )}
        <footer className="border-t border-white/5 bg-white/[0.01] px-4 py-4 rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/50">
              Total batches {batchTotal}
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
