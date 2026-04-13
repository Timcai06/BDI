import type { AlertRulesConfigV1Response, OpsAuditLogListV1Response, OpsMetricsV1Response } from "@/lib/types";
import { apiGet, apiPut, buildQuery } from "@/lib/predict-client-base";

const DEMO_METRICS: OpsMetricsV1Response = {
  window_hours: 24,
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
  failure_code_breakdown: {},
};

const DEMO_ALERT_RULES: AlertRulesConfigV1Response = {
  profile_name: "JTG-v1",
  alert_auto_enabled: true,
  count_threshold: 3,
  category_watchlist: ["seepage"],
  category_confidence_threshold: 0.8,
  repeat_escalation_hits: 2,
  sla_hours_by_level: { low: 72, medium: 48, high: 24, critical: 12 },
  near_due_hours: 2,
  updated_at: new Date().toISOString(),
  updated_by: "demo",
};

export async function getV1OpsMetrics(windowHours: number = 24): Promise<OpsMetricsV1Response> {
  const normalizedWindow = Math.max(1, Math.floor(windowHours));
  const path = `/api/v1/ops/metrics?window_hours=${encodeURIComponent(String(normalizedWindow))}`;
  return apiGet(path, { ...DEMO_METRICS, window_hours: normalizedWindow }, "运营指标加载失败。");
}

export async function getV1AlertRules(): Promise<AlertRulesConfigV1Response> {
  return apiGet("/api/v1/ops/alert-rules", DEMO_ALERT_RULES, "告警规则加载失败。");
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
  return apiPut(
    "/api/v1/ops/alert-rules",
    {
      updated_by: payload.updatedBy,
      profile_name: payload.profileName ?? null,
      alert_auto_enabled: payload.alertAutoEnabled ?? null,
      count_threshold: payload.countThreshold ?? null,
      category_watchlist: payload.categoryWatchlist ?? null,
      category_confidence_threshold: payload.categoryConfidenceThreshold ?? null,
      repeat_escalation_hits: payload.repeatEscalationHits ?? null,
      sla_hours_by_level: payload.slaHoursByLevel ?? null,
      near_due_hours: payload.nearDueHours ?? null,
    },
    "告警规则更新失败。",
    "演示模式下无法更新告警规则。",
  );
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
  const query = buildQuery({
    actor: params?.actor,
    date_from: params?.dateFrom,
    date_to: params?.dateTo,
    limit,
    offset,
  });
  return apiGet(`/api/v1/ops/alert-rules/audit${query}`, { items: [], total: 0, limit, offset }, "规则审计日志加载失败。");
}