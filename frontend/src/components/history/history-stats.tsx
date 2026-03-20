"use client";

import { useMemo } from "react";
import type { PredictionHistoryItem } from "@/lib/types";

interface HistoryStatsProps {
  items: PredictionHistoryItem[];
  totalCount: number;
  filteredCount: number;
}

interface StatItemProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  accentColor: string;
}

function StatItem({ label, value, subtext, icon, accentColor }: StatItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ 
          backgroundColor: `${accentColor}15`,
          color: accentColor
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-light text-white">{value}</p>
          {subtext && (
            <p className="text-[10px] text-white/30">{subtext}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function HistoryStats({ items, totalCount, filteredCount }: HistoryStatsProps) {
  const stats = useMemo(() => {
    // 今日新增
    const today = new Date().toISOString().split("T")[0];
    const todayCount = items.filter(item => 
      item.created_at.startsWith(today)
    ).length;
    
    // 总病害数
    const totalDetections = items.reduce(
      (sum, item) => sum + item.detection_count, 
      0
    );
    
    // 平均推理时间
    const loadedCount = items.length;
    const avgInferenceTime = loadedCount > 0 
      ? Math.round(items.reduce((sum, item) => sum + item.inference_ms, 0) / loadedCount)
      : 0;
    
    return { totalCount, todayCount, totalDetections, avgInferenceTime };
  }, [items, totalCount]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatItem
        label="总记录"
        value={stats.totalCount}
        subtext={`当前筛选 ${filteredCount} 项`}
        accentColor="#38bdf8"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
      />
      
      <StatItem
        label="今日新增"
        value={stats.todayCount}
        accentColor="#34d399"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        }
      />
      
      <StatItem
        label="检出病害"
        value={stats.totalDetections}
        accentColor="#f472b6"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />
      
      <StatItem
        label="平均耗时"
        value={`${stats.avgInferenceTime}ms`}
        accentColor="#a78bfa"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}
