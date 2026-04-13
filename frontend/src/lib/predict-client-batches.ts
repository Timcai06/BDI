import type {
  BatchDeleteV1Response,
  BatchIngestV1Response,
  BatchItemDetailV1Response,
  BatchItemListV1Response,
  BatchItemResultV1Response,
  BatchListV1Response,
  BatchStatsV1Response,
  TaskRetryV1Response,
  TaskV1,
} from "@/lib/types";
import {
  API_BASE_URL,
  PREDICT_TIMEOUT_MS,
  apiDelete,
  apiGet,
  apiPost,
  buildQuery,
  fetchWithTimeout,
  readErrorMessage,
} from "@/lib/predict-client-base";

export async function listV1Batches(params?: {
  limit?: number;
  offset?: number;
  bridgeId?: string;
  statusFilter?: string;
  hasFailures?: boolean;
}): Promise<BatchListV1Response> {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  const query = buildQuery({
    limit,
    offset,
    bridge_id: params?.bridgeId,
    status_filter: params?.statusFilter,
    has_failures: params?.hasFailures,
  });
  return apiGet(`/api/v1/batches${query}`, { items: [], total: 0, limit, offset }, "批次列表加载失败。");
}

export async function createV1Batch(payload: {
  bridgeId: string;
  sourceType: string;
  expectedItemCount: number;
  createdBy?: string;
  inspectionLabel?: string;
  enhancementMode?: "off" | "auto" | "always";
  batchCode?: string;
}): Promise<BatchListV1Response["items"][number]> {
  return apiPost(
    "/api/v1/batches",
    {
      bridge_id: payload.bridgeId,
      batch_code: payload.batchCode ?? null,
      source_type: payload.sourceType,
      expected_item_count: payload.expectedItemCount,
      created_by: payload.createdBy ?? null,
      inspection_label: payload.inspectionLabel ?? null,
      enhancement_mode: payload.enhancementMode ?? "always",
    },
    "批次创建失败。",
    "演示模式下无法创建批次。",
  );
}

export async function deleteV1Batch(batchId: string): Promise<BatchDeleteV1Response> {
  return apiDelete(`/api/v1/batches/${encodeURIComponent(batchId)}`, "批次删除失败。", "演示模式下无法删除批次。");
}

export async function ingestV1BatchItems(payload: {
  batchId: string;
  files: File[];
  relativePaths?: string[];
  modelPolicy?: string;
  enhancementMode?: "off" | "auto" | "always";
  sourceDevice?: string;
  capturedAt?: string;
}): Promise<BatchIngestV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法上传批次图片。");
  }
  const formData = new FormData();
  payload.files.forEach((file) => formData.append("files", file));
  payload.relativePaths?.forEach((relativePath) => formData.append("relative_paths", relativePath));
  formData.append("model_policy", payload.modelPolicy ?? "fusion-default");
  formData.append("enhancement_mode", payload.enhancementMode ?? "always");
  if (payload.sourceDevice) formData.append("source_device", payload.sourceDevice);
  if (payload.capturedAt) formData.append("captured_at", payload.capturedAt);

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/batches/${encodeURIComponent(payload.batchId)}/items`,
    { method: "POST", body: formData, timeoutMs: PREDICT_TIMEOUT_MS },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "批次图片上传失败。"));
  }
  return (await response.json()) as BatchIngestV1Response;
}

export async function getV1BatchStats(batchId: string): Promise<BatchStatsV1Response> {
  return apiGet(
    `/api/v1/batches/${encodeURIComponent(batchId)}/stats`,
    { batch_id: batchId, status_breakdown: {}, review_breakdown: {}, category_breakdown: {}, alert_breakdown: {} },
    "批次统计加载失败。",
  );
}

export async function listV1BatchItems(
  batchId: string,
  limit: number = 50,
  offset: number = 0,
  relativePathPrefix?: string,
): Promise<BatchItemListV1Response> {
  const query = buildQuery({
    limit,
    offset,
    relative_path_prefix: relativePathPrefix || undefined,
  });
  return apiGet(
    `/api/v1/batches/${encodeURIComponent(batchId)}/items${query}`,
    { items: [], total: 0, limit, offset },
    "批次图片列表加载失败。",
  );
}

export async function getV1BatchItemDetail(batchItemId: string): Promise<BatchItemDetailV1Response> {
  return apiGet(
    `/api/v1/batch-items/${encodeURIComponent(batchItemId)}`,
    null as never,
    "图片详情加载失败。",
  );
}

export async function getV1BatchItemResult(batchItemId: string): Promise<BatchItemResultV1Response> {
  return apiGet(
    `/api/v1/batch-items/${encodeURIComponent(batchItemId)}/result`,
    null as never,
    "图片识别结果加载失败。",
  );
}

export async function getV1Task(taskId: string): Promise<TaskV1> {
  return apiGet(
    `/api/v1/tasks/${encodeURIComponent(taskId)}`,
    null as never,
    "任务详情加载失败。",
  );
}

export async function retryV1Task(payload: {
  taskId: string;
  requestedBy: string;
  reason?: string;
}): Promise<TaskRetryV1Response> {
  return apiPost(
    `/api/v1/tasks/${encodeURIComponent(payload.taskId)}/retry`,
    {
      requested_by: payload.requestedBy,
      reason: payload.reason ?? null,
    },
    "任务重试失败。",
    "演示模式下无法重试任务。",
  );
}