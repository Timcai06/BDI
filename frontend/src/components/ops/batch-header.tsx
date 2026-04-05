"use client";

import Link from "next/link";

import { OpsPageHeader } from "@/components/ops/ops-page-header";
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
  const statusColors: Record<string, string> = {
    completed: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    running: "bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]",
    failed: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]",
    partial_failed: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
  };

  const statusColor = statusColors[batch?.status ?? ""] ?? "bg-white/20";

  return (
    <div className="border-b border-white/5 bg-white/[0.01] px-6 py-6 lg:px-10">
      <OpsPageHeader
        eyebrow="WORKBENCH"
        title={batch ? batch.batch_code : "巡检批次中心"}
        subtitle={
          batch ? (
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">
                  {batch.status}
                </span>
              </span>
              <span className="opacity-50">CREATED {new Date(batch.created_at).toLocaleDateString()}</span>
              <span className="font-mono text-[10px] text-white/40">UUID {batch.id.slice(0, 8)}...</span>
              {lastRefreshedAt ? (
                <span className="text-cyan-400/60">SYNCED {new Date(lastRefreshedAt).toLocaleTimeString()}</span>
              ) : null}
            </span>
          ) : (
            "ENTERPRISE INFRASTRUCTURE SCAN WORKBENCH"
          )
        }
        actions={
          <>
            <Link
              href="/dashboard/history"
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-5 text-[10px] font-bold uppercase tracking-wider text-white/60 transition-all hover:bg-white/10 hover:text-white"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
              历史档案
            </Link>
            {batch ? (
              <button
                onClick={onDeleteBatch}
                disabled={deletingBatch}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-5 text-[10px] font-bold uppercase tracking-wider text-rose-300 transition-all hover:bg-rose-500/20 disabled:opacity-30 group"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${
                    deletingBatch ? "animate-spin" : "group-hover:scale-110"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {deletingBatch ? "Deleting..." : "删除批次"}
              </button>
            ) : null}
            <button
              onClick={onRefresh}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-white/30 transition-all hover:bg-white/10 hover:text-white active:scale-95 group"
              title="刷新数据"
            >
              <svg
                className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={onOpenWizard}
              className="flex h-10 items-center gap-2.5 rounded-xl bg-cyan-500 px-6 text-[10px] font-black uppercase tracking-[0.15em] text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] active:scale-95 group"
            >
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
              创建批次 / 导入图片
            </button>
          </>
        }
      />
    </div>
  );
}
