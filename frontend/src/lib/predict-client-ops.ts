import type {
  AlertListV1Response,
  AlertRulesConfigV1Response,
  AlertV1,
  BatchDeleteV1Response,
  BatchIngestV1Response,
  BatchItemDetailV1Response,
  BatchItemListV1Response,
  BatchItemResultV1Response,
  BatchListV1Response,
  BatchStatsV1Response,
  BridgeDeleteV1Response,
  BridgeListV1Response,
  DetectionListV1Response,
  OpsAuditLogListV1Response,
  OpsMetricsV1Response,
  ReviewListV1Response,
  ReviewRecordV1,
  TaskRetryV1Response,
  TaskV1
} from "@/lib/types";
import {
  API_BASE_URL,
  PREDICT_TIMEOUT_MS,
  buildQuery,
  fetchWithTimeout,
  readErrorMessage
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
    has_failures: params?.hasFailures
  });
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/batches${query}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "批次列表加载失败。"));
  }
  return (await response.json()) as BatchListV1Response;
}

export async function listV1Bridges(limit: number = 50, offset: number = 0): Promise<BridgeListV1Response> {
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bridges?limit=${limit}&offset=${offset}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "桥梁列表加载失败。"));
  }
  return (await response.json()) as BridgeListV1Response;
}

export async function createV1Bridge(payload: {
  bridgeCode: string;
  bridgeName: string;
  bridgeType?: string;
  region?: string;
  managerOrg?: string;
  longitude?: number;
  latitude?: number;
}): Promise<BridgeListV1Response["items"][number]> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法创建桥梁。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bridges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bridge_code: payload.bridgeCode,
      bridge_name: payload.bridgeName,
      bridge_type: payload.bridgeType ?? null,
      region: payload.region ?? null,
      manager_org: payload.managerOrg ?? null,
      longitude: payload.longitude ?? null,
      latitude: payload.latitude ?? null
    })
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "桥梁创建失败。"));
  }
  return (await response.json()) as BridgeListV1Response["items"][number];
}

export async function deleteV1Bridge(bridgeId: string): Promise<BridgeDeleteV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法删除桥梁。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bridges/${encodeURIComponent(bridgeId)}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "桥梁删除失败。"));
  }
  return (await response.json()) as BridgeDeleteV1Response;
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
      enhancement_mode: payload.enhancementMode ?? "always"
    })
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
    method: "DELETE"
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
  if (payload.sourceDevice) {
    formData.append("source_device", payload.sourceDevice);
  }
  if (payload.capturedAt) {
    formData.append("captured_at", payload.capturedAt);
  }

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/batches/${encodeURIComponent(payload.batchId)}/items`,
    {
      method: "POST",
      body: formData,
      timeoutMs: PREDICT_TIMEOUT_MS
    }
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
      alert_breakdown: {}
    };
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/batches/${encodeURIComponent(batchId)}/stats`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "批次统计加载失败。"));
  }
  return (await response.json()) as BatchStatsV1Response;
}

export async function getV1OpsMetrics(windowHours: number = 24): Promise<OpsMetricsV1Response> {
  const normalizedWindow = Math.max(1, Math.floor(windowHours));
  if (!API_BASE_URL) {
    return {
      window_hours: normalizedWindow,
      generated_at: new Date().toISOString(),
      total_tasks: 0,
      success_rate: 0,
      retry_recovery_rate: null,
      queued_tasks: 0,
      running_tasks: 0,
      failed_tasks: 0,
      recovered_stale_tasks: 0,
      p50_queue_wait_ms: null,
      p95_queue_wait_ms: null,
      p50_run_ms: null,
      p95_run_ms: null,
      status_breakdown: {},
      failure_code_breakdown: {}
    };
  }
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/ops/metrics?window_hours=${encodeURIComponent(String(normalizedWindow))}`
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "运营指标加载失败。"));
  }
  return (await response.json()) as OpsMetricsV1Response;
}

export async function getV1AlertRules(): Promise<AlertRulesConfigV1Response> {
  if (!API_BASE_URL) {
    return {
      profile_name: "JTG-v1",
      alert_auto_enabled: true,
      count_threshold: 3,
      category_watchlist: ["seepage"],
      category_confidence_threshold: 0.8,
      repeat_escalation_hits: 2,
      sla_hours_by_level: { low: 72, medium: 48, high: 24, critical: 12 },
      near_due_hours: 2,
      updated_at: new Date().toISOString(),
      updated_by: "demo"
    };
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ops/alert-rules`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "告警规则加载失败。"));
  }
  return (await response.json()) as AlertRulesConfigV1Response;
}

