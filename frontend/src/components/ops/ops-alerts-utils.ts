import type { AlertV1 } from "@/lib/types";

export interface AlertViewItem {
  alert: AlertV1;
  dueAtMs: number;
  hasDueAt: boolean;
  isOverdue: boolean;
  isNearDue: boolean;
  slaRank: number;
}

export function deriveDisplayedAlerts(
  alerts: AlertV1[],
  slaFilter: "all" | "near_due" | "overdue",
  prioritizeSlaRisk: boolean,
): AlertViewItem[] {
  const now = Date.now();
  const nearDueMs = 2 * 60 * 60 * 1000;

  const withSla = alerts.map((alert) => {
    const dueAtRaw = alert.trigger_payload?.["sla_due_at"];
    const dueAtMs = typeof dueAtRaw === "string" ? Date.parse(dueAtRaw) : NaN;
    const hasDueAt = Number.isFinite(dueAtMs);
    const isOverdue = hasDueAt && dueAtMs <= now && alert.status !== "resolved";
    const isNearDue = hasDueAt && dueAtMs > now && dueAtMs - now <= nearDueMs && alert.status !== "resolved";
    const slaRank = isOverdue ? 3 : isNearDue ? 2 : alert.status === "open" ? 1 : 0;
    return { alert, dueAtMs, hasDueAt, isOverdue, isNearDue, slaRank };
  });

  const filtered = withSla.filter((item) => {
    if (slaFilter === "overdue") return item.isOverdue;
    if (slaFilter === "near_due") return item.isNearDue;
    return true;
  });

  if (!prioritizeSlaRisk) {
    return filtered;
  }

  return [...filtered].sort((a, b) => {
    if (b.slaRank !== a.slaRank) return b.slaRank - a.slaRank;
    if (a.hasDueAt && b.hasDueAt) return a.dueAtMs - b.dueAtMs;
    if (a.hasDueAt) return -1;
    if (b.hasDueAt) return 1;
    return 0;
  });
}
