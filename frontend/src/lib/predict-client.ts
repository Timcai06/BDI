import {
  buildDemoResultForModelVersion,
  demoModelCatalog,
  demoResult
} from "@/lib/mock-data";
import type {
  ApiError,
  ModelCatalogResponse,
  PredictOptions,
  PredictionHistoryResponse,
  PredictionResult
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

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/models`);

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "模型列表加载失败。"));
    }

    return (await response.json()) as ModelCatalogResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("无法加载模型列表。");
  }
}

export async function listResults(): Promise<PredictionHistoryResponse> {
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
          categories: [...new Set(demoResult.detections.map((item) => item.category))],
          artifacts: demoResult.artifacts
        }
      ]
    };
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/results`);

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "历史结果加载失败。"));
    }

    return (await response.json()) as PredictionHistoryResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("无法加载历史结果。");
  }
}

export async function getResult(imageId: string): Promise<PredictionResult> {
  if (!API_BASE_URL) {
    return demoResult;
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/results/${imageId}`);

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "结果详情加载失败。"));
    }

    return (await response.json()) as PredictionResult;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("无法加载结果详情。");
  }
}

export async function deleteResult(imageId: string): Promise<void> {
  if (!API_BASE_URL) {
    return;
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/results/${imageId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      throw new Error(getErrorMessage(payload, "删除记录失败。"));
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("无法删除分析记录。");
  }
}

export function getOverlayDownloadUrl(imageId: string): string | null {
  if (!API_BASE_URL) {
    return demoResult.artifacts.overlay_path ?? null;
  }

  return `${API_BASE_URL}/results/${imageId}/overlay`;
}

export function getResultImageUrl(imageId: string): string | null {
  if (!API_BASE_URL) {
    return null;
  }

  return `${API_BASE_URL}/results/${imageId}/image`;
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
