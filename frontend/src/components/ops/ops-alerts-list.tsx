"use client";

import Link from "next/link";

import type { AlertViewItem } from "@/components/ops/ops-alerts-utils";

interface OpsAlertsListProps {
  currentHref: string;
  displayedAlerts: AlertViewItem[];
  loading: boolean;
  onAction: (alertId: string, action: "acknowledge" | "resolve") => void | Promise<void>;
  onToggleSelection: (alertId: string) => void;
  selectedAlertIds: string[];
}

export function OpsAlertsList({
  currentHref,
  displayedAlerts,
  loading,
  onAction,
  onToggleSelection,
  selectedAlertIds,
}: OpsAlertsListProps) {
  return (
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
                      onClick={() => onToggleSelection(alert.id)}
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
                            alert.status === "open" ? "border-rose-500/50 text-rose-400 bg-rose-500/5" :
                            alert.status === "acknowledged" ? "border-amber-500/50 text-amber-400 bg-amber-500/5" :
                            "border-emerald-500/50 text-emerald-400 bg-emerald-500/5"
                          }`}>
                            {alert.status === "open" ? "待处置" : alert.status === "acknowledged" ? "确认中" : "已解决"}
                          </span>
                          <span className="text-[9px] font-bold text-white/20 tabular-nums uppercase truncate">严重程度: {alert.alert_level === "critical" ? "紧急" : alert.alert_level}</span>
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
                          onClick={() => void onAction(alert.id, "acknowledge")}
                          disabled={alert.status !== "open"}
                          className="h-10 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 text-[10px] font-black uppercase text-cyan-200 transition-all hover:bg-cyan-500/20 disabled:hidden active:scale-95 whitespace-nowrap"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => void onAction(alert.id, "resolve")}
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
                          <span className={`${item.isOverdue ? "text-rose-500" : item.isNearDue ? "text-amber-500" : "text-emerald-500/60"} shrink-0`}>
                            {item.isOverdue ? "时效违约" : item.isNearDue ? "即将违约" : "正常"}
                          </span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.isOverdue ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : item.isNearDue ? "bg-amber-500" : "bg-emerald-500/40"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="lg:col-span-4 flex justify-end gap-6 border-l border-white/5 pl-6 shrink-0 font-mono text-[10px]">
                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase tracking-widest text-white/20 whitespace-nowrap">触发</p>
                          <p className="font-bold text-white/50 whitespace-nowrap">{new Date(alert.triggered_at).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase tracking-widest text-white/20 whitespace-nowrap">状态</p>
                          <p className="font-bold text-cyan-400/60 tracking-tight whitespace-nowrap capitalize">{alert.status === "open" ? "待处" : alert.status === "acknowledged" ? "确认" : "解决"}</p>
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
  );
}
