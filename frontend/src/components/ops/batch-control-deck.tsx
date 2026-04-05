"use client";

import { useMemo, useState } from "react";

import type { BatchV1 } from "@/lib/types";

interface BatchControlDeckProps {
  batches: BatchV1[];
  selectedBatchId: string;
  onSelectBatch: (batchId: string) => void;
  onCreateBatch: () => void;
  batchTotal: number;
  currentBatchPage: number;
  totalBatchPages: number;
  canPrevBatchPage: boolean;
  canNextBatchPage: boolean;
  onPrevBatchPage: () => void;
  onNextBatchPage: () => void;
}

function formatBatchStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatBatchDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function renderStatusTone(status: string) {
  const tones: Record<string, string> = {
    completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    succeeded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    running: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    queued: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    failed: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    partial_failed: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200"
  };
  return tones[status] ?? "border-white/10 bg-white/[0.04] text-white/60";
}

export function BatchControlDeck({
  batches,
  selectedBatchId,
  onSelectBatch,
  onCreateBatch,
  batchTotal,
  currentBatchPage,
  totalBatchPages,
  canPrevBatchPage,
  canNextBatchPage,
  onPrevBatchPage,
  onNextBatchPage
}: BatchControlDeckProps) {
  const [query, setQuery] = useState("");

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );

  const filteredBatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return batches;
    return batches.filter((batch) =>
      batch.batch_code.toLowerCase().includes(normalized) ||
      batch.status.toLowerCase().includes(normalized) ||
      batch.source_type.toLowerCase().includes(normalized)
    );
  }, [batches, query]);

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/30">
              批次选择 / Batch Switchboard
            </p>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {selectedBatch ? selectedBatch.batch_code : "选择一个批次开始"}
            </h2>
            <p className="text-sm text-white/40">
              批次切换是本页主操作，当前列表共 {batchTotal} 个批次。
            </p>
          </div>

          {selectedBatch ? (
            <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${renderStatusTone(selectedBatch.status)}`}>
              {formatBatchStatus(selectedBatch.status)}
            </div>
          ) : null}
        </div>

        {selectedBatch ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/5 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">创建时间</p>
              <p className="mt-2 text-sm font-bold text-white/70">{formatBatchDate(selectedBatch.created_at)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">接收素材</p>
              <p className="mt-2 text-sm font-bold text-white/70">{selectedBatch.received_item_count}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">成功 / 失败</p>
              <p className="mt-2 text-sm font-bold text-white/70">
                {selectedBatch.succeeded_item_count} / {selectedBatch.failed_item_count}
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">排队 / 运行</p>
              <p className="mt-2 text-sm font-bold text-white/70">
                {selectedBatch.queued_item_count} / {selectedBatch.running_item_count}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-white/5 bg-black/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex-1 min-w-[220px]">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                快速检索批次
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入批次编号或状态"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-cyan-500/40"
              />
            </label>

            <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={onPrevBatchPage}
                disabled={!canPrevBatchPage}
                className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45 transition-all hover:bg-white/10 hover:text-white disabled:opacity-20"
              >
                Prev
              </button>
              <span className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/70">
                {currentBatchPage} / {totalBatchPages}
              </span>
              <button
                type="button"
                onClick={onNextBatchPage}
                disabled={!canNextBatchPage}
                className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45 transition-all hover:bg-white/10 hover:text-white disabled:opacity-20"
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {filteredBatches.map((batch) => {
              const isActive = batch.id === selectedBatchId;
              return (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => onSelectBatch(batch.id)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    isActive
                      ? "border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]"
                      : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold tracking-tight text-white">{batch.batch_code}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
                        {batch.source_type}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${renderStatusTone(batch.status)}`}>
                      {formatBatchStatus(batch.status)}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                    <span>Success {batch.succeeded_item_count}</span>
                    <span>Failed {batch.failed_item_count}</span>
                    <span>Queued {batch.queued_item_count}</span>
                    <span>Running {batch.running_item_count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/60">
          新建批次 / Create Batch
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
          启动新的批次采集
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/45">
          创建入口只承接新批次发起，不在这里展开表单。桥梁选择、批次定义和素材导入继续由现有向导处理。
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="grid gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
            <span>Step 01 选择桥梁对象</span>
            <span>Step 02 定义批次属性</span>
            <span>Step 03 导入巡检素材</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateBatch}
          className="mt-6 w-full rounded-2xl bg-cyan-500 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-cyan-400 active:scale-[0.99]"
        >
          新建批次
        </button>
      </div>
    </section>
  );
}
