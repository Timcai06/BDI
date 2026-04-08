"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { OpsPageLayout } from "@/components/ops/ops-page-layout";
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
    <OpsPageLayout
      contentClassName="space-y-8 pb-32"
      header={
        <OpsPageHeader
          eyebrow="运维中心"
          title="告警处理中心"
          subtitle={
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-white/30 truncate">
              <span className="uppercase">异常管理 / SLA 强制</span>
              <span className="h-1 w-1 rounded-full bg-white/10" />
              <span className="text-rose-400/60 uppercase">{displayedAlerts.length} 活动告警</span>
            </div>
          }
          accent="rose"
          actions={
            <Link
              href="/dashboard/ops"
              className="group flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 transition-all hover:bg-white/10 hover:text-white shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-1"><path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/></svg>
              返回
            </Link>
          }
        />
      }
    >
        {/* --- Top Zone: Awareness & Triage --- */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-8 relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl group">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/5 blur-[100px]" />
            <div className="relative mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 truncate">筛选与排序 / 智能分拣</h3>
              </div>
            </div>

            <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/20 whitespace-nowrap">处置状态</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 w-full rounded-xl border border-white/5 bg-black/40 px-3 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-cyan-500/50 appearance-none transition-all"
                >
                  <option value="" className="bg-[#121212]">全部状态</option>
                  <option value="open" className="bg-[#121212]">待处理</option>
                  <option value="acknowledged" className="bg-[#121212]">已确认</option>
                  <option value="resolved" className="bg-[#121212]">已解决</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/20 whitespace-nowrap">事件类型</label>
                <input
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="搜索..."
                  className="h-9 w-full rounded-xl border border-white/5 bg-black/40 px-3 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-white/5"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/20 whitespace-nowrap">时效风险</label>
                <select
                  value={slaFilter}
                  onChange={(e) => setSlaFilter(e.target.value as "all" | "near_due" | "overdue")}
                  className="h-9 w-full rounded-xl border border-white/5 bg-black/40 px-3 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-cyan-500/50 appearance-none transition-all"
                >
                  <option value="all" className="bg-[#121212]">全部 SLA</option>
                  <option value="near_due" className="bg-[#121212]">临期 (2h)</option>
                  <option value="overdue" className="bg-[#121212]">已超期</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/20 whitespace-nowrap">风险优先</label>
                <button
                  onClick={() => setPrioritizeSlaRisk((prev) => !prev)}
                  className={`flex h-9 w-full items-center justify-center rounded-xl border px-2 py-2 text-[9px] font-black uppercase transition-all whitespace-nowrap overflow-hidden ${
                    prioritizeSlaRisk
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                      : "border-white/5 bg-white/[0.03] text-white/30 hover:text-white/60"
                  }`}
                >
                   <span className="truncate">{prioritizeSlaRisk ? "优先级: 开" : "优先级: 关"}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 grid grid-cols-2 gap-4 h-full">
            <div className="flex flex-col justify-between rounded-[2rem] border border-rose-500/20 bg-rose-500/5 p-6 transition-all hover:bg-rose-500/10 min-w-0">
              <div className="flex items-center gap-2">
                 <span className={`h-2 w-2 shrink-0 rounded-full bg-rose-500 ${overdueCount > 0 ? 'animate-ping' : ''}`} />
                 <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 truncate">已超期</span>
              </div>
              <p className="mt-4 text-4xl font-black tabular-nums text-white group-hover:scale-110 transition-transform">{overdueCount}</p>
            </div>
            <div className="flex flex-col justify-between rounded-[2rem] border border-amber-500/20 bg-amber-500/5 p-6 transition-all hover:bg-amber-500/10 min-w-0">
              <div className="flex items-center gap-2">
                 <span className={`h-2 w-2 shrink-0 rounded-full bg-amber-500 ${nearDueCount > 0 ? 'animate-pulse' : ''}`} />
                 <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 truncate">临期预警</span>
              </div>
              <p className="mt-4 text-4xl font-black tabular-nums text-white">{nearDueCount}</p>
            </div>
          </div>
        </section>

        {notice && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[rgba(16,185,129,0.15)] px-6 py-4 text-emerald-100 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black italic">✓</div>
            <span className="text-sm font-bold tracking-tight">{notice}</span>
          </motion.div>
        )}

        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 min-h-[600px] backdrop-blur-sm shadow-2xl">
          <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-rose-500/5 blur-[100px]" />
          <div className="relative mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 truncate">告警处置序列</h3>
              <div className="flex items-center gap-2 px-2 py-0.5 rounded-full border border-white/5 bg-white/[0.03] shrink-0">
                <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em] tabular-nums">{displayedAlerts.length} 项</span>
              </div>
            </div>
            <button
               onClick={toggleSelectAll}
               className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-cyan-400 transition-colors whitespace-nowrap"
            >
               {selectedAlertIds.length === displayedAlerts.length && displayedAlerts.length > 0 ? "取消全选" : "全选当前"}
            </button>
          </div>
          
          {loading ? (
            <div className="space-y-4 page-enter">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.01] p-6">
                  <div className="flex items-start gap-5">
                    <div className="skeleton-pulse h-4 w-4 !rounded shrink-0" />
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="skeleton-bar h-2 w-16" />
                          <div className="skeleton-bar h-5 w-48" />
                        </div>
                        <div className="flex gap-2">
                          <div className="skeleton-pulse h-10 w-16 !rounded-xl" />
                          <div className="skeleton-pulse h-10 w-16 !rounded-xl" />
                        </div>
                      </div>
                      <div className="skeleton-bar h-1 w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative space-y-4 max-h-[1200px] overflow-auto scroll-smooth pr-6 custom-scrollbar">
                {displayedAlerts.map((item, idx) => {
                  const alert = item.alert;
                  const isSelected = selectedAlertIds.includes(alert.id);
                  const isCritical = alert.alert_level === "critical";
                  const now = Date.now();
                  const remainingMs = item.hasDueAt ? item.dueAtMs - now : null;
                  const progress = remainingMs ? Math.max(0, Math.min(100, (remainingMs / (4 * 3600 * 1000)) * 100)) : 100;

                  return (
                    <div 
                      key={alert.id}
                      className={`list-item-enter group relative overflow-hidden rounded-2xl border transition-all duration-500 ${
                        isSelected 
                          ? "border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_32px_rgba(6,182,212,0.1)]" 
                          : isCritical 
                            ? "border-rose-500/30 bg-rose-500/5 shadow-[0_4px_24px_rgba(244,63,94,0.05)]"
                            : "border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/20"
                      }`}
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      {isCritical && !isSelected && (
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-rose-500/5 to-transparent transition-transform duration-[3s] group-hover:translate-x-full" />
                      )}
                      <div className="flex items-start gap-5 p-6">
                        <div className="flex h-5 items-center shrink-0">
                          <div 
                            onClick={() => toggleAlertSelection(alert.id)}
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all cursor-pointer ${
                              isSelected ? "border-cyan-500 bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.8)]" : "border-white/10 bg-black/40 hover:border-white/30"
                            }`}
                          >
                            {isSelected && <svg width="10" height="8" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 1"/></svg>}
                          </div>
                        </div>
                        <div className="flex-1 space-y-4 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-6">
                            <div className="space-y-1.5 flex-1 min-w-[200px]">
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border transition-all shrink-0 ${
                                  alert.status === 'open' ? 'border-rose-500/50 text-rose-400 bg-rose-500/5' : 
                                  alert.status === 'acknowledged' ? 'border-amber-500/50 text-amber-400 bg-amber-500/5' : 
                                  'border-emerald-500/50 text-emerald-400 bg-emerald-500/5'
                                }`}>
                                  {alert.status === 'open' ? '待处置' : alert.status === 'acknowledged' ? '确认中' : '已解决'}
                                </span>
                                <span className="text-[9px] font-bold text-white/20 tabular-nums uppercase truncate">严重程度: {alert.alert_level === 'critical' ? '紧急' : alert.alert_level}</span>
                              </div>
                              <h4 className="text-lg font-black tracking-tight text-white uppercase group-hover:text-cyan-400 transition-colors truncate">
                                {alert.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {alert.batch_item_id && (
                                <Link
                                  href={`/dashboard/ops/items/${encodeURIComponent(alert.batch_item_id)}?returnTo=${encodeURIComponent(currentHref)}`}
                                  className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/40 hover:bg-white/10 hover:text-white transition-all shadow-inner"
                                  title="核实"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                                </Link>
                              )}
                              <button
                                onClick={() => handleAction(alert.id, "acknowledge")}
                                disabled={alert.status !== "open"}
                                className="h-10 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 text-[10px] font-black uppercase text-cyan-200 transition-all hover:bg-cyan-500/20 disabled:hidden active:scale-95 whitespace-nowrap"
                              >
                                确认
                              </button>
                              <button
                                onClick={() => handleAction(alert.id, "resolve")}
                                disabled={alert.status === "resolved"}
                                className="h-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-[10px] font-black uppercase text-emerald-200 transition-all hover:bg-emerald-500/20 disabled:hidden active:scale-95 whitespace-nowrap"
                              >
                                关闭
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                            <div className="lg:col-span-8 flex flex-col gap-1.5 min-w-0">
                              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden">
                                <span className="text-white/20 truncate mr-2">SLA 时效强制执行</span>
                                <span className={`shrink-0 ${item.isOverdue ? 'text-rose-500' : item.isNearDue ? 'text-amber-500' : 'text-emerald-500/60'}`}>
                                  {item.isOverdue ? '时效违约' : item.isNearDue ? '即将违约' : '正常'}
                                </span>
                              </div>
                              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  className={`h-full ${item.isOverdue ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : item.isNearDue ? 'bg-amber-500' : 'bg-emerald-500/40'}`} 
                                />
                              </div>
                            </div>
                            <div className="lg:col-span-4 flex justify-end gap-6 border-l border-white/5 pl-6 shrink-0 font-mono text-[10px]">
                               <div className="text-right">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-white/20 whitespace-nowrap">触发</p>
                                  <p className="font-bold text-white/50 whitespace-nowrap">{new Date(alert.triggered_at).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-white/20 whitespace-nowrap">状态</p>
                                  <p className="font-bold text-cyan-400/60 tracking-tight whitespace-nowrap capitalize">{alert.status === 'open' ? '待处' : alert.status === 'acknowledged' ? '确认' : '解决'}</p>
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {!loading && displayedAlerts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-40 gap-4 text-center">
                   <div className="relative rounded-3xl bg-emerald-500/5 p-12 border border-emerald-500/10 mb-2">
                     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                   </div>
                   <h4 className="text-2xl font-light italic text-white/40 tracking-tight uppercase">暂无风险</h4>
                   <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.4em]">SLA 环境正常</p>
                </div>
              )}
            </div>
          )}
        </section>

        <AnimatePresence>
          {selectedAlertIds.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-6 rounded-[2rem] border border-cyan-500/30 bg-black/80 px-8 py-5 backdrop-blur-2xl shadow-[0_40px_80px_-12px_rgba(6,182,212,0.5)] max-w-[95vw] overflow-hidden"
            >
              <div className="flex items-center gap-4 border-r border-white/10 pr-6 mr-2 shrink-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 font-black italic">
                   {selectedAlertIds.length}
                </div>
                <div className="hidden sm:block">
                   <p className="text-[10px] font-black uppercase tracking-widest text-white">批量中</p>
                   <p className="text-[9px] font-bold text-white/30 uppercase tracking-tighter">个已选节点</p>
                </div>
              </div>
              <div className="flex items-center gap-4 min-w-0">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="备注..."
                  className="h-10 w-24 sm:w-48 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold text-white outline-none focus:border-cyan-500/50 truncate"
                />
                <button
                  onClick={() => handleBulkAction("acknowledge")}
                  className="h-10 rounded-xl bg-cyan-500 px-4 sm:px-6 text-[10px] font-black uppercase text-black hover:bg-cyan-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.4)] whitespace-nowrap"
                >
                  确认
                </button>
                <button
                  onClick={() => handleBulkAction("resolve")}
                  className="h-10 rounded-xl border border-white/20 bg-white/10 px-4 sm:px-6 text-[10px] font-black uppercase text-white hover:bg-white/20 transition-all active:scale-95 whitespace-nowrap"
                >
                  解决
                </button>
                <button
                   onClick={() => setSelectedAlertIds([])}
                   className="h-10 w-10 shrink-0 flex items-center justify-center text-white/20 hover:text-white transition-colors"
                >
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </OpsPageLayout>
  );
}
