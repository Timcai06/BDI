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
  listV1Alerts,
  listV1BatchItems,
  listV1Batches,
  listV1Bridges,
  listV1Detections,
  listV1Reviews,
  retryV1Task
} from "@/lib/predict-client";
import { BatchHeader } from "./batch-header";
import { BatchAnalytics } from "./batch-analytics";
import { ItemGrid } from "./item-grid";
import { IngestionWizard } from "./ingestion-wizard";
import type { BatchWizardPayload } from "./ingestion-wizard";
import { BatchEmptyState } from "./batch-empty-state";
import type {
  AlertV1,
  BatchItemV1,
  BatchStatsV1Response,
  BatchV1,
  BridgeV1,
  DetectionRecordV1,
  ReviewRecordV1
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
  const [reviews, setReviews] = useState<ReviewRecordV1[]>([]);
  const [alerts, setAlerts] = useState<AlertV1[]>([]);

  const [category, setCategory] = useState("");
  const [minConfidence, setMinConfidence] = useState("0.0");
  const [detectionSortBy, setDetectionSortBy] = useState<"created_at" | "confidence" | "area_mm2">("created_at");
  const [detectionSortOrder, setDetectionSortOrder] = useState<"asc" | "desc">("desc");

  const [reviewSortBy, setReviewSortBy] = useState<"reviewed_at" | "created_at">("reviewed_at");
  const [reviewSortOrder, setReviewSortOrder] = useState<"asc" | "desc">("desc");

  const [alertStatusFilter, setAlertStatusFilter] = useState("");
  const [alertSortBy, setAlertSortBy] = useState<"triggered_at" | "created_at" | "updated_at">("triggered_at");
  const [alertSortOrder, setAlertSortOrder] = useState<"asc" | "desc">("desc");

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
    const urlReviewSortBy = searchParams.get("rSortBy");
    const urlReviewSortOrder = searchParams.get("rSortOrder");
    const urlAlertStatus = searchParams.get("aStatus");
    const urlAlertSortBy = searchParams.get("aSortBy");
    const urlAlertSortOrder = searchParams.get("aSortOrder");
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
    if (urlReviewSortBy === "reviewed_at" || urlReviewSortBy === "created_at") {
      setReviewSortBy(urlReviewSortBy);
    }
    if (urlReviewSortOrder === "asc" || urlReviewSortOrder === "desc") {
      setReviewSortOrder(urlReviewSortOrder);
    }
    if (urlAlertStatus !== null) {
      setAlertStatusFilter(urlAlertStatus);
    }
    if (urlAlertSortBy === "triggered_at" || urlAlertSortBy === "created_at" || urlAlertSortBy === "updated_at") {
      setAlertSortBy(urlAlertSortBy);
    }
    if (urlAlertSortOrder === "asc" || urlAlertSortOrder === "desc") {
      setAlertSortOrder(urlAlertSortOrder);
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
    if (reviewSortBy !== "reviewed_at") {
      next.set("rSortBy", reviewSortBy);
    }
    if (reviewSortOrder !== "desc") {
      next.set("rSortOrder", reviewSortOrder);
    }
    if (alertStatusFilter) {
      next.set("aStatus", alertStatusFilter);
    }
    if (alertSortBy !== "triggered_at") {
      next.set("aSortBy", alertSortBy);
    }
    if (alertSortOrder !== "desc") {
      next.set("aSortOrder", alertSortOrder);
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
    reviewSortBy,
    reviewSortOrder,
    alertStatusFilter,
    alertSortBy,
    alertSortOrder,
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
      setReviews([]);
      setAlerts([]);
      return;
    }

    async function loadBatchPanels() {
      setLoading(true);
      setError(null);
      try {
        const [statsResp, itemsResp, detectionsResp, reviewsResp, alertsResp] = await Promise.all([
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
          }),
          listV1Reviews({
            batchId: selectedBatchId,
            sortBy: reviewSortBy,
            sortOrder: reviewSortOrder,
            limit: 100,
            offset: 0
          }),
          listV1Alerts({
            batchId: selectedBatchId,
            statusFilter: alertStatusFilter || undefined,
            sortBy: alertSortBy,
            sortOrder: alertSortOrder,
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
        setReviews(reviewsResp.items);
        setAlerts(alertsResp.items);
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
    reviewSortBy,
    reviewSortOrder,
    alertStatusFilter,
    alertSortBy,
    alertSortOrder,
    relativePathPrefix,
    batchItemOffset,
    refreshTick
  ]);

  const selectedBatch = useMemo(
    () => batches.find((item) => item.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );
  const currentBatchPage = Math.floor(batchOffset / batchLimit) + 1;
  const totalBatchPages = Math.max(1, Math.ceil(batchTotal / batchLimit));
  const canPrevBatchPage = batchOffset > 0;
  const canNextBatchPage = batchOffset + batchLimit < batchTotal;

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
    <div className="relative z-10 flex flex-1 flex-col bg-transparent overflow-hidden">
      <BatchHeader 
        batch={selectedBatch} 
        onOpenWizard={() => setIsWizardOpen(true)} 
        onRefresh={() => setRefreshTick(v => v + 1)}
        onDeleteBatch={handleDeleteCurrentBatch}
        deletingBatch={deletingBatch}
        lastRefreshedAt={lastRefreshedAt}
      />

      <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8">
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
          <div className="space-y-8">
            <BatchAnalytics stats={stats} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 text-sm text-white/70">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">检索面板</p>
                <p className="mt-2">Detections: {detections.length}</p>
                <p>Reviews: {reviews.length}</p>
                <p>Alerts: {alerts.length}</p>
                <p>Min Confidence: {minConfidence}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setMinConfidence("0.0")}
                    className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                      minConfidence === "0.0"
                        ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-200"
                        : "border-white/10 bg-white/5 text-white/60"
                    }`}
                  >
                    全部结果
                  </button>
                  <button
                    onClick={() => setMinConfidence("0.8")}
                    className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                      minConfidence === "0.8"
                        ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-200"
                        : "border-white/10 bg-white/5 text-white/60"
                    }`}
                  >
                    高置信
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 text-sm text-white/70">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">批量动作</p>
                <p className="mt-2">当前已选择 {selectedItemIds.length} 项。</p>
                <p>支持按页选择、只看异常项、批量重试失败任务。</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 text-sm text-white/70">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">调度状态</p>
                <p className="mt-2">模型策略：{modelPolicy}</p>
                <p>采集设备：{sourceDevice}</p>
                <p>批次创建人：{createdBy}</p>
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
      </main>

      <footer className="border-t border-white/5 bg-white/[0.01] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/30"
            >
              <option value="">快速切换批次...</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_code} ({batch.status})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
            <button
              disabled={!canPrevBatchPage}
              onClick={() => setBatchOffset((prev) => Math.max(0, prev - batchLimit))}
              className="text-white/40 hover:text-white disabled:opacity-20"
            >
              PREV
            </button>
            <span className="text-cyan-500/50">PAGE {currentBatchPage} / {totalBatchPages}</span>
            <button
              disabled={!canNextBatchPage}
              onClick={() => setBatchOffset((prev) => prev + batchLimit)}
              className="text-white/40 hover:text-white disabled:opacity-20"
            >
              NEXT
            </button>
          </div>
        </div>
      </footer>

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
    </div>
  );
}
