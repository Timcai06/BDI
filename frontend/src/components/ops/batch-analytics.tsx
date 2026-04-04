"use client";

import { motion } from "framer-motion";

import type { BatchStatsV1Response } from "@/lib/types";

interface BatchAnalyticsProps {
  stats: BatchStatsV1Response | null;
}

function MetricCard({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.05]">
      <div className={`absolute top-0 right-0 h-24 w-24 translate-x-12 -translate-y-12 rounded-full ${color} opacity-10 blur-3xl`} />
      
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{title}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <h4 className="text-2xl font-semibold text-white">{value}</h4>
        <span className="text-[10px] text-white/40">{sub}</span>
      </div>
    </div>
  );
}

export function BatchAnalytics({ stats }: BatchAnalyticsProps) {
  if (!stats) return null;

  const queuedCount = stats.status_breakdown?.queued ?? 0;
  const runningCount = stats.status_breakdown?.running ?? 0;
  const succeededCount = stats.status_breakdown?.succeeded ?? 0;
  const failedCount = stats.status_breakdown?.failed ?? 0;
  const totalProcessed = succeededCount + failedCount;
  const successRate = totalProcessed > 0 ? ((succeededCount / totalProcessed) * 100).toFixed(1) : "0";
  const alertCount = Object.values(stats.alert_breakdown ?? {}).reduce((a, b) => a + b, 0);
  const defectCount = Object.values(stats.category_breakdown ?? {}).reduce((a, b) => a + b, 0);
  const reviewedCount = Object.values(stats.review_breakdown ?? {}).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <MetricCard 
        title="处理进度"
        value={`${succeededCount}/${queuedCount + runningCount + succeededCount + failedCount}`}
        sub="Succeeded / Total"
        color="bg-cyan-500"
      />
      <MetricCard 
        title="队列与运行"
        value={`${queuedCount + runningCount}`}
        sub={`Queued ${queuedCount} | Running ${runningCount}`}
        color="bg-sky-500" 
      />
      <MetricCard 
        title="异常积压"
        value={`${failedCount + alertCount}`}
        sub={`Failed ${failedCount} | Alerts ${alertCount}`}
        color="bg-rose-500" 
      />
      <MetricCard 
        title="识别与复核" 
        value={`${defectCount}`} 
        sub={`Detections ${defectCount} | Reviews ${reviewedCount} | Success ${successRate}%`} 
        color="bg-amber-500" 
      />
    </motion.div>
  );
}
