import type { DetectionListV1Response } from "@/lib/types";
import { API_BASE_URL, buildQuery, fetchWithTimeout, readErrorMessage } from "@/lib/predict-client-base";

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
    offset,
  });
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/detections${query}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "病害检索失败。"));
  }
  return (await response.json()) as DetectionListV1Response;
}
