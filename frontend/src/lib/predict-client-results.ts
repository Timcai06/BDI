import type {
  BatchDeleteResultsResponse,
  DiagnosisResponse,
  ModelCatalogResponse,
  PredictOptions,
  PredictionHistoryResponse,
  PredictionResult
} from "@/lib/types";
import {
  API_BASE_URL,
  DIAGNOSIS_INFLIGHT,
  DIAGNOSIS_TEXT_CACHE,
  MAX_CACHE_SIZE,
  MEMORY_CACHE,
  PREDICT_TIMEOUT_MS,
  apiDelete,
  apiPost,
  cachedFetch,
  cloneDemoResult,
  demoModelCatalog,
  demoResult,
  encodeImageId,
  fetchWithTimeout,
  getErrorMessage,
  getFilenameFromDisposition,
  invalidateResultListCaches,
  readErrorMessage,
  withCacheKey
} from "@/lib/predict-client-base";

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
      throw new Error(await readErrorMessage(response, "识别失败，请稍后重试。"));
    }

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
      throw new Error(await readErrorMessage(response, "模型列表加载失败。"));
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
      throw new Error(await readErrorMessage(response, "历史结果加载失败。"));
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

  return { items, total, offset: 0 };
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
      throw new Error(await readErrorMessage(response, "结果详情加载失败。"));
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
  const cacheKey = `${API_BASE_URL}/results/${encodedImageId}`;

  try {
    await apiDelete(`/results/${encodedImageId}`, "删除记录失败。");
    MEMORY_CACHE.delete(cacheKey);
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
    const result = await apiPost<BatchDeleteResultsResponse>(
      "/results/batch-delete",
      { image_ids: imageIds },
      "批量删除记录失败。",
    );

    for (const imageId of imageIds) {
      MEMORY_CACHE.delete(`${API_BASE_URL}/results/${encodeImageId(imageId)}`);
    }
    invalidateResultListCaches();

    return result;
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
    const placeholder = JSON.stringify({ asset_type: assetType, image_ids: imageIds }, null, 2);
    return {
      blob: new Blob([placeholder], { type: "application/zip" }),
      filename: fallbackFilename
    };
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/results/batch-export/${assetType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_ids: imageIds })
    });

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          await response.json().catch(() => null),
          assetType === "json" ? "批量导出 JSON 失败。" : "批量导出结果图失败。"
        )
      );
    }

    return {
      blob: await response.blob(),
      filename: getFilenameFromDisposition(response.headers.get("content-disposition"), fallbackFilename)
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(assetType === "json" ? "无法导出 JSON 历史记录。" : "无法导出结果图历史记录。");
  }
}

export function getOverlayDownloadUrl(imageId: string, cacheKey?: string | number | null): string | null {
  if (!API_BASE_URL) {
    return demoResult.artifacts.overlay_path ?? null;
  }
  return withCacheKey(`${API_BASE_URL}/results/${encodeImageId(imageId)}/overlay`, cacheKey);
}

export function getResultImageUrl(imageId: string, cacheKey?: string | number | null): string | null {
  if (!API_BASE_URL) {
    return null;
  }
  return withCacheKey(`${API_BASE_URL}/results/${encodeImageId(imageId)}/image`, cacheKey);
}

export function getEnhancedImageUrl(imageId: string, cacheKey?: string | number | null): string | null {
  if (!API_BASE_URL) {
    return demoResult.artifacts.enhanced_path ?? null;
  }
  return withCacheKey(`${API_BASE_URL}/results/${encodeImageId(imageId)}/enhanced`, cacheKey);
}

export function getEnhancedOverlayUrl(imageId: string, cacheKey?: string | number | null): string | null {
  if (!API_BASE_URL) {
    return demoResult.artifacts.enhanced_overlay_path ?? null;
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
    throw new Error(getErrorMessage(await response.json().catch(() => null), "历史原图加载失败。"));
  }

  const blob = await response.blob();
  const contentType = blob.type || "image/jpeg";
  const fallbackName = `${imageId}.jpg`;
  const filename =
    response.headers.get("content-disposition")?.match(/filename=\"?([^\"]+)\"?/)?.[1] ?? fallbackName;

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
    const response = await fetch(`${API_BASE_URL}/results/${encodedImageId}/diagnosis`, { method: "POST" });
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
      if (DIAGNOSIS_TEXT_CACHE.size >= MAX_CACHE_SIZE) {
        const oldestKey = DIAGNOSIS_TEXT_CACHE.keys().next().value;
        if (oldestKey !== undefined) DIAGNOSIS_TEXT_CACHE.delete(oldestKey);
      }
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
    throw new Error(getErrorMessage(await response.json().catch(() => null), "专家报告读取失败。"));
  }

  return (await response.json()) as DiagnosisResponse;
}

export async function* getDiagnosisStream(imageId: string): AsyncGenerator<string, void, unknown> {
  if (!API_BASE_URL) {
    yield "【演示模式】AI 专家建议：请结合裂缝、破损、梳齿缺陷、孔洞、钢筋外露与渗水等六类病害特征进行复核，并优先关注高风险构件。";
    return;
  }

  const encodedImageId = encodeImageId(imageId);
  const response = await fetch(`${API_BASE_URL}/results/${encodedImageId}/diagnosis`, { method: "POST" });
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

export async function enhanceResultImage(payload: {
  imageId: string;
  requestedBy: string;
  reason?: string;
}): Promise<PredictionResult> {
  return apiPost(
    `/results/${encodeURIComponent(payload.imageId)}/enhance`,
    {
      requested_by: payload.requestedBy,
      reason: payload.reason ?? null,
    },
    "增强结果生成失败。",
    "演示模式下无法生成增强结果。",
    { timeoutMs: PREDICT_TIMEOUT_MS },
  );
}