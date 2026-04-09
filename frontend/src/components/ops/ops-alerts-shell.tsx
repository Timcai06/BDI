"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

import { OpsAlertsBulkBar } from "@/components/ops/ops-alerts-bulk-bar";
import { OpsAlertsList } from "@/components/ops/ops-alerts-list";
import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { OpsPageLayout } from "@/components/ops/ops-page-layout";
import { useOpsAlertsState } from "@/components/ops/use-ops-alerts-state";

export function OpsAlertsShell() {
  const {
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
    overdueCount,
    prioritizeSlaRisk,
    selectedAlertIds,
    setEventType,
    setNote,
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
  } = useOpsAlertsState();

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
          
          <OpsAlertsList
            currentHref={currentHref}
            displayedAlerts={displayedAlerts}
            loading={loading}
            onAction={handleAction}
            onToggleSelection={toggleAlertSelection}
            selectedAlertIds={selectedAlertIds}
          />
        </section>

        <AnimatePresence>
          <motion.div initial={false}>
            <OpsAlertsBulkBar
              note={note}
              onBulkAction={handleBulkAction}
              onClearSelection={() => setSelectedAlertIds([])}
              onNoteChange={setNote}
              selectedCount={selectedAlertIds.length}
            />
          </motion.div>
        </AnimatePresence>
    </OpsPageLayout>
  );
}
