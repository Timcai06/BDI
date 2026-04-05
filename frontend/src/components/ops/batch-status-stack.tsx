"use client";

import { useMemo, useState } from "react";

import type { BatchStatsV1Response, BatchV1 } from "@/lib/types";

interface BatchStatusStackProps {
  batch: BatchV1 | null;
  stats: BatchStatsV1Response | null;
}

interface StackCard {
  key: string;
  label: string;
  value: number;
  hint: string;
  color: string;
}

export function BatchStatusStack({ batch, stats }: BatchStatusStackProps) {
  const [lockedKey, setLockedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const cards = useMemo<StackCard[]>(() => {
    const received = batch?.received_item_count ?? 0;
    const queued = stats?.status_breakdown?.queued ?? batch?.queued_item_count ?? 0;
    const running = stats?.status_breakdown?.running ?? batch?.running_item_count ?? 0;
    const succeeded = stats?.status_breakdown?.succeeded ?? batch?.succeeded_item_count ?? 0;
    const failed = stats?.status_breakdown?.failed ?? batch?.failed_item_count ?? 0;
    const alerts = Object.values(stats?.alert_breakdown ?? {}).reduce((sum, value) => sum + value, 0);
    const reviewed = Object.values(stats?.review_breakdown ?? {}).reduce((sum, value) => sum + value, 0);

    return [
      {
        key: "received",
        label: "Received",
        value: received,
        hint: "本批次已接收的素材总数",
        color: "from-white/12 to-white/[0.04] border-white/12 text-white"
      },
      {
        key: "queued",
        label: "Queued",
        value: queued,
        hint: "已入队等待处理的素材",
        color: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-100"
      },
      {
        key: "running",
        label: "Running",
        value: running,
        hint: "当前正在执行推理的任务",
        color: "from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-100"
      },
      {
        key: "succeeded",
        label: "Succeeded",
        value: succeeded,
        hint: "已完成并成功写入结果的任务",
        color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-100"
      },
      {
        key: "failed",
        label: "Failed",
        value: failed,
        hint: "处理失败，需要排查或重试",
        color: "from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-100"
      },
      {
        key: "alerts",
        label: "Alerts",
        value: alerts,
        hint: "当前批次关联的未处理告警总数",
        color: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/20 text-fuchsia-100"
      },
      {
        key: "reviewed",
        label: "Reviewed",
        value: reviewed,
        hint: "已进入人工复核闭环的记录数",
        color: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-100"
      }
    ];
  }, [batch, stats]);

  const focusKey = hoveredKey ?? lockedKey ?? cards[0]?.key ?? null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/30">
            批次状态总览 / Status Stack
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
            7 张批次状态卡集中查看
          </h2>
        </div>
        <p className="text-xs text-white/35">
          桌面端可悬浮预览，点击锁定；移动端点击展开。
        </p>
      </div>

      <div className="relative min-h-[420px] rounded-[28px] border border-white/5 bg-black/30 p-4 sm:min-h-[440px]">
        {cards.map((card, index) => {
          const isFocused = card.key === focusKey;
          const topOffset = index * 38;
          const scale = isFocused ? 1 : 0.985 - index * 0.006;
          const translateX = isFocused ? 14 : 0;
          const translateY = isFocused ? topOffset - 8 : topOffset;
          const zIndex = isFocused ? 30 : 20 - index;

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setLockedKey((current) => (current === card.key ? null : card.key))}
              onMouseEnter={() => setHoveredKey(card.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`absolute left-4 right-4 overflow-hidden rounded-[24px] border bg-gradient-to-br px-5 py-5 text-left transition-all duration-300 ease-out ${card.color} ${
                isFocused ? "shadow-[0_20px_50px_rgba(0,0,0,0.32)]" : "shadow-[0_10px_24px_rgba(0,0,0,0.2)]"
              }`}
              style={{
                top: translateY,
                zIndex,
                transform: `translateX(${translateX}px) scale(${scale})`
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">
                    {card.label}
                  </p>
                  <p className="mt-3 text-3xl font-black tracking-tight">
                    {card.value}
                  </p>
                </div>
                <div className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${isFocused ? "border-white/15 bg-white/10" : "border-transparent bg-black/20"}`}>
                  {isFocused ? "expanded" : "stacked"}
                </div>
              </div>

              <div className={`grid transition-all duration-300 ${isFocused ? "mt-6 grid-rows-[1fr] opacity-100" : "mt-2 grid-rows-[0fr] opacity-70"}`}>
                <div className="overflow-hidden">
                  <p className="text-sm leading-relaxed text-current/75">
                    {card.hint}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
