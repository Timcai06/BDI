"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import {
  createV1Bridge,
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
import { BatchAnalytics } from "./batch-analytics";
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
    const offset = Number(searchParams.get("batchOffset") ?? "0");
    const urlCategory = searchParams.get("category");
    const urlMinConfidence = searchParams.get("minConfidence");
    const urlDetSortBy = searchParams.get("dSortBy");
    const urlDetSortOrder = searchParams.get("dSortOrder");
    const urlPathPrefix = searchParams.get("pathPrefix");

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
          listV1Batches(batchLimit, batchOffset),
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
  }, [ready, batchOffset, refreshTick]);

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

  useEffect(() => {
    setBatchItemOffset(0);
    setSelectedItemIds([]);
  }, [selectedBatchId, relativePathPrefix, showFailedItemsOnly]);

  async function handleCreateBatch(bridgeId: string, payload: { batchCode: string; sourceType: string; expectedItemCount: number; createdBy?: string }) {
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createV1Batch({
        bridgeId,
        batchCode: payload.batchCode.trim(),
        sourceType: payload.sourceType || "drone_image_stream",
        expectedItemCount: payload.expectedItemCount,
        createdBy: payload.createdBy || createdBy
      });
      setNotice(`批次创建成功：${created.batch_code}`);
      setBatchOffset(0);
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

  async function handleCreateBridge(code: string, name: string) {
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createV1Bridge({
        bridgeCode: code.trim(),
        bridgeName: name.trim()
      });
      setNotice(`桥梁创建成功：${created.bridge_code} | ${created.bridge_name}`);
      setSelectedBridgeId(created.id);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "桥梁创建失败");
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
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.16)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Batch
            </span>
            <div className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-black/30 px-2">
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full bg-transparent px-2 py-2 text-sm font-bold text-white outline-none"
              >
                <option value="">快速切换批次...</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_code} ({batch.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {selectedBatch ? (
                <button
                  onClick={handleDeleteCurrentBatch}
                  disabled={deletingBatch}
                  aria-label={deletingBatch ? "正在删除批次" : "删除当前批次"}
                  title={deletingBatch ? "正在删除批次" : "删除当前批次"}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 transition-all hover:bg-rose-500/20 disabled:opacity-30"
                >
                  {deletingBatch ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="9" strokeWidth="2.5" className="opacity-30" />
                      <path d="M21 12a9 9 0 0 1-9 9" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 7h12M9 7v-.8A1.2 1.2 0 0110.2 5h3.6A1.2 1.2 0 0115 6.2V7m-8 0l.7 11a1.2 1.2 0 001.2 1.1h6.2a1.2 1.2 0 001.2-1.1L17 7" />
                    </svg>
                  )}
                </button>
              ) : null}
              <button
                onClick={() => setIsWizardOpen(true)}
                aria-label="新建批次"
                title="新建批次"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500 text-black transition-all hover:bg-cyan-400 active:scale-95"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 5v14m-7-7h14" />
                </svg>
              </button>
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
          <BatchEmptyState onCreateClick={() => setIsWizardOpen(true)} />
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <BatchAnalytics stats={stats} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Filter Panel */}
              <div className="lg:col-span-1 p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-white/20 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 group-hover:text-cyan-400/60 transition-colors">检测检索</p>
                  <svg className="h-3.5 w-3.5 text-white/10 group-hover:text-cyan-400/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-white/40">Detections</span>
                    <span className="text-white/80 tabular-nums">{detections.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-white/40">Confidence</span>
                    <span className="text-cyan-400 font-bold">{minConfidence}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => setMinConfidence("0.0")}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        minConfidence === "0.0"
                          ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-200"
                          : "border-white/5 bg-white/5 text-white/40 hover:text-white/60 hover:border-white/10"
                      }`}
                    >
                      全部
                    </button>
                    <button
                      onClick={() => setMinConfidence("0.8")}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        minConfidence === "0.8"
                          ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-200"
                          : "border-white/5 bg-white/5 text-white/40 hover:text-white/60 hover:border-white/10"
                      }`}
                    >
                      高置信
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Statistics */}
              <div className="lg:col-span-1 p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-white/20 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 group-hover:text-amber-400/60 transition-colors">批量动作</p>
                  <svg className="h-3.5 w-3.5 text-white/10 group-hover:text-amber-400/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-white/40">Selected</span>
                    <span className="text-amber-400 font-bold tabular-nums">{selectedItemIds.length}</span>
                  </div>
                  <p className="text-[10px] text-white/20 leading-relaxed italic">支持按页选择并批量重试。优先处理失败项以保持流水线畅通。</p>
                </div>
              </div>

              {/* Scheduler & Policy */}
              <div className="lg:col-span-2 p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-white/20 transition-all group relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 group-hover:text-emerald-400/60 transition-colors">调度状态与核心策略</p>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-white/20 uppercase font-bold tracking-tighter">Model Policy</p>
                    <p className="text-xs font-bold text-white/70 mt-0.5 truncate">{modelPolicy}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/20 uppercase font-bold tracking-tighter">Collector</p>
                    <p className="text-xs font-bold text-white/70 mt-0.5 truncate">{sourceDevice}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/20 uppercase font-bold tracking-tighter">Operator</p>
                    <p className="text-xs font-bold text-white/70 mt-0.5 truncate">{createdBy}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/20 uppercase font-bold tracking-tighter">Total Items</p>
                    <p className="text-xs font-bold text-white/70 mt-0.5 tabular-nums">{batchItemTotal}</p>
                  </div>
                </div>
                {/* Background accent */}
                <div className="absolute -bottom-6 -right-6 h-20 w-20 bg-emerald-500/5 blur-2xl rounded-full pointer-events-none" />
              </div>
            </div>

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

      <IngestionWizard 
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        bridges={bridges}
        onCreateBridge={handleCreateBridge}
        onFinish={handleWizardFinish}
        selectedBridgeId={selectedBridgeId}
        onSelectedBridgeChange={setSelectedBridgeId}
        isLoading={actionLoading}
      />
    </>
  );
}
