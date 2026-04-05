import {
  buildDemoResultForModelVersion,
  demoModelCatalog,
  demoResult
} from "@/lib/mock-data";
import type {
  AlertRulesConfigV1Response,
  AlertListV1Response,
  AlertV1,
  ApiError,
  BatchItemDetailV1Response,
  BatchIngestV1Response,
  BatchItemListV1Response,
  BatchItemResultV1Response,
  BatchDeleteV1Response,
  BatchListV1Response,
  BatchStatsV1Response,
  BatchDeleteResultsResponse,
  BridgeDeleteV1Response,
  BridgeListV1Response,
  DetectionListV1Response,
  DiagnosisResponse,
  ModelCatalogResponse,
  OpsMetricsV1Response,
  OpsAuditLogListV1Response,
  PredictOptions,
  PredictionHistoryResponse,
  PredictionResult,
  ReviewListV1Response,
  ReviewRecordV1,
  TaskRetryV1Response,
  TaskV1
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Timeout-aware fetch wrapper
// ---------------------------------------------------------------------------

const PREDICT_TIMEOUT_MS = 120_000; // 推理请求最长 120 秒
const DEFAULT_TIMEOUT_MS = 15_000;  // 普通读写请求 15 秒

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};

  const controller = new AbortController();
  const existing = fetchInit.signal;

  // If the caller already provided an AbortSignal, respect it.
  if (existing) {
    existing.addEventListener("abort", () => controller.abort(existing.reason));
  }

  const timer = setTimeout(() => controller.abort("请求超时"), timeoutMs);

  try {
    return await fetch(input, { ...fetchInit, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时，请检查网络连接或稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Simple In-memory Cache for GET requests
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 30_000; // 30秒缓存
const DIAGNOSIS_TEXT_CACHE = new Map<string, string>();
const DIAGNOSIS_INFLIGHT = new Map<string, Promise<string>>();

async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = MEMORY_CACHE.get(key);
  const now = Date.now();

  if (cached && (now - cached.timestamp < ttlMs)) {
    return cached.data as T;
  }

  const data = await fetcher();
  MEMORY_CACHE.set(key, { data, timestamp: now });
  return data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneDemoResult(file: File, options: PredictOptions): PredictionResult {
  const modelVersion = options.modelVersion ?? demoResult.model_version;
  const base = buildDemoResultForModelVersion(modelVersion);

  return {
    ...base,
    image_id: file.name,
    artifacts: {
      ...base.artifacts,
      upload_path: `uploads/${file.name}`,
      overlay_path: options.exportOverlay ? base.artifacts.overlay_path : null
    }
  };
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return fallback;
}

function invalidateResultListCaches() {
  if (!API_BASE_URL) {
    return;
  }

  for (const key of MEMORY_CACHE.keys()) {
    if (key.startsWith(`${API_BASE_URL}/results?`)) {
      MEMORY_CACHE.delete(key);
    }
  }
}

function encodeImageId(imageId: string): string {
  return encodeURIComponent(imageId);
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function getFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }

  const filenameMatch = header.match(/filename="?([^"]+)"?/i);
  return filenameMatch?.[1] ?? fallback;
}

// ---------------------------------------------------------------------------
// API client functions
// ---------------------------------------------------------------------------

export async function predictImage(
  file: File,
  options: PredictOptions
): Promise<PredictionResult> {
  if (!API_BASE_URL) {
    return cloneDemoResult(file, options);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("confidence", String(options.confidence));
  formData.append("return_overlay", String(options.exportOverlay));
  if (options.modelVersion) {
    formData.append("model_version", options.modelVersion);
  }
  if (options.pixelsPerMm !== undefined) {
    formData.append("pixels_per_mm", String(options.pixelsPerMm));
  }
  if (options.enhance !== undefined) {
    formData.append("enhance", String(options.enhance));
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/predict`, {
      method: "POST",
      body: formData,
      timeoutMs: PREDICT_TIMEOUT_MS
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "识别失败，请稍后重试。"));
    }

    // Invalidate all paginated history list caches on new prediction.
    invalidateResultListCaches();

    return (await response.json()) as PredictionResult;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("无法连接后端推理服务。");
  }
}

export async function listModels(): Promise<ModelCatalogResponse> {
  if (!API_BASE_URL) {
    return demoModelCatalog;
  }

  const cacheKey = `${API_BASE_URL}/models`;
  return cachedFetch(cacheKey, async () => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/models`);

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "模型列表加载失败。"));
    }

    return (await response.json()) as ModelCatalogResponse;
  });
}

