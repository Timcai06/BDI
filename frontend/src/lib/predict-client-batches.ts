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
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const query = buildQuery({
    limit,
    offset,
    bridge_id: params?.bridgeId,
    status_filter: params?.statusFilter,
    has_failures: params?.hasFailures,
  });
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/batches${query}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "批次列表加载失败。"));
  }
  return (await response.json()) as BatchListV1Response;
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
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法创建批次。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bridge_id: payload.bridgeId,
      batch_code: payload.batchCode ?? null,
      source_type: payload.sourceType,
      expected_item_count: payload.expectedItemCount,
      created_by: payload.createdBy ?? null,
      inspection_label: payload.inspectionLabel ?? null,
      enhancement_mode: payload.enhancementMode ?? "always",
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "批次创建失败。"));
  }
  return (await response.json()) as BatchListV1Response["items"][number];
}

export async function deleteV1Batch(batchId: string): Promise<BatchDeleteV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法删除批次。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/batches/${encodeURIComponent(batchId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "批次删除失败。"));
  }
  return (await response.json()) as BatchDeleteV1Response;
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
  if (!API_BASE_URL) {
    return {
      batch_id: batchId,
      status_breakdown: {},
      review_breakdown: {},
      category_breakdown: {},
      alert_breakdown: {},
    };
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/batches/${encodeURIComponent(batchId)}/stats`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "批次统计加载失败。"));
  }
  return (await response.json()) as BatchStatsV1Response;
}

export async function listV1BatchItems(
  batchId: string,
  limit: number = 50,
  offset: number = 0,
  relativePathPrefix?: string,
): Promise<BatchItemListV1Response> {
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const query = buildQuery({
    limit,
    offset,
    relative_path_prefix: relativePathPrefix || undefined,
  });
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/batches/${encodeURIComponent(batchId)}/items${query}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "批次图片列表加载失败。"));
  }
  return (await response.json()) as BatchItemListV1Response;
}

export async function getV1BatchItemDetail(batchItemId: string): Promise<BatchItemDetailV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下没有批次图片详情。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/batch-items/${encodeURIComponent(batchItemId)}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "图片详情加载失败。"));
  }
  return (await response.json()) as BatchItemDetailV1Response;
}

export async function getV1BatchItemResult(batchItemId: string): Promise<BatchItemResultV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下没有批次识别结果。");
  }
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/batch-items/${encodeURIComponent(batchItemId)}/result`,
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "图片识别结果加载失败。"));
  }
  return (await response.json()) as BatchItemResultV1Response;
}

export async function getV1Task(taskId: string): Promise<TaskV1> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下没有任务详情。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/tasks/${encodeURIComponent(taskId)}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "任务详情加载失败。"));
  }
  return (await response.json()) as TaskV1;
}

export async function retryV1Task(payload: {
  taskId: string;
  requestedBy: string;
  reason?: string;
}): Promise<TaskRetryV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法重试任务。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/tasks/${encodeURIComponent(payload.taskId)}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requested_by: payload.requestedBy,
      reason: payload.reason ?? null,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "任务重试失败。"));
  }
  return (await response.json()) as TaskRetryV1Response;
}
