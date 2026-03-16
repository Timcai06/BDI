"use client";

import { useMemo } from "react";
import type { PredictionHistoryItem } from "@/lib/types";

interface DashboardStatsProps {
  historyItems: PredictionHistoryItem[];
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon: React.ReactNode;
  accentColor: string;
}

function StatCard({ label, value, subtext, trend, trendValue, icon, accentColor }: StatCardProps) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-rose-400",
    neutral: "text-slate-400"
  };

  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→"
  };

  return (
    <div className="rounded-[20px] border border-white/[0.04] bg-[#030303] p-5 shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all duration-300 hover:border-white/[0.08] hover:shadow-[0_0_60px_rgba(0,0,0,0.4)] group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">
            {label}
          </p>
          <p className="text-2xl font-light text-white tracking-tight">
            {value}
          </p>
          {(subtext || trend) && (
            <div className="mt-2 flex items-center gap-2">
              {trend && trendValue && (
                <span className={`text-xs font-medium ${trendColors[trend]}`}>
                  {trendIcons[trend]} {trendValue}
                </span>
              )}
              {subtext && (
                <span className="text-xs text-white/30">{subtext}</span>
              )}
            </div>
          )}
        </div>
        <div 
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ 
            backgroundColor: `${accentColor}15`,
            boxShadow: `0 0 20px ${accentColor}10`
          }}
        >
          <div style={{ color: accentColor }}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardStats({ historyItems }: DashboardStatsProps) {
  const stats = useMemo(() => {
    const totalScans = historyItems.length;
    
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
  }, [historyItems]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="今日检测"
        value={stats.todayScans}
        trend={stats.trend}
        trendValue={stats.trendValue}
        subtext="较昨日"
        accentColor="#38bdf8"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
      />
      
      <StatCard
        label="总检测数"
        value={stats.totalScans}
        subtext="累计分析"
        accentColor="#a78bfa"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      />
      
      <StatCard
        label="检出病害"
        value={stats.totalDetections}
        subtext="总数"
        accentColor="#f472b6"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />
      
      <StatCard
        label="平均耗时"
        value={`${stats.avgInferenceTime}ms`}
        subtext="单次推理"
        accentColor="#34d399"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}
