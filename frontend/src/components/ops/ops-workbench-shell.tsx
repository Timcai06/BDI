"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createV1Bridge,
  createV1Batch,
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
import type {
  AlertV1,
  BatchItemV1,
  BatchStatsV1Response,
  BatchV1,
  BridgeV1,
  DetectionRecordV1,
  ReviewRecordV1
} from "@/lib/types";

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
      <h3 className="text-sm font-semibold tracking-wide text-white/90 mb-3">{title}</h3>
      {children}
    </section>
  );
}

function countMapToText(map: Record<string, number>): string {
  const entries = Object.entries(map);
  if (entries.length === 0) {
    return "-";
  }
  return entries.map(([k, v]) => `${k}:${v}`).join(" | ");
}

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
  const [ready, setReady] = useState(false);

  const [bridges, setBridges] = useState<BridgeV1[]>([]);
  const [selectedBridgeId, setSelectedBridgeId] = useState("");
  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchOffset, setBatchOffset] = useState(0);
  const batchLimit = 20;
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [batchCode, setBatchCode] = useState("");
  const [bridgeCodeInput, setBridgeCodeInput] = useState("");
  const [bridgeNameInput, setBridgeNameInput] = useState("");
  const [sourceType, setSourceType] = useState("drone_image_stream");
  const [createdBy, setCreatedBy] = useState("ops-user");
  const [expectedItemCount, setExpectedItemCount] = useState("0");
  const [sourceDevice, setSourceDevice] = useState("drone-A");
  const [modelPolicy, setModelPolicy] = useState("fusion-default");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadInputMode, setUploadInputMode] = useState<"files" | "folder">("files");
  const [showFailedItemsOnly, setShowFailedItemsOnly] = useState(false);
  const [relativePathPrefix, setRelativePathPrefix] = useState("");
  const [recentPathPrefixes, setRecentPathPrefixes] = useState<string[]>([]);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);

  const [stats, setStats] = useState<BatchStatsV1Response | null>(null);
  const [items, setItems] = useState<BatchItemV1[]>([]);
  const [detections, setDetections] = useState<DetectionRecordV1[]>([]);
  const [reviews, setReviews] = useState<ReviewRecordV1[]>([]);
  const [alerts, setAlerts] = useState<AlertV1[]>([]);

  const [category, setCategory] = useState("");
  const [minConfidence, setMinConfidence] = useState("0.8");
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
    if (minConfidence && minConfidence !== "0.8") {
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
    let cancelled = false;
    if (!ready || !selectedBatchId) {
      setStats(null);
      setItems([]);
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
          listV1BatchItems(selectedBatchId, 100, 0, relativePathPrefix.trim() || undefined),
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
        setDetections(detectionsResp.items);
        setReviews(reviewsResp.items);
        setAlerts(alertsResp.items);
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

  async function handleCreateBatch() {
    if (!selectedBridgeId || !batchCode.trim()) {
      setError("请选择桥梁并填写 batch_code。");
      return;
    }
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const expected = Number(expectedItemCount || "0");
      const created = await createV1Batch({
        bridgeId: selectedBridgeId,
        batchCode: batchCode.trim(),
        sourceType: sourceType.trim() || "drone_image_stream",
        expectedItemCount: Number.isFinite(expected) ? Math.max(0, Math.floor(expected)) : 0,
        createdBy: createdBy.trim() || undefined
      });
      setNotice(`批次创建成功：${created.batch_code}`);
      setBatchCode("");
      setBatchOffset(0);
      setSelectedBatchId(created.id);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批次创建失败");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateBridge() {
    if (!bridgeCodeInput.trim() || !bridgeNameInput.trim()) {
      setError("请先填写 bridge_code 和 bridge_name。");
      return;
    }
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createV1Bridge({
        bridgeCode: bridgeCodeInput.trim(),
        bridgeName: bridgeNameInput.trim()
      });
      setNotice(`桥梁创建成功：${created.bridge_code} | ${created.bridge_name}`);
      setBridgeCodeInput("");
      setBridgeNameInput("");
      setSelectedBridgeId(created.id);
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "桥梁创建失败");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleIngestItems() {
    if (!selectedBatchId) {
      setError("请先选择批次。");
      return;
    }
    if (uploadFiles.length === 0) {
      setError("请先选择要上传的图片。");
      return;
    }
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const relativePaths = uploadFiles.map((file) => {
        const relativePath = (file as FileWithRelativePath).webkitRelativePath?.trim() ?? "";
        return relativePath;
      });
      const hasRelativePath = relativePaths.some((item) => item.length > 0);
      if (hasRelativePath) {
        setRecentPathPrefixes((current) => mergeRecentPathPrefixes(current, derivePathPrefixesFromItems(relativePaths)));
      }
      const response = await ingestV1BatchItems({
        batchId: selectedBatchId,
        files: uploadFiles,
        relativePaths: hasRelativePath ? relativePaths : undefined,
        modelPolicy: modelPolicy.trim() || "fusion-default",
        sourceDevice: sourceDevice.trim() || undefined
      });
      setNotice(`上传完成：accepted=${response.accepted_count}, rejected=${response.rejected_count}`);
      setUploadFiles([]);
      setUploadInputMode("files");
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批次图片上传失败");
    } finally {
      setActionLoading(false);
    }
  }

  function normalizeSelectedFiles(fileList: FileList | null): File[] {
    if (!fileList) {
      return [];
    }
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    return Array.from(fileList).filter((file) => {
      if (allowed.has(file.type)) {
        return true;
      }
      const lower = file.name.toLowerCase();
      return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp");
    });
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

  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-white">巡检工作台</h1>
          <p className="text-sm text-white/60 mt-1">批次详情、病害检索、复核与告警联动</p>
        </div>
        <Link
          href="/dashboard/ops/alerts"
          className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs tracking-wider text-cyan-200 hover:bg-cyan-300/20"
        >
          告警中心
        </Link>
      </header>

      <SectionCard title="批次选择">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
          <div className="rounded border border-white/10 bg-black/20 p-3 space-y-2">
            <p className="text-xs text-white/60">先创建桥梁（无可选项时）</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={bridgeCodeInput}
                onChange={(e) => setBridgeCodeInput(e.target.value)}
                placeholder="bridge_code (e.g. BR-001)"
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
              <input
                value={bridgeNameInput}
                onChange={(e) => setBridgeNameInput(e.target.value)}
                placeholder="bridge_name (e.g. 北江大桥)"
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
            </div>
            <button
              onClick={handleCreateBridge}
              disabled={actionLoading}
              className="rounded border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/80 disabled:opacity-40"
            >
              创建桥梁并选中
            </button>
            <div className="h-px bg-white/10 my-1" />
            <p className="text-xs text-white/60">新建批次</p>
            <select
              value={selectedBridgeId}
              onChange={(e) => setSelectedBridgeId(e.target.value)}
              className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
            >
              <option value="">选择桥梁</option>
              {bridges.map((bridge) => (
                <option key={bridge.id} value={bridge.id}>
                  {bridge.bridge_code} | {bridge.bridge_name}
                </option>
              ))}
            </select>
            <input
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              placeholder="batch_code (e.g. B20260401-001)"
              className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                placeholder="source_type"
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
              <input
                value={expectedItemCount}
                onChange={(e) => setExpectedItemCount(e.target.value)}
                placeholder="expected_item_count"
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
            </div>
            <input
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="created_by"
              className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
            />
            <button
              onClick={handleCreateBatch}
              disabled={actionLoading}
              className="rounded border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40"
            >
              创建批次
            </button>
          </div>

          <div className="rounded border border-white/10 bg-black/20 p-3 space-y-2">
            <p className="text-xs text-white/60">批量上传并自动入队</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUploadInputMode("files")}
                className={`rounded border px-2 py-2 text-xs ${
                  uploadInputMode === "files"
                    ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                    : "border-white/15 bg-black/30 text-white/70"
                }`}
              >
                选择文件
              </button>
              <button
                type="button"
                onClick={() => setUploadInputMode("folder")}
                className={`rounded border px-2 py-2 text-xs ${
                  uploadInputMode === "folder"
                    ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                    : "border-white/15 bg-black/30 text-white/70"
                }`}
              >
                选择文件夹
              </button>
            </div>
            <input
              key={`upload-${uploadInputMode}`}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              {...(uploadInputMode === "folder"
                ? ({ webkitdirectory: "", directory: "" } as unknown as Record<string, string>)
                : {})}
              onChange={(e) => setUploadFiles(normalizeSelectedFiles(e.target.files))}
              className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
            />
            <p className="text-[11px] text-white/45">
              {uploadInputMode === "folder"
                ? "文件夹模式：会自动扫描子目录中的图片并批量入队。"
                : "文件模式：手动多选图片后批量入队。"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={modelPolicy}
                onChange={(e) => setModelPolicy(e.target.value)}
                placeholder="model_policy"
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
              <input
                value={sourceDevice}
                onChange={(e) => setSourceDevice(e.target.value)}
                placeholder="source_device"
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
            </div>
            <p className="text-xs text-white/50">已选文件: {uploadFiles.length}</p>
            <button
              onClick={handleIngestItems}
              disabled={actionLoading || uploadFiles.length === 0 || !selectedBatchId}
              className="rounded border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-200 disabled:opacity-40"
            >
              上传到当前批次
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">请选择批次</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batch_code} ({batch.status})
              </option>
            ))}
          </select>
          {selectedBatch && (
            <p className="text-xs text-white/60">
              source={selectedBatch.source_type} | received={selectedBatch.received_item_count} | succeeded={selectedBatch.succeeded_item_count} | failed={selectedBatch.failed_item_count}
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <button
            disabled={!canPrevBatchPage}
            onClick={() => setBatchOffset((prev) => Math.max(0, prev - batchLimit))}
            className="rounded border border-white/20 px-2 py-1 text-white/80 disabled:opacity-40"
          >
            上一页
          </button>
          <button
            disabled={!canNextBatchPage}
            onClick={() => setBatchOffset((prev) => prev + batchLimit)}
            className="rounded border border-white/20 px-2 py-1 text-white/80 disabled:opacity-40"
          >
            下一页
          </button>
          <span className="text-white/50">page {currentBatchPage}/{totalBatchPages}</span>
          <span className="text-white/40">total={batchTotal}</span>
        </div>
      </SectionCard>

      {error && (
        <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</div>
      )}

      {loading ? (
        <div className="text-sm text-white/60">加载中...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="批次统计">
              <div className="space-y-2 text-xs text-white/80">
                <div>status: {countMapToText(stats?.status_breakdown ?? {})}</div>
                <div>review: {countMapToText(stats?.review_breakdown ?? {})}</div>
                <div>category: {countMapToText(stats?.category_breakdown ?? {})}</div>
                <div>alert: {countMapToText(stats?.alert_breakdown ?? {})}</div>
              </div>
            </SectionCard>

            <SectionCard title="批次图片">
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-white/50">
                  显示 {visibleItems.length}/{items.length} 项
                </span>
                <div className="flex items-center gap-2">
                  <input
                    value={relativePathPrefix}
                    onChange={(e) => setRelativePathPrefix(e.target.value)}
                    placeholder="按目录前缀过滤，例如 bridge-A/segment-01"
                    className="w-56 rounded border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setRelativePathPrefix("")}
                    disabled={!relativePathPrefix}
                    className="rounded border border-white/20 px-2 py-1 text-white/80 hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    清空筛选
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFailedItemsOnly((prev) => !prev)}
                    className="rounded border border-white/20 px-2 py-1 text-white/80 hover:bg-white/[0.06]"
                  >
                    {showFailedItemsOnly ? "显示全部" : "仅看失败项"}
                  </button>
                </div>
              </div>
              {recentPathPrefixes.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-white/45">最近目录:</span>
                  {recentPathPrefixes.map((prefix) => (
                    <button
                      key={prefix}
                      type="button"
                      onClick={() => setRelativePathPrefix(prefix)}
                      className={`rounded border px-2 py-1 ${
                        relativePathPrefix === prefix
                          ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                          : "border-white/15 bg-black/30 text-white/70 hover:bg-white/[0.06]"
                      }`}
                    >
                      {prefix}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-56 overflow-auto space-y-2">
                {visibleItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/ops/items/${encodeURIComponent(item.id)}`}
                          className="hover:text-cyan-200"
                        >
                          #{item.sequence_no} | {item.processing_status} | defects={item.defect_count} | review={item.review_status} | alert={item.alert_status}
                        </Link>
                        <div className="mt-1 truncate text-[11px] text-white/55">
                          路径: {item.source_relative_path || "(未提供目录路径)"}
                        </div>
                      </div>
                      {item.processing_status === "failed" && item.latest_task_id && (
                        <button
                          type="button"
                          onClick={() => {
                            void handleRetryBatchItemTask(item.latest_task_id as string);
                          }}
                          disabled={retryingTaskId === item.latest_task_id}
                          className="rounded border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[11px] text-amber-100 disabled:opacity-40"
                        >
                          {retryingTaskId === item.latest_task_id ? "重试中..." : "重试任务"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {visibleItems.length === 0 && <div className="text-xs text-white/50">暂无图片数据</div>}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="病害检索（detections）">
            <div className="mb-3 grid grid-cols-1 lg:grid-cols-5 gap-2 text-xs">
              <input
                placeholder="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <input
                placeholder="min_confidence"
                value={minConfidence}
                onChange={(e) => setMinConfidence(e.target.value)}
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <select
                value={detectionSortBy}
                onChange={(e) => setDetectionSortBy(e.target.value as "created_at" | "confidence" | "area_mm2")}
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              >
                <option value="created_at">created_at</option>
                <option value="confidence">confidence</option>
                <option value="area_mm2">area_mm2</option>
              </select>
              <select
                value={detectionSortOrder}
                onChange={(e) => setDetectionSortOrder(e.target.value as "asc" | "desc")}
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              >
                <option value="desc">desc</option>
                <option value="asc">asc</option>
              </select>
              <div className="text-white/50 px-1 py-2">total={detections.length}</div>
            </div>
            <div className="max-h-64 overflow-auto space-y-2">
              {detections.map((det) => (
                <div key={det.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs text-white/80">
                  {det.category} | conf={det.confidence.toFixed(3)} | area={det.area_mm2 ?? "-"} | valid={String(det.is_valid)}
                </div>
              ))}
              {detections.length === 0 && <div className="text-xs text-white/50">暂无病害记录</div>}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="复核记录（reviews）">
              <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                <select
                  value={reviewSortBy}
                  onChange={(e) => setReviewSortBy(e.target.value as "reviewed_at" | "created_at")}
                  className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
                >
                  <option value="reviewed_at">reviewed_at</option>
                  <option value="created_at">created_at</option>
                </select>
                <select
                  value={reviewSortOrder}
                  onChange={(e) => setReviewSortOrder(e.target.value as "asc" | "desc")}
                  className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
                >
                  <option value="desc">desc</option>
                  <option value="asc">asc</option>
                </select>
              </div>
              <div className="max-h-64 overflow-auto space-y-2">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs text-white/80">
                    {review.review_action} {"->"} {review.review_decision} | by={review.reviewer}
                  </div>
                ))}
                {reviews.length === 0 && <div className="text-xs text-white/50">暂无复核记录</div>}
              </div>
            </SectionCard>

            <SectionCard title="告警记录（alerts）">
              <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                <select
                  value={alertStatusFilter}
                  onChange={(e) => setAlertStatusFilter(e.target.value)}
                  className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
                >
                  <option value="">all status</option>
                  <option value="open">open</option>
                  <option value="acknowledged">acknowledged</option>
                  <option value="resolved">resolved</option>
                </select>
                <select
                  value={alertSortBy}
                  onChange={(e) =>
                    setAlertSortBy(e.target.value as "triggered_at" | "created_at" | "updated_at")
                  }
                  className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
                >
                  <option value="triggered_at">triggered_at</option>
                  <option value="created_at">created_at</option>
                  <option value="updated_at">updated_at</option>
                </select>
                <select
                  value={alertSortOrder}
                  onChange={(e) => setAlertSortOrder(e.target.value as "asc" | "desc")}
                  className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
                >
                  <option value="desc">desc</option>
                  <option value="asc">asc</option>
                </select>
              </div>
              <div className="max-h-64 overflow-auto space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs text-white/80">
                    {alert.title} | {alert.event_type} | {alert.alert_level} | {alert.status}
                  </div>
                ))}
                {alerts.length === 0 && <div className="text-xs text-white/50">暂无告警记录</div>}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
