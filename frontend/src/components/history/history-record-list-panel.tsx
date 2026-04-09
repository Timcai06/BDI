"use client";

import Link from "next/link";

import { toProcessingStatusLabel } from "@/components/history/history-route-utils";
import type { BatchItemV1, BridgeV1 } from "@/lib/types";

interface HistoryRecordListPanelProps {
  batchLoading: boolean;
  currentHistoryHref: string;
  selectedBatchId: string;
  selectedBatchItems: BatchItemV1[];
  selectedBridge: BridgeV1 | null;
}

export function HistoryRecordListPanel({
  batchLoading,
  currentHistoryHref,
  selectedBatchId,
  selectedBatchItems,
  selectedBridge,
}: HistoryRecordListPanelProps) {
  return (
    <div className="group relative flex min-h-[720px] flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-2xl transition-all hover:border-white/20">
      <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px]" />

      <div className="relative mb-8 flex items-center justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 opacity-30">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">记录清单</p>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-white uppercase">
            {selectedBridge?.bridge_name ?? "记录"}
          </h3>
          <p className="mt-1 text-xs font-medium text-white/40">
            {selectedBatchId ? `批次: ${selectedBatchId.slice(-8)}` : "选择批次查看记录"}
          </p>
        </div>
        {selectedBridge && (
          <Link
            href={`/dashboard/bridges/${encodeURIComponent(selectedBridge.id)}`}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 hover:text-white transition-all underline decoration-amber-500/30 underline-offset-4"
          >
            桥梁详情
          </Link>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-inner">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-white/5 bg-[#0A0F1A]/95 backdrop-blur">
              <tr>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/25">NO.</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/25">识别图片</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/25 text-center">状态</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/25 text-right">操作</th>
              </tr>
            </thead>
          </table>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full border-collapse text-left">
              <tbody className="divide-y divide-white/5">
                {selectedBatchItems.map((item) => (
                  <tr key={item.id} className="group/row h-[72px] transition-colors hover:bg-white/[0.03]">
                    <td className="px-5 py-3 text-[12px] font-mono text-white/35 tabular-nums">#{item.sequence_no}</td>
                    <td className="px-5 py-3">
                      <p className="max-w-[260px] truncate text-[12px] font-semibold text-white/75">{item.original_filename ?? item.id}</p>
                      <p className="mt-1 text-[10px] font-medium text-white/25 uppercase tracking-[0.12em]">{item.id.slice(0, 12)}</p>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        item.processing_status === "succeeded"
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                          : item.processing_status === "failed"
                            ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
                            : "border-white/10 bg-white/5 text-white/45"
                      }`} title={item.processing_status}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          item.processing_status === "succeeded"
                            ? "bg-emerald-400"
                            : item.processing_status === "failed"
                              ? "bg-rose-400"
                              : "bg-white/20"
                        }`} />
                        {toProcessingStatusLabel(item.processing_status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {item.latest_result_id ? (
                        <Link
                          href={`/dashboard/history/${encodeURIComponent(item.latest_result_id)}?returnTo=${encodeURIComponent(currentHistoryHref)}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-all hover:border-amber-500/35 hover:bg-amber-500/10 hover:text-amber-300"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </Link>
                      ) : (
                        <span className="text-[10px] font-semibold text-white/20 uppercase tracking-wider">无结果</span>
                      )}
                    </td>
                  </tr>
                ))}
                {selectedBatchItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-24 text-center text-xs font-black uppercase tracking-[0.3em] text-white/10">
                      {batchLoading ? "数据同步中..." : "未选定有效批次"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
