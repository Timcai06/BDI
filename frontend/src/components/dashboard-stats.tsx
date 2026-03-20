"use client";

import { useMemo } from "react";
import type { PredictionHistoryItem } from "@/lib/types";

interface DashboardStatsProps {
  historyItems: PredictionHistoryItem[];
  totalHistoryCount?: number;
}

export function DashboardStats({ historyItems, totalHistoryCount }: DashboardStatsProps) {
  const stats = useMemo(() => {
    const totalScans = totalHistoryCount ?? historyItems.length;
    
    // Calculate today's scans
    const today = new Date().toISOString().split("T")[0];
    const todayScans = historyItems.filter(item => 
      item.created_at.startsWith(today)
    ).length;
    
    // Calculate total detections
    const totalDetections = historyItems.reduce(
      (sum, item) => sum + item.detection_count, 
      0
    );
    
    // Calculate average inference time
    const avgInferenceTime = totalScans > 0 
      ? Math.round(historyItems.reduce((sum, item) => sum + item.inference_ms, 0) / totalScans)
      : 0;
    
    // Calculate trend (compare today with yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const yesterdayScans = historyItems.filter(item => 
      item.created_at.startsWith(yesterdayStr)
    ).length;
    
    let trend: "up" | "down" | "neutral" = "neutral";
    let trendValue = "";
    
    if (yesterdayScans === 0) {
      if (todayScans > 0) {
        trend = "up";
        trendValue = "今日新增";
      }
    } else if (todayScans > yesterdayScans) {
      trend = "up";
      trendValue = `+${Math.round(((todayScans - yesterdayScans) / yesterdayScans) * 100)}%`;
    } else if (todayScans < yesterdayScans) {
      trend = "down";
      trendValue = `${Math.round(((todayScans - yesterdayScans) / yesterdayScans) * 100)}%`;
    }
    
    return {
      todayScans,
      totalScans,
      totalDetections,
      avgInferenceTime,
      trend,
      trendValue
    };
  }, [historyItems, totalHistoryCount]);

  const trendTone =
    stats.trend === "up" ? "text-emerald-300 bg-emerald-500/15 border-emerald-400/30"
      : stats.trend === "down" ? "text-rose-300 bg-rose-500/15 border-rose-400/30"
        : "text-slate-300 bg-white/5 border-white/10";

  const trendSymbol = stats.trend === "up" ? "↑" : stats.trend === "down" ? "↓" : "→";

  return (
    <section className="rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(3,8,20,0.96),rgba(3,3,3,0.95))] p-5 shadow-[0_0_60px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Dashboard Metrics</p>
          <p className="mt-1 text-sm text-white/65">反映当前系统的检测规模、效率与输出强度</p>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-medium ${trendTone}`}>
          今日趋势 {trendSymbol} {stats.trendValue || "稳定"}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.08] p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-sky-100/70">今日检测</p>
          <p className="mt-2 text-3xl font-light text-white">{stats.todayScans}</p>
          <p className="mt-2 text-xs text-sky-100/70">24h 内新增任务</p>
        </article>

        <article className="rounded-2xl border border-indigo-300/20 bg-indigo-300/[0.08] p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-100/70">累计检测</p>
          <p className="mt-2 text-3xl font-light text-white">{stats.totalScans}</p>
          <p className="mt-2 text-xs text-indigo-100/70">历史总任务数</p>
        </article>

        <article className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/70">检出病害</p>
          <p className="mt-2 text-3xl font-light text-white">{stats.totalDetections}</p>
          <p className="mt-2 text-xs text-amber-100/70">累计识别病害总数</p>
        </article>

        <article className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-100/70">平均耗时</p>
          <p className="mt-2 text-3xl font-light text-white">{stats.avgInferenceTime}<span className="ml-1 text-xl text-white/70">ms</span></p>
          <p className="mt-2 text-xs text-emerald-100/70">单次推理平均时延</p>
        </article>
      </div>
    </section>
  );
}
