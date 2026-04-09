import type { AlertListV1Response, AlertV1 } from "@/lib/types";
import { API_BASE_URL, buildQuery, fetchWithTimeout, readErrorMessage } from "@/lib/predict-client-base";

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
    offset,
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
        note: payload.note ?? null,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "告警状态更新失败。"));
  }
  return (await response.json()) as AlertV1;
}
