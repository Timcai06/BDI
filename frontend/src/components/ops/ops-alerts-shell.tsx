"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { listV1Alerts, updateV1AlertStatus } from "@/lib/predict-client";
import type { AlertV1 } from "@/lib/types";

export function OpsAlertsShell() {
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

  const currentHref = (() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (eventType) params.set("eventType", eventType);
    if (sortBy !== "triggered_at") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (slaFilter !== "all") params.set("sla", slaFilter);
    if (!prioritizeSlaRisk) params.set("slaPriority", "0");
    return params.toString() ? `${pathname}?${params.toString()}` : pathname;
  })();

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
    if (displayedAlerts.length === 0) {
      return;
    }
    setSelectedAlertIds((prev) =>
      prev.length === displayedAlerts.length ? [] : displayedAlerts.map((item) => item.alert.id)
    );
  }

  const displayedAlerts = useMemo(() => {
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
      if (slaFilter === "overdue") {
        return item.isOverdue;
      }
      if (slaFilter === "near_due") {
        return item.isNearDue;
      }
      return true;
    });

    if (!prioritizeSlaRisk) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      if (b.slaRank !== a.slaRank) {
        return b.slaRank - a.slaRank;
      }
      if (a.hasDueAt && b.hasDueAt) {
        return a.dueAtMs - b.dueAtMs;
      }
      if (a.hasDueAt) {
        return -1;
      }
      if (b.hasDueAt) {
        return 1;
      }
      return 0;
    });
  }, [alerts, prioritizeSlaRisk, slaFilter]);

  const overdueCount = useMemo(() => displayedAlerts.filter((item) => item.isOverdue).length, [displayedAlerts]);
  const nearDueCount = useMemo(() => displayedAlerts.filter((item) => item.isNearDue).length, [displayedAlerts]);

  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden bg-black/40 backdrop-blur-3xl">
      <div className="relative flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rose-400 m-0">ALERTS</p>
            </div>
            <h1 className="text-xl lg:text-3xl font-black tracking-tight text-white uppercase">告警中心</h1>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">
              MANAGEMENT & ACKNOWLEDGEMENT / <span className="font-mono">{displayedAlerts.length} ACTIVE</span>
            </p>
          </div>
          <Link
            href="/dashboard/ops"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            返回巡检工作台
          </Link>
        </header>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 m-0">筛选条件 / FILTERS</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">STATUS</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all"
                >
                  <option value="">all status</option>
                  <option value="open">open</option>
                  <option value="acknowledged">acknowledged</option>
                  <option value="resolved">resolved</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">EVENT TYPE</label>
                <input
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="event_type"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">SORT BY</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "triggered_at" | "created_at" | "updated_at")}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all"
                >
                  <option value="triggered_at">triggered_at</option>
                  <option value="created_at">created_at</option>
                  <option value="updated_at">updated_at</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">ORDER</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all"
                >
                  <option value="desc">desc</option>
                  <option value="asc">asc</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">SLA RISK</label>
                <select
                  value={slaFilter}
                  onChange={(e) => setSlaFilter(e.target.value as "all" | "near_due" | "overdue")}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all"
                >
                  <option value="all">SLA: all</option>
                  <option value="near_due">SLA: near_due(2h)</option>
                  <option value="overdue">SLA: overdue</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setPrioritizeSlaRisk((prev) => !prev)}
                className={`rounded-xl border px-4 py-2 text-[11px] font-bold transition-all ${
                  prioritizeSlaRisk
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                    : "border-white/10 text-white/40 hover:bg-white/5"
                }`}
              >
                {prioritizeSlaRisk ? "SLA RISK PRIORITY: ON" : "SLA RISK PRIORITY: OFF"}
              </button>
              <div className="h-4 w-[1px] bg-white/5 mx-1" />
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-rose-300/80 uppercase">OVERDUE: {overdueCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-amber-300/80 uppercase">NEAR DUE: {nearDueCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 m-0">快速操作 / ACTIONS</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">OPERATOR</label>
                <input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="operator"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/10"
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">NOTE</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="note"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <button
                onClick={toggleSelectAll}
                className="rounded-xl border border-white/10 bg-white/5 py-2 hover:bg-white/10 transition-colors text-white/80"
              >
                {selectedAlertIds.length === displayedAlerts.length && displayedAlerts.length > 0 ? "取消全选" : "全选当前"}
              </button>
              <button
                disabled={selectedAlertIds.length === 0}
                onClick={() => handleBulkAction("acknowledge")}
                className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-2 text-cyan-200 disabled:opacity-30 transition-all active:scale-[0.98]"
              >
                批量确认
              </button>
              <button
                disabled={selectedAlertIds.length === 0}
                onClick={() => handleBulkAction("resolve")}
                className="col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-amber-200 disabled:opacity-30 transition-all active:scale-[0.98]"
              >
                批量解决 (RESOLVE {selectedAlertIds.length})
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-[rgba(244,63,94,0.15)] px-6 py-4 text-rose-100 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="h-5 w-5 rounded-full bg-rose-500 flex items-center justify-center text-[10px] font-black">!</div>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
        
        {notice && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[rgba(16,185,129,0.15)] px-6 py-4 text-emerald-100 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black italic">✓</div>
            <span className="text-sm font-medium">{notice}</span>
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 m-0">告警列表 / ALERT QUEUE</h3>
              <div className="flex items-center gap-2 px-2 py-0.5 rounded-full border border-white/5 bg-white/[0.03]">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">{displayedAlerts.length} RECORDS</span>
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-cyan-500 border-r-2 border-transparent" />
                <p className="text-[10px] uppercase tracking-widest text-white/30 animate-pulse">Syncing Alerts...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[1200px] overflow-auto scroll-smooth pr-2 custom-scrollbar">
              {displayedAlerts.map((item) => {
                const alert = item.alert;
                const dueAtText = item.hasDueAt
                  ? new Date(item.dueAtMs).toLocaleString("zh-CN", { hour12: false })
                  : "N/A";
                const slaBadge = item.isOverdue
                  ? "OVERDUE"
                  : item.isNearDue
                    ? "NEAR DUE"
                    : "SLA NORMAL";
                const slaBadgeClass = item.isOverdue
                  ? "border-rose-300/35 bg-rose-400/10 text-rose-200"
                  : item.isNearDue
                    ? "border-amber-300/35 bg-amber-400/10 text-amber-200"
                    : "border-emerald-300/35 bg-emerald-400/10 text-emerald-200";
                
                const isSelected = selectedAlertIds.includes(alert.id);

                return (
                  <div 
                    key={alert.id} 
                    className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
                      isSelected 
                        ? "border-cyan-500/40 bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.05)]" 
                        : "border-white/10 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/20"
                    }`}
                  >
                    <div className="p-4 lg:p-5 flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAlertSelection(alert.id)}
                            className="h-4 w-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-black transition-all cursor-pointer"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-white/10 ${
                              alert.alert_level === "critical" ? "text-rose-400 border-rose-500/30 bg-rose-500/10" : "text-white/40"
                            }`}>
                              {alert.alert_level}
                            </span>
                            <span className="text-[10px] font-mono text-white/20">ID: {alert.id}</span>
                          </div>
                          <h4 className="text-base font-semibold text-white tracking-tight leading-tight group-hover:text-cyan-100 transition-colors">
                            {alert.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/40">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="uppercase text-white/20 tracking-tighter">TYPE</span>
                              <span className="text-white/60">{alert.event_type}</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="uppercase text-white/20 tracking-tighter">STATUS</span>
                              <span className="text-white/60">{alert.status}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="uppercase text-white/20 tracking-tighter font-mono">SLA DUE</span>
                              <span className="text-white/60">{dueAtText}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest ${slaBadgeClass}`}>{slaBadge}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-1">
                        {alert.batch_item_id ? (
                          <Link
                            href={`/dashboard/ops/items/${encodeURIComponent(alert.batch_item_id)}?returnTo=${encodeURIComponent(currentHref)}`}
                            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                          >
                            查看图片
                          </Link>
                        ) : null}
                        <button
                          disabled={alert.status !== "open"}
                          onClick={() => handleAction(alert.id, "acknowledge")}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-200 transition-all hover:bg-cyan-500/20 disabled:hidden active:scale-95"
                        >
                          ACKNOWLEDGE
                        </button>
                        <button
                          disabled={alert.status === "resolved"}
                          onClick={() => handleAction(alert.id, "resolve")}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-200 transition-all hover:bg-amber-500/20 disabled:hidden active:scale-95"
                        >
                          RESOLVE
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {displayedAlerts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-4 mb-4 border border-emerald-500/20">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-light text-white/80">目前没有待处理告警</h4>
                  <p className="text-sm text-white/40 mt-1 uppercase tracking-widest">System Clear / SLA Healthy</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
