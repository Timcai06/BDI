"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { listV1Alerts, updateV1AlertStatus } from "@/lib/predict-client";
import type { AlertV1 } from "@/lib/types";
import { deriveDisplayedAlerts } from "@/components/ops/ops-alerts-utils";

export function useOpsAlertsState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertV1[]>([]);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [eventType, setEventType] = useState(searchParams.get("eventType") ?? "");
  const [sortBy, setSortBy] = useState<"triggered_at" | "created_at" | "updated_at">(
    (searchParams.get("sortBy") as "triggered_at" | "created_at" | "updated_at") ?? "triggered_at",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("sortOrder") as "asc" | "desc") ?? "desc",
  );
  const [slaFilter, setSlaFilter] = useState<"all" | "near_due" | "overdue">(
    (searchParams.get("sla") as "all" | "near_due" | "overdue") ?? "all",
  );
  const [prioritizeSlaRisk, setPrioritizeSlaRisk] = useState(searchParams.get("slaPriority") !== "0");

  const [operator, setOperator] = useState("ops-center");
  const [note, setNote] = useState("");
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      const response = await listV1Alerts({
        statusFilter: statusFilter || undefined,
        eventType: eventType || undefined,
        sortBy,
        sortOrder,
        limit: 200,
        offset: 0,
      });
      setAlerts(response.items);
      setSelectedAlertIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "告警列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAlerts();
  }, [eventType, sortBy, sortOrder, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (eventType) params.set("eventType", eventType);
    if (sortBy !== "triggered_at") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (slaFilter !== "all") params.set("sla", slaFilter);
    if (!prioritizeSlaRisk) params.set("slaPriority", "0");
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [eventType, pathname, prioritizeSlaRisk, router, slaFilter, sortBy, sortOrder, statusFilter]);

  const currentHref = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (eventType) params.set("eventType", eventType);
    if (sortBy !== "triggered_at") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (slaFilter !== "all") params.set("sla", slaFilter);
    if (!prioritizeSlaRisk) params.set("slaPriority", "0");
    return params.toString() ? `${pathname}?${params.toString()}` : pathname;
  }, [eventType, pathname, prioritizeSlaRisk, slaFilter, sortBy, sortOrder, statusFilter]);

  async function handleAction(alertId: string, action: "acknowledge" | "resolve") {
    setNotice(null);
    setError(null);
    try {
      await updateV1AlertStatus({ alertId, action, operator, note });
      setNotice(`告警 ${alertId} 已${action === "acknowledge" ? "确认" : "关闭"}`);
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "告警状态更新失败");
    }
  }

  async function handleBulkAction(action: "acknowledge" | "resolve") {
    if (selectedAlertIds.length === 0) return;
    setNotice(null);
    setError(null);
    try {
      const selectedSet = new Set(selectedAlertIds);
      const eligible = alerts
        .filter((item) => selectedSet.has(item.id))
        .filter((item) => (action === "acknowledge" ? item.status === "open" : item.status !== "resolved"));
      await Promise.all(
        eligible.map((item) =>
          updateV1AlertStatus({
            alertId: item.id,
            action,
            operator,
            note,
          }),
        ),
      );
      setNotice(`批量${action === "acknowledge" ? "确认" : "关闭"}完成，处理 ${eligible.length} 条告警`);
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量告警状态更新失败");
    }
  }

  function toggleAlertSelection(alertId: string) {
    setSelectedAlertIds((prev) => (prev.includes(alertId) ? prev.filter((id) => id !== alertId) : [...prev, alertId]));
  }

  const displayedAlerts = useMemo(
    () => deriveDisplayedAlerts(alerts, slaFilter, prioritizeSlaRisk),
    [alerts, prioritizeSlaRisk, slaFilter],
  );

  function toggleSelectAll() {
    if (displayedAlerts.length === 0) return;
    setSelectedAlertIds((prev) =>
      prev.length === displayedAlerts.length ? [] : displayedAlerts.map((item) => item.alert.id),
    );
  }

  const overdueCount = useMemo(() => displayedAlerts.filter((item) => item.isOverdue).length, [displayedAlerts]);
  const nearDueCount = useMemo(() => displayedAlerts.filter((item) => item.isNearDue).length, [displayedAlerts]);

  return {
    alerts,
    currentHref,
    displayedAlerts,
    error,
    eventType,
    handleAction,
    handleBulkAction,
    loading,
    nearDueCount,
    note,
    notice,
    operator,
    overdueCount,
    prioritizeSlaRisk,
    selectedAlertIds,
    setEventType,
    setNote,
    setOperator,
    setPrioritizeSlaRisk,
    setSelectedAlertIds,
    setSlaFilter,
    setSortBy,
    setSortOrder,
    setStatusFilter,
    slaFilter,
    sortBy,
    sortOrder,
    statusFilter,
    toggleAlertSelection,
    toggleSelectAll,
  };
}