export async function listResults(
  offset: number = 0,
  limit: number = 20,
  forceFresh: boolean = false
): Promise<PredictionHistoryResponse> {
  if (!API_BASE_URL) {
    return {
      items: [
        {
          image_id: demoResult.image_id,
          created_at: demoResult.created_at,
          model_name: demoResult.model_name,
          model_version: demoResult.model_version,
          backend: demoResult.backend,
          inference_mode: demoResult.inference_mode,
          inference_ms: demoResult.inference_ms,
          detection_count: demoResult.detections.length,
          has_masks: demoResult.has_masks,
          mask_detection_count: demoResult.mask_detection_count,
          categories: [...new Set(demoResult.detections.map((item) => item.category))],
          artifacts: demoResult.artifacts
        }
      ],
      total: 1,
      offset: 0
    };
  }

  const fetchResults = async () => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/results?offset=${offset}&limit=${limit}`);

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "历史结果加载失败。"));
    }

    return (await response.json()) as PredictionHistoryResponse;
  };

  if (forceFresh) {
    return fetchResults();
  }

  const cacheKey = `${API_BASE_URL}/results?offset=${offset}&limit=${limit}`;
  return cachedFetch(cacheKey, fetchResults);
}

export async function listAllResults(forceFresh: boolean = false): Promise<PredictionHistoryResponse> {
  const pageSize = 100;
  let offset = 0;
  let total = 0;
  const items: PredictionHistoryResponse["items"] = [];

  do {
    const page = await listResults(offset, pageSize, forceFresh);
    total = page.total;
    items.push(...page.items);
    offset += page.items.length;

    if (page.items.length === 0) {
      break;
    }
  } while (offset < total);

  return {
    items,
    total,
    offset: 0
  };
}

export async function getResult(
  imageId: string,
  options: { forceFresh?: boolean } = {}
): Promise<PredictionResult> {
  if (!API_BASE_URL) {
    return demoResult;
  }

  const encodedImageId = encodeImageId(imageId);
  const cacheKey = `${API_BASE_URL}/results/${encodedImageId}`;
  const fetchResult = async () => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/results/${encodedImageId}`);

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "结果详情加载失败。"));
    }

    return (await response.json()) as PredictionResult;
  };

  if (options.forceFresh) {
    MEMORY_CACHE.delete(cacheKey);
    return fetchResult();
  }

  return cachedFetch(cacheKey, fetchResult);
}

export async function deleteResult(imageId: string): Promise<void> {
  if (!API_BASE_URL) {
    return;
  }

  const encodedImageId = encodeImageId(imageId);

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/results/${encodedImageId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "删除记录失败。"));
    }

    // Invalidate caches
    MEMORY_CACHE.delete(`${API_BASE_URL}/results/${encodedImageId}`);
    invalidateResultListCaches();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("无法删除分析记录。");
  }
}

export async function batchDeleteResults(imageIds: string[]): Promise<BatchDeleteResultsResponse> {
  if (imageIds.length === 0) {
    return {
      requested: 0,
      deleted_count: 0,
      failed_count: 0,
      results: []
    };
  }

  if (!API_BASE_URL) {
    return {
      requested: imageIds.length,
      deleted_count: imageIds.length,
      failed_count: 0,
      results: imageIds.map((imageId) => ({
        image_id: imageId,
        deleted: true,
        error_code: null
      }))
    };
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/results/batch-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_ids: imageIds
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "批量删除记录失败。"));
    }

    for (const imageId of imageIds) {
      MEMORY_CACHE.delete(`${API_BASE_URL}/results/${encodeImageId(imageId)}`);
    }
    invalidateResultListCaches();

    return (await response.json()) as BatchDeleteResultsResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("无法批量删除分析记录。");
  }
}

