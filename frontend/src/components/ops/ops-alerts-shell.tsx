"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listV1Alerts, updateV1AlertStatus } from "@/lib/predict-client";
import type { AlertV1 } from "@/lib/types";

export function OpsAlertsShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertV1[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [eventType, setEventType] = useState("");
  const [sortBy, setSortBy] = useState<"triggered_at" | "created_at" | "updated_at">("triggered_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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
        offset: 0
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
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, eventType, sortBy, sortOrder]);

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
    if (selectedAlertIds.length === 0) {
      return;
    }
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
            note
          })
        )
      );
      setNotice(`批量${action === "acknowledge" ? "确认" : "关闭"}完成，处理 ${eligible.length} 条告警`);
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量告警状态更新失败");
    }
  }

  function toggleAlertSelection(alertId: string) {
    setSelectedAlertIds((prev) =>
      prev.includes(alertId) ? prev.filter((id) => id !== alertId) : [...prev, alertId]
    );
  }

  function toggleSelectAll() {
    if (alerts.length === 0) {
      return;
    }
    setSelectedAlertIds((prev) => (prev.length === alerts.length ? [] : alerts.map((item) => item.id)));
  }

  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-white">告警中心</h1>
          <p className="text-sm text-white/60 mt-1">按状态筛选并执行 acknowledged / resolved 流转</p>
        </div>
        <Link
          href="/dashboard/ops"
          className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
        >
          返回巡检工作台
        </Link>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white/90">筛选与操作参数</h3>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          >
            <option value="">all status</option>
            <option value="open">open</option>
            <option value="acknowledged">acknowledged</option>
            <option value="resolved">resolved</option>
          </select>
          <input
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="event_type"
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "triggered_at" | "created_at" | "updated_at")}
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          >
            <option value="triggered_at">triggered_at</option>
            <option value="created_at">created_at</option>
            <option value="updated_at">updated_at</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          >
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-xs">
          <input
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder="operator"
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="note"
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={toggleSelectAll}
            className="rounded border border-white/20 px-3 py-2 text-white/80 hover:bg-white/10"
          >
            {selectedAlertIds.length === alerts.length && alerts.length > 0 ? "取消全选" : "全选当前列表"}
          </button>
          <button
            disabled={selectedAlertIds.length === 0}
            onClick={() => handleBulkAction("acknowledge")}
            className="rounded border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-cyan-200 disabled:opacity-40"
          >
            批量 acknowledge
          </button>
          <button
            disabled={selectedAlertIds.length === 0}
            onClick={() => handleBulkAction("resolve")}
            className="rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-amber-200 disabled:opacity-40"
          >
            批量 resolve
          </button>
          <span className="text-white/50">已选 {selectedAlertIds.length} 条</span>
        </div>
      </section>

      {error && <div className="rounded border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
      {notice && <div className="rounded border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</div>}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white/90 mb-3">告警列表</h3>
        {loading ? (
          <div className="text-sm text-white/60">加载中...</div>
        ) : (
          <div className="space-y-2 max-h-[520px] overflow-auto">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAlertIds.includes(alert.id)}
                      onChange={() => toggleAlertSelection(alert.id)}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-white">{alert.title}</div>
                      <div className="text-white/60 mt-1">
                        id={alert.id} | {alert.event_type} | {alert.alert_level} | {alert.status}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={alert.status !== "open"}
                      onClick={() => handleAction(alert.id, "acknowledge")}
                      className="rounded border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-cyan-200 disabled:opacity-40"
                    >
                      acknowledge
                    </button>
                    <button
                      disabled={alert.status === "resolved"}
                      onClick={() => handleAction(alert.id, "resolve")}
                      className="rounded border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-amber-200 disabled:opacity-40"
                    >
                      resolve
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {alerts.length === 0 && <div className="text-xs text-white/50">暂无告警</div>}
          </div>
        )}
      </section>
    </div>
  );
}
