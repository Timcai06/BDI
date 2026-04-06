"use client";

import { motion } from "framer-motion";
import type { BatchV1, BridgeV1, BatchStatsV1Response } from "@/lib/types";

interface BatchStatusBarProps {
  stats: BatchStatsV1Response | null;
  selectedBridge: BridgeV1 | null;
  selectedBatch: BatchV1 | null;
  batchItemTotal: number;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function BatchStatusBar({
  stats,
  selectedBridge,
  selectedBatch,
  batchItemTotal,
  expanded,
  onToggleExpand,
}: BatchStatusBarProps) {
  const statusBreakdown = stats?.status_breakdown ?? {};
  const queued = statusBreakdown.queued ?? 0;
  const running = statusBreakdown.running ?? 0;
  const succeeded = statusBreakdown.succeeded ?? 0;
  const failed = statusBreakdown.failed ?? 0;
  
  const alertCount = Object.values(stats?.alert_breakdown ?? {}).reduce((sum, v) => sum + v, 0);
  const defectCount = Object.values(stats?.category_breakdown ?? {}).reduce((sum, v) => sum + v, 0);

  // Calculate percentages for the multi-segmented progress bar
  const total = batchItemTotal || 1;
  const pSucceeded = (succeeded / total) * 100;
  const pRunning = (running / total) * 100;
  const pFailed = (failed / total) * 100;
  const pQueued = (queued / total) * 100;

  return (
    <section className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.05]">
      {/* Glow effect */}
      <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/5 blur-[100px] transition-all group-hover:bg-cyan-500/10" />
      
      <button
        type="button"
        onClick={onToggleExpand}
        className="relative flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 text-left"
      >
        <div className="grid flex-1 gap-4 sm:gap-6 grid-cols-2 md:grid-cols-4 lg:grid-cols-5 items-center">
          {/* Tile 1: Asset Information */}
          <div className="relative min-w-[120px]">
            <div className="mb-1 flex items-center gap-2 opacity-40">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7l9-4 9 4M5 7v14M19 7v14M10 21v-8h4v8m-7-8h10"/></svg>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]">资产</p>
            </div>
            <p className="truncate text-xs font-black tracking-tight text-white uppercase">{selectedBridge?.bridge_name ?? "-"}</p>
            <p className="mt-0.5 text-[9px] font-bold text-cyan-400/60 tabular-nums">{selectedBridge?.bridge_code ?? "-"}</p>
          </div>

          {/* Tile 2: Batch Information */}
          <div className="relative min-w-[120px]">
            <div className="mb-1 flex items-center gap-2 opacity-40">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12M16 2v4M8 2v4M3 10h18"/></svg>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]">批次</p>
            </div>
            <p className="truncate text-xs font-black tracking-tight text-white uppercase">{selectedBatch?.batch_code ?? "-"}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`h-1 w-1 rounded-full ${selectedBatch?.status === "completed" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"}`} />
              <p className="text-[9px] font-bold text-white/50">{selectedBatch?.status ?? "-"}</p>
            </div>
          </div>

          {/* Tile 3: Segmented Progress Bar & Tasks */}
          <div className="relative col-span-2 md:col-span-1">
            <div className="mb-1 flex items-center justify-between opacity-40">
              <div className="flex items-center gap-2">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                <p className="text-[9px] font-black uppercase tracking-[0.2em]">进度</p>
              </div>
              <p className="text-[9px] font-bold tabular-nums">{succeeded}/{batchItemTotal}</p>
            </div>
            
            {/* Multi-segmented Progress Bar */}
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pSucceeded}%` }}
                className="absolute left-0 top-0 h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" 
              />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pRunning}%` }}
                style={{ left: `${pSucceeded}%` }}
                className="absolute top-0 h-full bg-cyan-400 animate-pulse" 
              />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pFailed}%` }}
                style={{ left: `${pSucceeded + pRunning}%` }}
                className="absolute top-0 h-full bg-rose-500" 
              />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pQueued}%` }}
                style={{ left: `${pSucceeded + pRunning + pFailed}%` }}
                className="absolute top-0 h-full bg-white/20" 
              />
            </div>

            <div className="mt-1.5 flex items-center gap-2.5">
              {running > 0 && (
                <div className="flex items-center gap-1">
                  <span className="h-0.5 w-0.5 animate-ping rounded-full bg-cyan-400" />
                  <span className="text-[8px] font-bold text-cyan-400/80 tabular-nums">{running}R</span>
                </div>
              )}
              {failed > 0 && (
                <div className="flex items-center gap-1">
                  <span className="h-0.5 w-0.5 rounded-full bg-rose-500" />
                  <span className="text-[8px] font-bold text-rose-500/80 tabular-nums">{failed}F</span>
                </div>
              )}
              {queued > 0 && (
                <div className="flex items-center gap-1">
                  <span className="h-0.5 w-0.5 rounded-full bg-white/20" />
                  <span className="text-[8px] font-bold text-white/30 tabular-nums">{queued}Q</span>
                </div>
              )}
            </div>
          </div>

          {/* Tile 4: Alerts & Defects */}
          <div className="relative">
            <div className="mb-1 flex items-center gap-2 opacity-40">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"/></svg>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]">预警</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <p className={`text-xs font-black tabular-nums ${alertCount > 0 ? "text-rose-400" : "text-white/40"}`}>{alertCount}</p>
                <p className="text-[8px] font-bold uppercase text-white/30">告警</p>
              </div>
              <div className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-1.5">
                <p className={`text-xs font-black tabular-nums ${defectCount > 0 ? "text-amber-400" : "text-white/40"}`}>{defectCount}</p>
                <p className="text-[8px] font-bold uppercase text-white/30">病害</p>
              </div>
            </div>
          </div>

          {/* Tile 5: Expand Toggle Button */}
          <div className="hidden lg:flex relative items-center justify-end">
              <span className="text-[9px] font-black uppercase tracking-widest">{expanded ? "收起面板" : "精细过滤"}</span>
              <div className={`transition-transform duration-500 ${expanded ? "rotate-180" : ""}`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
        </div>
      </button>
    </section>
  );
}
