"use client";

import Link from "next/link";

import type { BatchV1 } from "@/lib/types";

interface BatchHeaderProps {
  batch: BatchV1 | null;
  onOpenWizard: () => void;
  onRefresh: () => void;
  onDeleteBatch?: () => void;
  deletingBatch?: boolean;
  lastRefreshedAt?: string | null;
}

export function BatchHeader({
  batch,
  onOpenWizard,
  onRefresh,
  onDeleteBatch,
  deletingBatch,
  lastRefreshedAt
}: BatchHeaderProps) {
  const statusTone =
    batch?.status === "completed"
      ? "bg-emerald-500"
      : batch?.status === "running"
        ? "bg-cyan-500 animate-pulse"
        : batch?.status === "partial_failed" || batch?.status === "failed"
          ? "bg-rose-500"
          : "bg-amber-500";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-white/[0.02] px-6 py-4 lg:px-8">
      <div className="flex items-center gap-4">
        <div className={`h-2 w-2 rounded-full ${statusTone}`} />
        
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            {batch ? `批次: ${batch.batch_code}` : "未选择巡检批次"}
            {batch && (
              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-white/40 tracking-widest">
                {batch.source_type}
              </span>
            )}
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.18em] mt-0.5">
            {batch
              ? `状态: ${batch.status} | 创建时间: ${new Date(batch.created_at).toLocaleString()} | ID: ${batch.id}`
              : "BDI INFRASTRUCTURE SCAN SYSTEM"}
          </p>
          {lastRefreshedAt ? (
            <p className="text-[10px] text-white/25 mt-1">最后刷新：{new Date(lastRefreshedAt).toLocaleTimeString()}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/history"
          className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-xs font-bold uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-white"
        >
          历史档案
        </Link>
        {batch ? (
          <button
            onClick={onDeleteBatch}
            disabled={deletingBatch}
            className="flex h-9 items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 text-xs font-bold uppercase tracking-widest text-rose-300 transition-all hover:bg-rose-500/20 disabled:opacity-50"
          >
            {deletingBatch ? "删除中..." : "删除当前批次"}
          </button>
        ) : null}
        <button
          onClick={onRefresh}
          className="group flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
          title="刷新数据"
        >
          <svg className="h-4 w-4 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={onOpenWizard}
          className="flex h-9 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] shadow-lg"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          创建批次 / 导入图片
        </button>
      </div>
    </header>
  );
}
