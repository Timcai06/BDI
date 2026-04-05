"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    succeeded: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    running: "bg-sky-500/10 text-sky-400 border-sky-500/20 animate-pulse",
    queued: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    pending: "bg-white/5 text-white/40 border-white/10",
    reviewed: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
  };
  const tone = tones[status] ?? "bg-white/5 text-white/40 border-white/10";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${tone}`}>
      <div className={`h-1 w-1 rounded-full ${status === 'running' ? 'bg-current' : 'bg-current opacity-40'}`} />
      {status === 'succeeded' ? '已完成' : status === 'failed' ? '失败' : status === 'running' ? '执行中' : status === 'queued' ? '排队中' : status === 'reviewed' ? '已复核' : '待处理'}
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
    <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.02] overflow-hidden transition-all shadow-2xl">
      {/* Table Header / Toolbar */}
      <div className="px-8 py-8 border-b border-white/5 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black tracking-[0.2em] text-white uppercase flex items-center gap-2">
              <span className="h-1.5 w-4 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
              素材列表
            </h3>
            <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">上传素材与任务执行记录</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <input
                value={pathFilter}
                onChange={(e) => onPathFilterChange(e.target.value)}
                placeholder="搜索路径..."
                className="w-48 lg:w-64 rounded-xl border border-white/10 bg-black/40 pl-10 pr-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white placeholder-white/10 outline-none transition-all focus:border-cyan-500/40 focus:bg-black/60 shadow-inner"
              />
              <svg className="absolute left-3.5 top-3 h-3.5 w-3.5 text-white/20 group-focus-within:text-cyan-400 group-hover:text-white/40 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <button
              onClick={onShowFailedOnlyToggle}
              className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-[10px] font-black tracking-[0.2em] uppercase transition-all ${
                showFailedOnly
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : "border-white/5 bg-white/[0.03] text-white/20 hover:text-white/40 hover:bg-white/[0.06]"
              }`}
            >
              <div className={`h-1.5 w-1.5 rounded-full ${showFailedOnly ? 'bg-rose-400 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-white/10'}`} />
              仅看失败项
            </button>
          </div>
        </div>

        {/* Selection Actions - Conditional Visibility */}
        <AnimatePresence>
          {selectedItemIds.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/80">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onSelectVisibleItems}
                      className="px-4 py-2 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 transition-all font-black shadow-lg"
                    >
                      全选当前页
                    </button>
                    <button
                      onClick={onClearSelection}
                      className="px-4 py-2 rounded-xl border border-cyan-500/20 bg-white/5 text-cyan-200 hover:bg-white/10 transition-all"
                    >
                      取消选择
                    </button>
                  </div>
                  <span className="ml-2 py-1 px-4 border-l border-white/5 tabular-nums">
                    已选 <span className="text-white">{selectedItemIds.length}</span> 项
                    <span className="mx-3 opacity-20">/</span>
                    本页 <span className="text-white/60">{selectedVisibleCount}</span>
                  </span>
                </div>

                <button
                  onClick={onRetrySelectedFailed}
                  disabled={selectedItemIds.length === 0}
                  className="flex items-center gap-3 px-6 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-[10px] font-black uppercase tracking-[0.2em] text-rose-300 hover:bg-rose-500/20 disabled:opacity-20 transition-all group shadow-lg"
                >
                  <svg className="h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  批量重试
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-black/95 border-b border-white/5 shadow-2xl">
            <tr className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
              <th className="px-8 py-5 font-black">素材路径</th>
              <th className="px-8 py-5 text-center">状态</th>
              <th className="px-8 py-5">任务详情</th>
              <th className="px-8 py-5">识别结果</th>
              <th className="px-8 py-5 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {items.map((item) => {
              const isSelected = selectedItemIds.includes(item.id);
              const displayName = item.original_filename || item.source_relative_path?.split("/").pop() || `item-${item.sequence_no}`;
              
              return (
                <tr
                  key={item.id}
                  onClick={() => onToggleSelectItem(item.id)}
                  className={`group cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? "bg-cyan-500/[0.06] shadow-[inset_4px_0_0_rgba(6,182,212,0.8)]"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-white/70 group-hover:text-white transition-colors tracking-tight">{displayName}</span>
                        {isSelected ? (
                          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-[9px] text-white/10 font-bold uppercase tracking-widest">
                        <span className="tabular-nums">序号 {item.sequence_no}</span>
                        <span className="h-1 w-1 rounded-full bg-white/5" />
                        <span className="truncate max-w-[150px]">{item.source_relative_path ?? "根目录"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {renderStatusBadge(item.processing_status)}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1.5">
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">状态:</span>
                          <span className="text-[10px] font-black text-white/60">{item.latest_task_status ?? "未定义"}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">尝试:</span>
                          <span className="text-[10px] font-bold text-white/30 tabular-nums">{item.latest_task_attempt_no ?? "0"}</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex gap-4">
                       <div className="flex flex-col gap-1">
                         <span className="text-[15px] font-black text-white/80 tabular-nums tracking-tighter">{item.defect_count ?? 0}</span>
                         <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">病害项</span>
                       </div>
                       <div className="w-px h-8 bg-white/5 self-center" />
                       <div className="flex flex-col gap-1">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${item.review_status === 'reviewed' ? 'text-cyan-400' : 'text-white/20'}`}>
                           {item.review_status === "reviewed" ? "已复核" : "未复核"}
                         </span>
                         <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">审查态</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    {item.latest_task_id && item.processing_status === "failed" ? (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onRetryTask(item.latest_task_id!);
                        }}
                        disabled={retryingTaskId === item.latest_task_id}
                        className="group/btn relative px-5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-30 overflow-hidden shadow-lg"
                      >
                        <span className="relative z-10">{retryingTaskId === item.latest_task_id ? "重试中..." : "手动重试"}</span>
                        <div className="absolute inset-0 bg-rose-500/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                      </button>
                    ) : (
                      <div className="h-8 flex items-center justify-end px-4">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/5" />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-28 text-center">
                  <div className="flex flex-col items-center gap-4 animate-pulse">
                     <div className="h-10 w-10 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-white/10" />
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/10">无素材</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between border-t border-white/5 bg-white/[0.02] px-8 py-6">
        <div className="flex items-center gap-5 text-[10px] font-black uppercase tracking-[0.2em]">
           <span className="text-white/20">数据范围</span>
           <span className="text-white/60 tabular-nums">{batchItemOffset + 1} - {Math.min(batchItemOffset + batchItemLimit, batchItemTotal)}</span>
           <span className="text-white/10 opacity-50">/ TOTAL</span>
           <span className="text-cyan-400 tabular-nums">{batchItemTotal}</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <button
              disabled={!canPrev}
              onClick={() => onBatchItemPageChange(Math.max(0, batchItemOffset - batchItemLimit))}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/40 hover:text-white transition-all disabled:opacity-10 group shadow-lg"
            >
              <svg className="h-4 w-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-black/60 border border-white/10 ring-1 ring-white/5">
              <span className="text-[10px] font-black text-cyan-400 tabular-nums">{currentPage}</span>
              <span className="text-[10px] text-white/10">/</span>
              <span className="text-[10px] font-black text-white/40 tabular-nums">{totalPages}</span>
            </div>
            <button
              disabled={!canNext}
              onClick={() => onBatchItemPageChange(batchItemOffset + batchItemLimit)}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/40 hover:text-white transition-all disabled:opacity-10 group shadow-lg"
            >
              <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
