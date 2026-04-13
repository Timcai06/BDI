import {
  buildDemoResultForModelVersion,
  demoModelCatalog,
  demoResult
} from "@/lib/mock-data";
import type { ApiError, PredictOptions, PredictionResult } from "@/lib/types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

export const PREDICT_TIMEOUT_MS = 120_000;
export const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_TTL_MS = 30_000;
export const MAX_CACHE_SIZE = 200;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const MEMORY_CACHE = new Map<string, CacheEntry<unknown>>();
export const DIAGNOSIS_TEXT_CACHE = new Map<string, string>();
export const DIAGNOSIS_INFLIGHT = new Map<string, Promise<string>>();

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};

  const controller = new AbortController();
  const existing = fetchInit.signal;

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

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = MEMORY_CACHE.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  if (MEMORY_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = MEMORY_CACHE.keys().next().value;
    if (oldestKey !== undefined) MEMORY_CACHE.delete(oldestKey);
  }

  const data = await fetcher();
  MEMORY_CACHE.set(key, { data, timestamp: now });
  return data;
}

export function getErrorMessage(payload: unknown, fallback: string, requestId?: string | null): string {
  const baseMessage =
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
      ? payload.error.message
      : fallback;

  return requestId ? `${baseMessage} [请求ID: ${requestId}]` : baseMessage;
}

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return getErrorMessage(payload, fallback, response.headers.get("x-request-id"));
}

export function getFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }

  const filenameMatch = header.match(/filename=\"?([^\"]+)\"?/i);
  return filenameMatch?.[1] ?? fallback;
}

export function invalidateResultListCaches() {
  if (!API_BASE_URL) {
    return;
  }

  for (const key of MEMORY_CACHE.keys()) {
    if (key.startsWith(`${API_BASE_URL}/results?`)) {
      MEMORY_CACHE.delete(key);
    }
  }
}

export function encodeImageId(imageId: string): string {
  return encodeURIComponent(imageId);
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
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

export function cloneDemoResult(file: File, options: PredictOptions): PredictionResult {
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

export function withCacheKey(url: string, cacheKey?: string | number | null): string {
  if (cacheKey === undefined || cacheKey === null || cacheKey === "") {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(String(cacheKey))}`;
}

export async function apiGet<T>(path: string, fallback: T, errorMsg: string, options?: { timeoutMs?: number }): Promise<T> {
  if (!API_BASE_URL) {
    return fallback;
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, { timeoutMs: options?.timeoutMs });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, errorMsg));
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown, errorMsg: string, demoError?: string, options?: { timeoutMs?: number }): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(demoError ?? "演示模式下无法执行此操作。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: options?.timeoutMs,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, errorMsg));
  }
  return (await response.json()) as T;
}

export async function apiPut<T>(path: string, body: unknown, errorMsg: string, demoError?: string, options?: { timeoutMs?: number }): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(demoError ?? "演示模式下无法执行此操作。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: options?.timeoutMs,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, errorMsg));
  }
  return (await response.json()) as T;
}

export async function apiDelete<T>(path: string, errorMsg: string, demoError?: string): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(demoError ?? "演示模式下无法执行此操作。");
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, errorMsg));
  }
  return (await response.json()) as T;
}

export { demoModelCatalog, demoResult };
export type { ApiError };