export async function updateV1AlertRules(payload: {
  updatedBy: string;
  profileName?: string;
  alertAutoEnabled?: boolean;
  countThreshold?: number;
  categoryWatchlist?: string[];
  categoryConfidenceThreshold?: number;
  repeatEscalationHits?: number;
  slaHoursByLevel?: Record<string, number>;
  nearDueHours?: number;
}): Promise<AlertRulesConfigV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法更新告警规则。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ops/alert-rules`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updated_by: payload.updatedBy,
      profile_name: payload.profileName ?? null,
      alert_auto_enabled: payload.alertAutoEnabled ?? null,
      count_threshold: payload.countThreshold ?? null,
      category_watchlist: payload.categoryWatchlist ?? null,
      category_confidence_threshold: payload.categoryConfidenceThreshold ?? null,
      repeat_escalation_hits: payload.repeatEscalationHits ?? null,
      sla_hours_by_level: payload.slaHoursByLevel ?? null,
      near_due_hours: payload.nearDueHours ?? null
    })
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "告警规则更新失败。"));
  }
  return (await response.json()) as AlertRulesConfigV1Response;
}

export async function listV1AlertRulesAudit(params?: {
  actor?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<OpsAuditLogListV1Response> {
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const query = buildQuery({
    actor: params?.actor,
    date_from: params?.dateFrom,
    date_to: params?.dateTo,
    limit,
    offset
  });
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ops/alert-rules/audit${query}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "规则审计日志加载失败。"));
  }
  return (await response.json()) as OpsAuditLogListV1Response;
}

export async function listV1BatchItems(
  batchId: string,
  limit: number = 50,
  offset: number = 0,
  relativePathPrefix?: string
): Promise<BatchItemListV1Response> {
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const query = buildQuery({
    limit,
    offset,
    relative_path_prefix: relativePathPrefix || undefined
  });
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/batches/${encodeURIComponent(batchId)}/items${query}`
  );
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
    `${API_BASE_URL}/api/v1/batch-items/${encodeURIComponent(batchItemId)}/result`
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
      reason: payload.reason ?? null
    })
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "任务重试失败。"));
  }
  return (await response.json()) as TaskRetryV1Response;
}

export async function listV1Detections(params: {
  batchId?: string;
  batchItemId?: string;
  category?: string;
  minConfidence?: number;
  maxConfidence?: number;
  minAreaMm2?: number;
  isValid?: boolean;
  sortBy?: "created_at" | "confidence" | "area_mm2";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<DetectionListV1Response> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const query = buildQuery({
    batch_id: params.batchId,
    batch_item_id: params.batchItemId,
    category: params.category,
    min_confidence: params.minConfidence,
    max_confidence: params.maxConfidence,
    min_area_mm2: params.minAreaMm2,
    is_valid: params.isValid,
    sort_by: params.sortBy ?? "created_at",
    sort_order: params.sortOrder ?? "desc",
    limit,
    offset
  });
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/detections${query}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "病害检索失败。"));
  }
  return (await response.json()) as DetectionListV1Response;
}

export async function listV1Reviews(params: {
  batchId?: string;
  batchItemId?: string;
  detectionId?: string;
  reviewer?: string;
  sortBy?: "reviewed_at" | "created_at";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<ReviewListV1Response> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const query = buildQuery({
    batch_id: params.batchId,
    batch_item_id: params.batchItemId,
    detection_id: params.detectionId,
    reviewer: params.reviewer,
    sort_by: params.sortBy ?? "reviewed_at",
    sort_order: params.sortOrder ?? "desc",
    limit,
    offset
  });
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/reviews${query}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "复核记录加载失败。"));
  }
  return (await response.json()) as ReviewListV1Response;
}

export async function createV1Review(payload: {
  detectionId: string;
  reviewAction: "confirm" | "reject" | "edit";
  reviewer: string;
  reviewNote?: string;
  afterPayload?: Record<string, unknown>;
}): Promise<ReviewRecordV1> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法提交复核。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      detection_id: payload.detectionId,
      review_action: payload.reviewAction,
      reviewer: payload.reviewer,
      review_note: payload.reviewNote ?? null,
      after_payload: payload.afterPayload ?? {}
    })
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "复核提交失败。"));
  }
  return (await response.json()) as ReviewRecordV1;
}

export async function listV1Alerts(params: {
  batchId?: string;
  statusFilter?: string;
  eventType?: string;
  sortBy?: "triggered_at" | "created_at" | "updated_at";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<AlertListV1Response> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const query = buildQuery({
    batch_id: params.batchId,
    status_filter: params.statusFilter,
    event_type: params.eventType,
    sort_by: params.sortBy ?? "triggered_at",
    sort_order: params.sortOrder ?? "desc",
    limit,
    offset
  });
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/alerts${query}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "告警列表加载失败。"));
  }
  return (await response.json()) as AlertListV1Response;
}

export async function updateV1AlertStatus(payload: {
  alertId: string;
  action: "acknowledge" | "resolve";
  operator: string;
  note?: string;
}): Promise<AlertV1> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法更新告警状态。");
  }
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/alerts/${encodeURIComponent(payload.alertId)}/status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: payload.action,
        operator: payload.operator,
        note: payload.note ?? null
      })
    }
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "告警状态更新失败。"));
  }
  return (await response.json()) as AlertV1;
}
