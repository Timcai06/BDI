import type { AlertListV1Response, AlertV1 } from "@/lib/types";
import { apiGet, apiPost, buildQuery } from "@/lib/predict-client-base";

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
  const query = buildQuery({
    batch_id: params.batchId,
    status_filter: params.statusFilter,
    event_type: params.eventType,
    sort_by: params.sortBy ?? "triggered_at",
    sort_order: params.sortOrder ?? "desc",
    limit,
    offset,
  });
  return apiGet(`/api/v1/alerts${query}`, { items: [], total: 0, limit, offset }, "告警列表加载失败。");
}

export async function updateV1AlertStatus(payload: {
  alertId: string;
  action: "acknowledge" | "resolve";
  operator: string;
  note?: string;
}): Promise<AlertV1> {
  return apiPost(
    `/api/v1/alerts/${encodeURIComponent(payload.alertId)}/status`,
    {
      action: payload.action,
      operator: payload.operator,
      note: payload.note ?? null,
    },
    "告警状态更新失败。",
    "演示模式下无法更新告警状态。",
  );
}