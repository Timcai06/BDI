"use client";

import {
  createV1Batch,
  deleteV1Batch,
  getV1Task,
  ingestV1BatchItems,
  retryV1Task
} from "@/lib/predict-client";
import type { BatchItemV1, BatchV1 } from "@/lib/types";
import type { BatchWizardPayload } from "./ingestion-wizard";

type FileWithRelativePath = File & { webkitRelativePath?: string };

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

export function useOpsWorkbenchActions(params: {
  batches: BatchV1[];
  createdBy: string;
  currentEnhancementMode: "off" | "auto" | "always";
  items: BatchItemV1[];
  modelPolicy: string;
  selectedBatch: BatchV1 | null;
  selectedBatchId: string;
  selectedItemIds: string[];
  setActionLoading: (value: boolean) => void;
  setBatchItemOffset: (value: number) => void;
  setBatchOffset: (value: number) => void;
  setCurrentEnhancementMode: (value: "off" | "auto" | "always") => void;
  setDeletingBatch: (value: boolean) => void;
  setError: (value: string | null) => void;
  setIsWizardOpen: (value: boolean) => void;
  setNotice: (value: string | null) => void;
  setRecentPathPrefixes: (updater: (current: string[]) => string[]) => void;
  setRefreshTick: (updater: (value: number) => number) => void;
  setRetryingTaskId: (value: string | null) => void;
  setSelectedBatchId: (value: string) => void;
  setSelectedBridgeId: (value: string) => void;
  setSelectedItemIds: (value: string[] | ((current: string[]) => string[])) => void;
  sourceDevice: string;
  visibleItems: BatchItemV1[];
}) {
  const {
    batches,
    createdBy,
    currentEnhancementMode,
    items,
    modelPolicy,
    selectedBatch,
    selectedBatchId,
    selectedItemIds,
    setActionLoading,
    setBatchItemOffset,
    setBatchOffset,
    setCurrentEnhancementMode,
    setDeletingBatch,
    setError,
    setIsWizardOpen,
    setNotice,
    setRecentPathPrefixes,
    setRefreshTick,
    setRetryingTaskId,
    setSelectedBatchId,
    setSelectedBridgeId,
    setSelectedItemIds,
    sourceDevice,
    visibleItems
  } = params;

  async function handleCreateBatch(
    bridgeId: string,
    payload: {
      sourceType: string;
      expectedItemCount: number;
      createdBy?: string;
      inspectionLabel?: string;
      enhancementMode: "off" | "auto" | "always";
    }
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
        enhancementMode: payload.enhancementMode
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

  return {
    handleCreateBatch,
    handleDeleteCurrentBatch,
    handleIngestItems,
    handleRetryBatchItemTask,
    handleRetrySelectedFailed,
    handleSelectVisibleItems,
    handleToggleSelectItem,
    handleWizardFinish
  };
}
