"use client";

import type { BatchV1, BridgeV1 } from "@/lib/types";
import { toBatchStatusLabel } from "@/components/history/history-route-utils";

interface HistoryBatchPanelProps {
  batchLoading: boolean;
  batches: BatchV1[];
  bridges: BridgeV1[];
  hasMoreBatches: boolean;
  selectedBatchId: string;
  selectedBridgeId: string;
  onBridgeChange: (bridgeId: string) => void;
  onBatchChange: (batchId: string) => void;
  onLoadMore: () => void;
}

export function HistoryBatchPanel({
  batchLoading,
  batches,
  bridges,
  hasMoreBatches,
  selectedBatchId,
  selectedBridgeId,
  onBridgeChange,
  onBatchChange,
  onLoadMore,
}: HistoryBatchPanelProps) {
  return (
    <div className="group relative flex min-h-[720px] flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-2xl transition-all hover:border-white/20">
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-amber-500/5 blur-[120px]" />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2 opacity-30">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12M16 2v4M8 2v4M3 10h18"/></svg>
          <p className="text-[10px] font-black uppercase tracking-[0.3em]">批次</p>
        </div>
        <h3 className="text-2xl font-black tracking-tight text-white uppercase">批次列表</h3>

        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
          <div className="relative rounded-2xl border border-white/5 bg-black/40 p-1.5 ring-1 ring-white/5 focus-within:ring-amber-500/50 transition-all">
            <select
              value={selectedBridgeId}
              onChange={(e) => onBridgeChange(e.target.value)}
              className="h-11 w-full bg-transparent px-4 text-sm font-bold text-white outline-none"
            >
              <option value="" className="bg-slate-900">按桥梁筛选...</option>
              {bridges.map((bridge) => (
                <option key={bridge.id} value={bridge.id} className="bg-slate-900">
                  {bridge.bridge_code} | {bridge.bridge_name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1 overflow-auto space-y-3 pr-2 custom-scrollbar">
            {batches.map((batch) => (
              <button
                key={batch.id}
                type="button"
                onClick={() => onBatchChange(batch.id)}
                className={`group/item w-full rounded-2xl border p-4 text-left transition-all ${
                  selectedBatchId === batch.id
                    ? "border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-500/30"
                    : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className={`max-w-[68%] truncate text-[13px] font-black tracking-[0.02em] transition-colors ${selectedBatchId === batch.id ? "text-amber-300" : "text-white/85"}`}>
                    {batch.batch_code}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/35 tabular-nums">
                    {new Date(batch.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div
                  className="mt-3 flex items-center gap-2 text-[10px] font-bold text-white/40"
                  title={`批次状态：${toBatchStatusLabel(batch.status)}`}
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-300 normal-case">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {batch.succeeded_item_count} 成功
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-rose-300 normal-case">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    {batch.failed_item_count} 失败
                  </span>
                </div>
              </button>
            ))}
            {batches.length === 0 && <div className="py-20 text-center text-xs text-white/20">暂无符合条件的批次</div>}
            {hasMoreBatches && (
              <button onClick={onLoadMore} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors">
                加载更多批次记录
              </button>
            )}
            {!hasMoreBatches && batchLoading && (
              <div className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-white/20">数据同步中...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