export async function batchExportResults(
  imageIds: string[],
  assetType: "json" | "overlay"
): Promise<{ blob: Blob; filename: string }> {
  const fallbackFilename = `history-${assetType}-export.zip`;

  if (imageIds.length === 0) {
    throw new Error("请先选择要导出的记录。");
  }

  if (!API_BASE_URL) {
    const placeholder = JSON.stringify(
      {
        asset_type: assetType,
        image_ids: imageIds
      },
      null,
      2
    );
    return {
      blob: new Blob([placeholder], { type: "application/zip" }),
      filename: fallbackFilename
    };
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/results/batch-export/${assetType}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_ids: imageIds
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(
        getErrorMessage(
          payload,
          assetType === "json" ? "批量导出 JSON 失败。" : "批量导出结果图失败。"
        )
      );
    }

    return {
      blob: await response.blob(),
      filename: getFilenameFromDisposition(
        response.headers.get("content-disposition"),
        fallbackFilename
      )
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(assetType === "json" ? "无法导出 JSON 历史记录。" : "无法导出结果图历史记录。");
  }
}

function withCacheKey(url: string, cacheKey?: string | number | null): string {
  if (cacheKey === undefined || cacheKey === null || cacheKey === "") {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(String(cacheKey))}`;
}

export function getOverlayDownloadUrl(
  imageId: string,
  cacheKey?: string | number | null
): string | null {
  if (!API_BASE_URL) {
    return demoResult.artifacts.overlay_path ?? null;
  }

  return withCacheKey(`${API_BASE_URL}/results/${encodeImageId(imageId)}/overlay`, cacheKey);
}

export function getResultImageUrl(
  imageId: string,
  cacheKey?: string | number | null
): string | null {
  if (!API_BASE_URL) {
    return null;
  }

  return withCacheKey(`${API_BASE_URL}/results/${encodeImageId(imageId)}/image`, cacheKey);
}

export function getEnhancedImageUrl(
  imageId: string,
  cacheKey?: string | number | null
): string | null {
  if (!API_BASE_URL) {
    return null;
  }

  return withCacheKey(`${API_BASE_URL}/results/${encodeImageId(imageId)}/enhanced`, cacheKey);
}

export function getEnhancedOverlayUrl(
  imageId: string,
  cacheKey?: string | number | null
): string | null {
  if (!API_BASE_URL) {
    return null;
  }

  return withCacheKey(`${API_BASE_URL}/results/${encodeImageId(imageId)}/enhanced-overlay`, cacheKey);
}

export async function getResultImageFile(imageId: string): Promise<File> {
  const imageUrl = getResultImageUrl(imageId);

  if (!imageUrl) {
    throw new Error("当前环境无法读取历史原图。");
  }

  const response = await fetchWithTimeout(imageUrl);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(getErrorMessage(payload, "历史原图加载失败。"));
  }

  const blob = await response.blob();
  const contentType = blob.type || "image/jpeg";
  const fallbackName = `${imageId}.jpg`;
  const filename =
    response.headers
      .get("content-disposition")
      ?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName;

  return new File([blob], filename, { type: contentType });
}

export async function getDiagnosisText(imageId: string): Promise<string> {
  const cached = DIAGNOSIS_TEXT_CACHE.get(imageId);
  if (cached !== undefined) {
    return cached;
  }

  const inflight = DIAGNOSIS_INFLIGHT.get(imageId);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    if (!API_BASE_URL) {
      return "【演示模式】AI 专家建议：请结合裂缝、破损、梳齿缺陷、孔洞、钢筋外露与渗水等六类病害特征进行复核，并优先关注高风险构件。";
    }

    const encodedImageId = encodeImageId(imageId);
    const response = await fetch(`${API_BASE_URL}/results/${encodedImageId}/diagnosis`, {
      method: "POST"
    });

    if (!response.ok || !response.body) {
      throw new Error("无法获取 AI 专家诊断。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
      }
      content += decoder.decode();
      DIAGNOSIS_TEXT_CACHE.set(imageId, content);
      return content;
    } finally {
      reader.releaseLock();
    }
  })();

  DIAGNOSIS_INFLIGHT.set(imageId, request);

  try {
    return await request;
  } finally {
    DIAGNOSIS_INFLIGHT.delete(imageId);
  }
}

export async function getDiagnosisRecord(imageId: string): Promise<DiagnosisResponse> {
  if (!API_BASE_URL) {
    return {
      image_id: imageId,
      exists: false,
      content: null,
      generated_at: null
    };
  }

  const encodedImageId = encodeImageId(imageId);
  const response = await fetchWithTimeout(`${API_BASE_URL}/results/${encodedImageId}/diagnosis`);

  if (!response.ok) {
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "专家报告读取失败。"));
  }

  return (await response.json()) as DiagnosisResponse;
}

export async function* getDiagnosisStream(imageId: string): AsyncGenerator<string, void, unknown> {
  if (!API_BASE_URL) {
    yield "【演示模式】AI 专家建议：请结合裂缝、破损、梳齿缺陷、孔洞、钢筋外露与渗水等六类病害特征进行复核，并优先关注高风险构件。";
    return;
  }

  const encodedImageId = encodeImageId(imageId);
  const response = await fetch(`${API_BASE_URL}/results/${encodedImageId}/diagnosis`, {
    method: "POST"
  });

  if (!response.ok || !response.body) {
    throw new Error("无法获取 AI 专家诊断。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "批次列表加载失败。"));
  }
  return (await response.json()) as BatchListV1Response;
}

export async function listV1Bridges(limit: number = 50, offset: number = 0): Promise<BridgeListV1Response> {
  if (!API_BASE_URL) {
    return { items: [], total: 0, limit, offset };
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bridges?limit=${limit}&offset=${offset}`);
  if (!response.ok) {
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "桥梁列表加载失败。"));
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
    const err = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(err, "桥梁创建失败。"));
  }
  return (await response.json()) as BridgeListV1Response["items"][number];
}

