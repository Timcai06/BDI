import type { ReviewListV1Response, ReviewRecordV1 } from "@/lib/types";
import { apiGet, apiPost, buildQuery } from "@/lib/predict-client-base";

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
  const query = buildQuery({
    batch_id: params.batchId,
    batch_item_id: params.batchItemId,
    detection_id: params.detectionId,
    reviewer: params.reviewer,
    sort_by: params.sortBy ?? "reviewed_at",
    sort_order: params.sortOrder ?? "desc",
    limit,
    offset,
  });
  return apiGet(`/api/v1/reviews${query}`, { items: [], total: 0, limit, offset }, "复核记录加载失败。");
}

export async function createV1Review(payload: {
  detectionId: string;
  reviewAction: "confirm" | "reject" | "edit";
  reviewer: string;
  reviewNote?: string;
  afterPayload?: Record<string, unknown>;
}): Promise<ReviewRecordV1> {
  return apiPost(
    "/api/v1/reviews",
    {
      detection_id: payload.detectionId,
      review_action: payload.reviewAction,
      reviewer: payload.reviewer,
      review_note: payload.reviewNote ?? null,
      after_payload: payload.afterPayload ?? {},
    },
    "复核提交失败。",
    "演示模式下无法提交复核。",
  );
}