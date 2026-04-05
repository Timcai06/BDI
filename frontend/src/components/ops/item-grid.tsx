"use client";
import React from "react";
import type { BatchItemV1 } from "@/lib/types";

interface ItemGridProps {
  items: BatchItemV1[];
  pathFilter: string;
  onPathFilterChange: (value: string) => void;
  showFailedOnly: boolean;
  onShowFailedOnlyToggle: () => void;
  onRetryTask: (taskId: string) => void;
  retryingTaskId: string | null;
  selectedItemIds: string[];
  onToggleSelectItem: (itemId: string) => void;
  onSelectVisibleItems: () => void;
  onClearSelection: () => void;
  onRetrySelectedFailed: () => void;
  batchItemOffset: number;
  batchItemLimit: number;
  batchItemTotal: number;
  onBatchItemPageChange: (offset: number) => void;
}

function renderStatusBadge(status: string): React.ReactElement {
  const tones: Record<string, string> = {
    succeeded: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    running: "bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse",
    queued: "bg-white/5 text-white/40 border-white/10"
  };
  const tone = tones[status] ?? "bg-white/5 text-white/40 border-white/10";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${tone}`}>
      <div className={`h-1 w-1 rounded-full ${status === 'running' ? 'bg-current' : 'bg-current opacity-40'}`} />
      {status}
    </span>
  );
}

export function ItemGrid({
  items,
  pathFilter,
  onPathFilterChange,
  showFailedOnly,
  onShowFailedOnlyToggle,
  onRetryTask,
  retryingTaskId,
  selectedItemIds,
  onToggleSelectItem,
  onSelectVisibleItems,
  onClearSelection,
  onRetrySelectedFailed,
  batchItemOffset,
  batchItemLimit,
  batchItemTotal,
  onBatchItemPageChange,
}: ItemGridProps) {
  const currentPage = Math.floor(batchItemOffset / batchItemLimit) + 1;
  const totalPages = Math.max(1, Math.ceil(batchItemTotal / batchItemLimit));
  const canPrev = batchItemOffset > 0;
  const canNext = batchItemOffset + batchItemLimit < batchItemTotal;
  const selectedVisibleCount = items.filter((item) => selectedItemIds.includes(item.id)).length;

  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.01] backdrop-blur-3xl overflow-hidden transition-all shadow-2xl">
      {/* Table Header / Toolbar */}
      <div className="px-6 py-6 border-b border-white/5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold tracking-[0.1em] text-white uppercase flex items-center gap-2">
              <span className="h-1 w-4 bg-cyan-500 rounded-full" />
              批次素材清单
            </h3>
            <p className="text-[10px] text-white/20 uppercase tracking-widest font-medium">Batch Material & Task Execution Trace</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <input
                value={pathFilter}
                onChange={(e) => onPathFilterChange(e.target.value)}
                placeholder="PATH FILTER..."
                className="w-48 lg:w-64 rounded-xl border border-white/10 bg-black/40 pl-9 pr-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white placeholder-white/10 outline-none transition-all focus:border-cyan-500/40 focus:bg-black/60"
              />
              <svg className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/20 group-focus-within:text-cyan-400/50 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <button
              onClick={onShowFailedOnlyToggle}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black tracking-[0.1em] uppercase transition-all ${
                showFailedOnly
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                  : "border-white/5 bg-white/[0.03] text-white/30 hover:text-white/60 hover:bg-white/[0.06]"
              }`}
            >
              <div className={`h-1 w-1 rounded-full ${showFailedOnly ? 'bg-rose-400 animate-pulse' : 'bg-white/20'}`} />
              Only Failed
            </button>
          </div>
        </div>

        {/* Selection Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <div className="flex items-center gap-2">
              <button
                onClick={onSelectVisibleItems}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
              >
                Select Page
              </button>
              <button
                onClick={onClearSelection}
                className="px-3 py-1.5 rounded-lg border border-white/5 text-white/20 hover:text-white/40 transition-all font-medium"
              >
                Clear
              </button>
            </div>
            <span className="ml-2 py-1 px-3 border-l border-white/5 tabular-nums">
              SELECTED <span className="text-amber-400">{selectedItemIds.length}</span>
              <span className="mx-2 opacity-20">/</span>
              PAGE HIT <span className="text-white/60">{selectedVisibleCount}</span>
            </span>
          </div>

          <button
            onClick={onRetrySelectedFailed}
            disabled={selectedItemIds.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 text-[10px] font-black uppercase tracking-[0.1em] text-rose-300 hover:bg-rose-500/20 disabled:opacity-20 transition-all group"
          >
            <svg className="h-3 w-3 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Batch
          </button>
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-[#05080A]/80 backdrop-blur-xl border-b border-white/10 shadow-xl">
            <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">
              <th className="px-6 py-4">
                 <div className="flex items-center justify-center">
                   <div className="h-3 w-3 rounded border border-white/20" />
                 </div>
              </th>
              <th className="px-6 py-4 font-black">MATERIAL / PATH</th>
              <th className="px-6 py-4 text-center">STATUS</th>
              <th className="px-6 py-4">TASK CONTEXT</th>
              <th className="px-6 py-4">ANALYSIS TRACE</th>
              <th className="px-6 py-4 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {items.map((item) => {
              const isSelected = selectedItemIds.includes(item.id);
              const displayName = item.original_filename || item.source_relative_path?.split("/").pop() || `item-${item.sequence_no}`;
              
              return (
                <tr
                  key={item.id}
                  className={`group transition-all duration-300 ${isSelected ? 'bg-cyan-500/[0.03]' : 'hover:bg-white/[0.02]'}`}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectItem(item.id)}
                        className="h-4 w-4 rounded-md border-white/10 bg-black/40 text-cyan-500 focus:ring-cyan-500/20 cursor-pointer"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-white/80 group-hover:text-white transition-colors">{displayName}</span>
                      <div className="flex items-center gap-2 text-[9px] text-white/20 font-black uppercase tracking-tighter">
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.05]">seq {item.sequence_no}</span>
                        <span className="truncate max-w-[120px]">{item.source_relative_path ?? "Root"}</span>
                        <span>{item.source_device}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {renderStatusBadge(item.processing_status)}
                  </td>
                  <td className="px-6 py-5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] font-black uppercase tracking-tighter text-white/30">
                      <span>Task: <span className="text-white/50">{item.latest_task_status ?? "-"}</span></span>
                      <span>Retry: <span className="text-white/50">{item.latest_task_attempt_no ?? "0"}</span></span>
                      <span className="col-span-2">Policy: <span className="text-cyan-400/40">{item.model_policy ?? "default"}</span></span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex gap-3">
                       <div className="flex flex-col gap-1 items-center">
                         <span className="text-[14px] font-bold text-white/70 tabular-nums">{item.defect_count ?? 0}</span>
                         <span className="text-[8px] font-black uppercase tracking-tighter text-white/20">Defs</span>
                       </div>
                       <div className="w-px h-6 bg-white/5 self-center" />
                       <div className="flex flex-col gap-1 items-center">
                         <span className={`text-[14px] font-bold tabular-nums ${item.review_status === 'reviewed' ? 'text-cyan-400/60' : 'text-white/20'}`}>
                           {item.review_status === 'reviewed' ? 'Y' : 'N'}
                         </span>
                         <span className="text-[8px] font-black uppercase tracking-tighter text-white/20">Rev</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {item.latest_task_id && item.processing_status === "failed" ? (
                      <button
                        onClick={() => onRetryTask(item.latest_task_id!)}
                        disabled={retryingTaskId === item.latest_task_id}
                        className="group/btn relative px-4 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-30 overflow-hidden"
                      >
                        <span className="relative z-10">{retryingTaskId === item.latest_task_id ? "Retrying..." : "Retry"}</span>
                        <div className="absolute inset-0 bg-rose-500/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                      </button>
                    ) : (
                      <div className="h-6 flex items-center justify-end">
                        <div className="h-1 w-1 rounded-full bg-white/10" />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3 animate-pulse">
                     <div className="h-8 w-8 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                     </div>
                     <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/10">No items found in active filter</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between border-t border-white/5 bg-white/[0.01] px-6 py-4">
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
           <span className="text-white/20">Displaying</span>
           <span className="text-white/50 tabular-nums">{batchItemOffset + 1} - {Math.min(batchItemOffset + batchItemLimit, batchItemTotal)}</span>
           <span className="text-white/20 font-light lowercase opacity-50">of</span>
           <span className="text-cyan-400/80 tabular-nums">{batchItemTotal}</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button
              disabled={!canPrev}
              onClick={() => onBatchItemPageChange(Math.max(0, batchItemOffset - batchItemLimit))}
              className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-white/40 hover:text-white transition-all disabled:opacity-10 group"
            >
              <svg className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] font-black text-cyan-400">{currentPage}</span>
              <span className="text-[10px] text-white/20">/</span>
              <span className="text-[10px] font-bold text-white/40">{totalPages}</span>
            </div>
            <button
              disabled={!canNext}
              onClick={() => onBatchItemPageChange(batchItemOffset + batchItemLimit)}
              className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-white/40 hover:text-white transition-all disabled:opacity-10 group"
            >
              <svg className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