export async function deleteV1Bridge(bridgeId: string): Promise<BridgeDeleteV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下无法删除桥梁。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bridges/${encodeURIComponent(bridgeId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(err, "桥梁删除失败。"));
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
      enhancement_mode: payload.enhancementMode ?? "auto",
    })
  });
  if (!response.ok) {
    const err = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(err, "批次创建失败。"));
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
    const err = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(err, "批次删除失败。"));
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
  formData.append("enhancement_mode", payload.enhancementMode ?? "auto");
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
    const err = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(err, "批次图片上传失败。"));
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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "批次统计加载失败。"));
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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "运营指标加载失败。"));
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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "告警规则加载失败。"));
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
    const err = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(err, "告警规则更新失败。"));
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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "规则审计日志加载失败。"));
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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "批次图片列表加载失败。"));
  }
  return (await response.json()) as BatchItemListV1Response;
}

export async function getV1BatchItemDetail(batchItemId: string): Promise<BatchItemDetailV1Response> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下没有批次图片详情。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/batch-items/${encodeURIComponent(batchItemId)}`);
  if (!response.ok) {
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "图片详情加载失败。"));
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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "图片识别结果加载失败。"));
  }
  return (await response.json()) as BatchItemResultV1Response;
}

export async function getV1Task(taskId: string): Promise<TaskV1> {
  if (!API_BASE_URL) {
    throw new Error("演示模式下没有任务详情。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/tasks/${encodeURIComponent(taskId)}`);
  if (!response.ok) {
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "任务详情加载失败。"));
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
    const err = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(err, "任务重试失败。"));
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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "病害检索失败。"));
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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "复核记录加载失败。"));
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
    const err = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(err, "复核提交失败。"));
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
    const payload = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(payload, "告警列表加载失败。"));
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
    const err = (await response.json()) as ApiError;
    throw new Error(getErrorMessage(err, "告警状态更新失败。"));
  }
  return (await response.json()) as AlertV1;
}
