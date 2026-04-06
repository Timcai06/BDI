"use client";

import Link from "next/link";

import type { BatchV1, BridgeV1 } from "@/lib/types";

interface OpsWorkbenchNavigationProps {
  batches: BatchV1[];
  bridges: BridgeV1[];
  deletingBatch: boolean;
  onDeleteCurrentBatch: () => void;
  onOpenWizard: () => void;
  onSelectBatch: (batchId: string) => void;
  onSelectBridge: (bridgeId: string) => void;
  selectedBatch: BatchV1 | null;
  selectedBatchId: string;
  selectedBridge: BridgeV1 | null;
  selectedBridgeId: string;
}

export function OpsWorkbenchNavigation({
  batches,
  bridges,
  deletingBatch,
  onDeleteCurrentBatch,
  onOpenWizard,
  onSelectBatch,
  onSelectBridge,
  selectedBatch,
  selectedBatchId,
  selectedBridge,
  selectedBridgeId,
}: OpsWorkbenchNavigationProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
      <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] transition-all duration-500 hover:border-white/20 hover:bg-white/[0.05]">
        <div className="absolute -left-12 -top-12 h-64 w-64 rounded-full bg-cyan-500/5 blur-[80px] transition-all group-hover:bg-cyan-500/10" />
        <div className="relative mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/80">桥梁</p>
            </div>
            <h3 className="text-lg font-black tracking-tight text-white uppercase">选择桥梁</h3>
            <p className="mt-1 text-xs font-medium text-white/40">选择本次巡检关联的桥梁对象</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/bridges"
              title="资产地图"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </Link>
            {selectedBridge ? (
              <Link
                href={`/dashboard/bridges/${encodeURIComponent(selectedBridge.id)}`}
                title="资产详情"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/5 bg-black/40 p-1.5 ring-1 ring-white/5 focus-within:ring-cyan-500/50 transition-all">
          <select
            value={selectedBridgeId}
            onChange={(e) => onSelectBridge(e.target.value)}
            className="h-12 w-full appearance-none bg-transparent px-4 text-sm font-bold text-white outline-none"
          >
            <option value="" className="bg-[#121212]">
              选择桥梁...
            </option>
            {bridges.map((bridge) => (
              <option key={bridge.id} value={bridge.id} className="bg-[#121212]">
                {bridge.bridge_code} | {bridge.bridge_name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 opacity-30">
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L6 6L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-500 shadow-lg ${
            selectedBridgeId
              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
              : "bg-white/5 border-white/10 text-white/20"
          }`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={selectedBridgeId ? "animate-pulse" : ""}
          >
            <path
              d="M5 12H19M19 12L13 6M19 12L13 18"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div
        className={`group relative overflow-hidden rounded-3xl border transition-all duration-500 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] ${
          selectedBridgeId
            ? "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
            : "border-white/5 bg-white/[0.01] opacity-60 grayscale"
        }`}
      >
        <div
          className={`absolute -right-12 -top-12 h-64 w-64 rounded-full blur-[80px] transition-all ${
            selectedBridgeId ? "bg-emerald-500/5 group-hover:bg-emerald-500/10" : "bg-white/0"
          }`}
        />

        <div className="relative mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  selectedBridgeId
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    : "bg-white/20"
                }`}
              />
              <p
                className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${
                  selectedBridgeId ? "text-emerald-400/80" : "text-white/20"
                }`}
              >
                批次
              </p>
            </div>
            <h3 className="text-lg font-black tracking-tight text-white uppercase">批次列表</h3>
            <p className="mt-1 text-xs font-medium text-white/40">基于所选桥梁的巡检批次管理</p>
          </div>
          <div className="flex gap-2">
            {selectedBatch ? (
              <button
                onClick={onDeleteCurrentBatch}
                disabled={deletingBatch}
                title="删除当前批次"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300/80 transition-all hover:bg-rose-500/20 disabled:opacity-40"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            ) : null}
            <button
              onClick={onOpenWizard}
              disabled={!selectedBridgeId}
              title="新建批次"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-black transition-all hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className={`relative rounded-2xl border border-white/5 bg-black/40 p-1.5 ring-1 ring-white/5 transition-all ${
            selectedBridgeId ? "focus-within:ring-emerald-500/50" : ""
          }`}
        >
          <select
            value={selectedBatchId}
            onChange={(e) => onSelectBatch(e.target.value)}
            disabled={!selectedBridgeId}
            className="h-12 w-full appearance-none bg-transparent px-4 text-sm font-bold text-white outline-none disabled:cursor-not-allowed"
          >
            <option value="" className="bg-[#121212]">
              {selectedBridgeId ? "选择执行批次..." : "等待锁定桥梁..."}
            </option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id} className="bg-[#121212]">
                {batch.batch_code} ({batch.status})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 opacity-30">
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L6 6L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
