"use client";

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

function renderProcessingTone(status: string): string {
  if (status === "succeeded") return "bg-emerald-500/10 text-emerald-400";
  if (status === "failed") return "bg-rose-500/10 text-rose-400";
  if (status === "running") return "bg-sky-500/10 text-sky-400";
  return "bg-amber-500/10 text-amber-300";
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
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl transition-all">
      <div className="flex flex-col gap-4 border-b border-white/5 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold tracking-wide text-white/90 underline decoration-cyan-500/30 underline-offset-8">
            批次扫描清单
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <input
                value={pathFilter}
                onChange={(e) => onPathFilterChange(e.target.value)}
                placeholder="按路径检索 (e.g. girder-01)"
                className="w-48 lg:w-64 rounded-lg border border-white/10 bg-black/20 pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/20 outline-none transition-all focus:border-cyan-500/50"
              />
              <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <button
              onClick={onShowFailedOnlyToggle}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase transition-all ${
                showFailedOnly
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-400"
                  : "border-white/10 bg-white/5 text-white/50 hover:text-white"
              }`}
            >
              只看异常项
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-xs text-white/60">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onSelectVisibleItems}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:bg-white/10"
            >
              选择当前页
            </button>
            <button
              onClick={onClearSelection}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:bg-white/10 hover:text-white"
            >
              清空选择
            </button>
            <span>已选择 {selectedItemIds.length} 项，本页命中 {selectedVisibleCount} 项</span>
          </div>
          <button
            onClick={onRetrySelectedFailed}
            disabled={selectedItemIds.length === 0}
            className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-300 disabled:opacity-40"
          >
            批量重试失败项
          </button>
        </div>
      </div>

      <div className="max-h-[560px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-[#0B1120]/95 backdrop-blur-md">
            <tr className="border-b border-white/5 text-[9px] font-bold uppercase tracking-widest text-white/30">
              <th className="px-4 py-3">选择</th>
              <th className="px-4 py-3">素材</th>
              <th className="px-4 py-3 text-center">处理状态</th>
              <th className="px-4 py-3">任务与模型</th>
              <th className="px-4 py-3">复核 / 告警</th>
              <th className="px-4 py-3">失败原因</th>
              <th className="px-4 py-3 text-right">动作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item) => {
              const isSelected = selectedItemIds.includes(item.id);
              const displayName =
                item.original_filename || item.source_relative_path?.split("/").pop() || `item-${item.sequence_no}`;
              return (
                <tr
                  key={item.id}
                  className="group hover:bg-white/[0.01] transition-all"
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectItem(item.id)}
                      className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-500 focus:ring-cyan-500/30"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-white/80">{displayName}</span>
                      <span className="text-[10px] text-white/25">
                        #{item.sequence_no} | {item.source_relative_path ?? "Root"} | device {item.source_device ?? "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] items-center gap-1.5 ${renderProcessingTone(item.processing_status)}`}>
                      {item.processing_status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1 text-[10px] text-white/55">
                      <span>task {item.latest_task_status ?? "-"}</span>
                      <span>attempt {item.latest_task_attempt_no ?? "-"}</span>
                      <span>policy {item.model_policy ?? "-"}</span>
                      <span>model {item.resolved_model_version ?? item.requested_model_version ?? "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1 text-[10px] text-white/55">
                      <span>review {item.review_status}</span>
                      <span>alert {item.alert_status}</span>
                      <span>detections {item.defect_count ?? 0}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-[220px] truncate text-[10px] text-rose-300/80">
                      {item.latest_failure_message ?? item.latest_failure_code ?? "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {item.latest_task_id && item.processing_status === "failed" ? (
                      <button
                        onClick={() => onRetryTask(item.latest_task_id!)}
                        disabled={retryingTaskId === item.latest_task_id}
                        className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {retryingTaskId === item.latest_task_id ? "重试中..." : "重新入队"}
                      </button>
                    ) : (
                      <span className="text-[10px] text-white/20">-</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-xs text-white/20 font-mono italic">
                  [ NO ITEMS MATCH THE CURRENT FILTER ]
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/40">
        <span>Items {batchItemOffset + 1}-{Math.min(batchItemOffset + batchItemLimit, batchItemTotal)} / {batchItemTotal}</span>
        <div className="flex items-center gap-3">
          <button
            disabled={!canPrev}
            onClick={() => onBatchItemPageChange(Math.max(0, batchItemOffset - batchItemLimit))}
            className="disabled:opacity-20"
          >
            Prev
          </button>
          <span className="text-cyan-500/60">Page {currentPage} / {totalPages}</span>
          <button
            disabled={!canNext}
            onClick={() => onBatchItemPageChange(batchItemOffset + batchItemLimit)}
            className="disabled:opacity-20"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
