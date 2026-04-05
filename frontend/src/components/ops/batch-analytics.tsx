"use client";

import { motion } from "framer-motion";

import type { BatchStatsV1Response } from "@/lib/types";

interface BatchAnalyticsProps {
  stats: BatchStatsV1Response | null;
}

// --- UI Components ---

function ProgressRing({ percent, size = 42, strokeWidth = 3, color = "#22d3ee" }: { percent: number, size?: number, strokeWidth?: number, color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-[9px] font-bold text-white/70">{Math.round(percent)}%</span>
    </div>
  );
}

function MetricCard({ 
  label, 
  value, 
  hint, 
  percent,
  status = "neutral" 
}: { 
  label: string; 
  value: string; 
  hint: string; 
  percent?: number;
  status?: "healthy" | "risk" | "warning" | "neutral";
}) {
  const statusColors = {
    healthy: "text-cyan-400",
    risk: "text-rose-400",
    warning: "text-amber-400",
    neutral: "text-white/70"
  };

  const ringColors = {
    healthy: "#22d3ee",
    risk: "#fb7185",
    warning: "#fbbf24",
    neutral: "rgba(255,255,255,0.2)"
  };

  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/5 bg-black/40 p-5 backdrop-blur-3xl transition-all hover:bg-white/[0.04] group">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 group-hover:text-white/50 transition-colors">{label}</p>
          <p className={`text-2xl font-bold tracking-tight ${statusColors[status]}`}>{value}</p>
        </div>
        {percent !== undefined && (
          <ProgressRing percent={percent} color={ringColors[status]} />
        )}
      </div>
      <p className="mt-4 text-[10px] leading-relaxed text-white/20 group-hover:text-white/40 transition-colors uppercase tracking-wider font-medium">{hint}</p>
    </div>
  );
}

export function BatchAnalytics({ stats }: BatchAnalyticsProps) {
  if (!stats) return null;

  const queuedCount = stats.status_breakdown?.queued ?? 0;
  const runningCount = stats.status_breakdown?.running ?? 0;
  const succeededCount = stats.status_breakdown?.succeeded ?? 0;
  const failedCount = stats.status_breakdown?.failed ?? 0;
  const totalItems = queuedCount + runningCount + succeededCount + failedCount;
  
  const totalProcessed = succeededCount + failedCount;
  const successRate = totalProcessed > 0 ? (succeededCount / totalProcessed) * 100 : 0;
  
  const alertCount = Object.values(stats.alert_breakdown ?? {}).reduce((a, b) => a + b, 0);
  const defectCount = Object.values(stats.category_breakdown ?? {}).reduce((a, b) => a + b, 0);
  const reviewedCount = Object.values(stats.review_breakdown ?? {}).reduce((a, b) => a + b, 0);
  const reviewCoverage = defectCount > 0 ? (reviewedCount / defectCount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
    >
      <MetricCard 
        label="总体处理进度 / PROGRESS"
        value={`${succeededCount} / ${totalItems}`}
        hint={`已成功处理 ${succeededCount} 项，完成率 ${(totalItems > 0 ? (succeededCount / totalItems) * 100 : 0).toFixed(1)}%`}
        percent={totalItems > 0 ? (succeededCount / totalItems) * 100 : 0}
        status="healthy"
      />
      <MetricCard 
        label="端侧队列负载 / QUEUE"
        value={String(queuedCount + runningCount)}
        hint={`当前排队 ${queuedCount} | 正在分析 ${runningCount}`}
        percent={totalItems > 0 ? ((queuedCount + runningCount) / totalItems) * 100 : 0}
        status={queuedCount + runningCount > 50 ? "warning" : "neutral"}
      />
      <MetricCard 
        label="异常检测风险 / RISK"
        value={String(failedCount + alertCount)}
        hint={`任务异常 ${failedCount} | 待处理告警 ${alertCount}`}
        status={failedCount + alertCount > 0 ? "risk" : "healthy"}
      />
      <MetricCard 
        label="模型识别闭环 / COVERAGE" 
        value={String(defectCount)} 
        hint={`检出病害 ${defectCount} | 已复核 ${reviewedCount} | 总体召回率 ${successRate.toFixed(1)}%`}
        percent={reviewCoverage}
        status="warning"
      />
    </motion.div>
  );
}
