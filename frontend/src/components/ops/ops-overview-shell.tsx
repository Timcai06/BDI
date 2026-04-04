"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getV1OpsMetrics,
  listV1Alerts,
  listV1Batches,
  listV1Bridges,
  listV1Detections,
  listV1Reviews
} from "@/lib/predict-client";
import type {
  AlertV1,
  BatchV1,
  BridgeV1,
  DetectionRecordV1,
  OpsMetricsV1Response,
  ReviewRecordV1
} from "@/lib/types";

// --- UI Components & Helpers ---

function Sparkline({ data, color = "currentColor" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height
  }));

  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(" L ")}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
      />
    </svg>
  );
}

function ProgressRing({ percent, size = 48, strokeWidth = 4, color = "#22d3ee" }: { percent: number, size?: number, strokeWidth?: number, color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
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
      <span className="absolute text-[10px] font-medium text-white/90">{Math.round(percent)}%</span>
    </div>
  );
}

function MetricCard({ 
  label, 
  value, 
  hint, 
  trend, 
  status = "neutral",
  icon: Icon
}: { 
  label: string; 
  value: string; 
  hint: string; 
  trend?: number[];
  status?: "healthy" | "risk" | "warning" | "neutral";
  icon?: React.ElementType;
}) {
  const statusColors = {
    healthy: "text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]",
    risk: "text-rose-400 shadow-[0_0_15px_rgba(251,113,133,0.15)]",
    warning: "text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.15)]",
    neutral: "text-white/70"
  };

  const statusBorder = {
    healthy: "border-cyan-400/20 bg-cyan-400/[0.02]",
    risk: "border-rose-400/20 bg-rose-400/[0.02]",
    warning: "border-amber-400/20 bg-amber-400/[0.02]",
    neutral: "border-white/5 bg-white/[0.02]"
  };

  return (
    <article className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-all hover:scale-[1.02] hover:border-white/20 ${statusBorder[status]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/40">{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${statusColors[status] || "text-white"}`}>{value}</p>
        </div>
        {Icon && <Icon className="h-5 w-5 text-white/20" />}
      </div>
      
      {trend && (
        <div className="mt-4 h-8 opacity-50 transition-opacity hover:opacity-100">
          <Sparkline data={trend} color={status === "risk" ? "#fb7185" : status === "warning" ? "#fbbf24" : "#22d3ee"} />
        </div>
      )}
      
      <p className="mt-3 text-[10px] leading-relaxed text-white/30">{hint}</p>
      
      {/* Decorative pulse for RISK */}
      {status === "risk" && (
        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
      )}
    </article>
  );
}

function countBy<T>(items: T[], keyGetter: (item: T) => string): Record<string, number> {
  const output: Record<string, number> = {};
  for (const item of items) {
    const key = keyGetter(item);
    output[key] = (output[key] ?? 0) + 1;
  }
  return output;
}

function breakdownText(map: Record<string, number>): string {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "暂无数据";
  return entries.map(([k, v]) => `${k}: ${v}`).join(" | ");
}

function toPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function ageHours(isoTime: string): number {
  const ts = Date.parse(isoTime);
  if (Number.isNaN(ts)) return 0;
  return (Date.now() - ts) / 3_600_000;
}

const ALERT_WEIGHT: Record<string, number> = {
  critical: 8,
  high: 5,
  medium: 3,
  low: 1
};

// --- Main Shell Component ---

export function OpsOverviewShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [bridges, setBridges] = useState<BridgeV1[]>([]);
  const [alerts, setAlerts] = useState<AlertV1[]>([]);
  const [reviews, setReviews] = useState<ReviewRecordV1[]>([]);
  const [detections, setDetections] = useState<DetectionRecordV1[]>([]);
  const [opsMetrics, setOpsMetrics] = useState<OpsMetricsV1Response | null>(null);
  const [windowHours, setWindowHours] = useState(24);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [batchResp, bridgeResp, alertResp, reviewResp, detectionResp, metricsResp] = await Promise.all([
          listV1Batches(500, 0),
          listV1Bridges(500, 0),
          listV1Alerts({ limit: 500, offset: 0, sortBy: "triggered_at", sortOrder: "desc" }),
          listV1Reviews({ limit: 500, offset: 0, sortBy: "reviewed_at", sortOrder: "desc" }),
          listV1Detections({ limit: 800, offset: 0, sortBy: "created_at", sortOrder: "desc" }),
          getV1OpsMetrics(windowHours)
        ]);
        if (cancelled) return;
        setBatches(batchResp.items);
        setBridges(bridgeResp.items);
        setAlerts(alertResp.items);
        setReviews(reviewResp.items);
        setDetections(detectionResp.items);
        setOpsMetrics(metricsResp);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "数据加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [windowHours, refreshTick]);

  const bridgeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const bridge of bridges) map.set(bridge.id, `${bridge.bridge_code} | ${bridge.bridge_name}`);
    return map;
  }, [bridges]);

  const openAlerts = useMemo(() => alerts.filter(i => i.status === "open"), [alerts]);
  const highPriorityOpenAlertsCount = useMemo(() => openAlerts.filter(i => i.alert_level === "critical" || i.alert_level === "high").length, [openAlerts]);
  const overdueOpenAlertsCount = useMemo(() => openAlerts.filter(i => ageHours(i.triggered_at) > 24).length, [openAlerts]);

  const totalReceived = useMemo(() => batches.reduce((sum, b) => sum + b.received_item_count, 0), [batches]);
  const totalSucceeded = useMemo(() => batches.reduce((sum, b) => sum + b.succeeded_item_count, 0), [batches]);
  
  const reviewedDetectionIds = useMemo(() => new Set(reviews.map(r => r.detection_id)), [reviews]);
  const reviewCoveragePercent = useMemo(() => detections.length > 0 ? (reviewedDetectionIds.size / detections.length) * 100 : 0, [reviewedDetectionIds, detections]);
  const autoPassPercent = useMemo(() => totalReceived > 0 ? (totalSucceeded / totalReceived) * 100 : 0, [totalSucceeded, totalReceived]);
  
  const topRiskBatches = useMemo(() => {
    const weightsByBatch = new Map<string, number>();
    for (const a of openAlerts) {
      const cur = weightsByBatch.get(a.batch_id) ?? 0;
      weightsByBatch.set(a.batch_id, cur + (ALERT_WEIGHT[a.alert_level] ?? 1));
    }
    return batches
      .map(b => {
        const w = weightsByBatch.get(b.id) ?? 0;
        const score = w + b.failed_item_count * 2 + b.running_item_count + b.queued_item_count;
        return { 
          id: b.id, 
          code: b.batch_code, 
          bridge: bridgeNameMap.get(b.bridge_id) ?? b.bridge_id, 
          score,
          failed: b.failed_item_count,
          pending: b.queued_item_count + b.running_item_count,
          alerts: w
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [batches, bridgeNameMap, openAlerts]);

  // Derived metrics for UI
  const successRate = (opsMetrics?.success_rate ?? 0) * 100;
  const statusDist = opsMetrics?.status_breakdown ?? {};
  const failureDist = opsMetrics?.failure_code_breakdown ?? {};

  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 bg-black/40">
      {/* --- HEADER --- */}
      <header className="flex flex-wrap items-end justify-between gap-6 overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">运营总览</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
              <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">Live System</span>
            </div>
          </div>
          <p className="text-sm text-white/40 max-w-xl font-light">
            通过资产、检测、复核与告警的闭环数据，掌控大规模巡检的风险优先级与处置效率。
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-center lg:self-end">
          <div className="flex p-1 rounded-xl bg-white/[0.03] border border-white/5">
            {[24, 72, 168].map(h => (
              <button 
                key={h}
                onClick={() => setWindowHours(h)}
                className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${windowHours === h ? 'bg-white/10 text-white shadow-xl' : 'text-white/30 hover:text-white/60'}`}
              >
                {h === 168 ? '7d' : `${h}h`}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRefreshTick(v => v + 1)}
            className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            title="刷新数据"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 auto-rows-auto">
          
          {/* --- TOP ROW: CORE KPIS --- */}
          <div className="lg:col-span-3">
            <MetricCard 
              label="任务处理成功率" 
              value={`${successRate.toFixed(1)}%`} 
              hint="由 InferenceTask 统计的端到端执行成功情况。"
              status={successRate > 95 ? "healthy" : successRate > 85 ? "warning" : "risk"}
              trend={[70, 85, 80, 92, 95, 94, successRate]} // Mock trend for visualization
            />
          </div>
          <div className="lg:col-span-3">
            <MetricCard 
              label="AI 数据通过率" 
              value={`${autoPassPercent.toFixed(1)}%`} 
              hint="succeeded_items / received_items，体现模型过滤效能。"
              status="healthy"
              trend={[40, 45, 42, 50, 48, 55, autoPassPercent]}
            />
          </div>
          <div className="lg:col-span-3">
            <MetricCard 
              label="人机复核覆盖率" 
              value={`${reviewCoveragePercent.toFixed(1)}%`} 
              hint="已复核检测记录占总检测结果的比例。"
              status={reviewCoveragePercent > 50 ? "healthy" : "warning"}
            />
          </div>
          <div className="lg:col-span-3">
            <MetricCard 
              label="活跃 Open 告警" 
              value={String(openAlerts.length)} 
              hint="系统中尚未解决的各级别告警总数。"
              status={openAlerts.length > 50 ? "risk" : openAlerts.length > 20 ? "warning" : "healthy"}
            />
          </div>

          {/* --- SECOND ROW: DETAILS & RISKS (Bento) --- */}
          
          {/* Priority Queue / Action items */}
          <div className="lg:col-span-4 rounded-3xl border border-white/5 bg-white/[0.02] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white tracking-widest uppercase opacity-70">处置优先队列</h2>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-[10px] font-bold text-rose-400">High Actionable</span>
              </div>
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-4">
                  <ProgressRing percent={(highPriorityOpenAlertsCount / (openAlerts.length || 1)) * 100} color="#fb7185" />
                  <div>
                    <p className="text-xl font-bold text-white">{highPriorityOpenAlertsCount}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">高危未入账告警 (High/Critical)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <ProgressRing percent={(overdueOpenAlertsCount / (openAlerts.length || 1)) * 100} color="#fbbf24" />
                  <div>
                    <p className="text-xl font-bold text-white">{overdueOpenAlertsCount}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">超 24h 待处理告警</p>
                  </div>
                </div>
              </div>
            </div>
            <Link 
              href="/dashboard/ops/alerts"
              className="mt-8 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white transition-all group"
            >
              进入告警中心
              <svg className="h-3 w-3 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Infrastructure Health */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 overflow-hidden relative">
              <h2 className="text-sm font-bold text-white tracking-widest uppercase opacity-70 mb-5">资产与闭环就绪度</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-white/30">检测记录数</p>
                  <p className="text-2xl font-bold text-white mt-1">{detections.length}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-white/30">复核记录数</p>
                  <p className="text-2xl font-bold text-white mt-1">{reviews.length}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-white/30">桥梁资产</p>
                  <p className="text-2xl font-bold text-white mt-1">{bridges.length}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-white/30">巡检批次</p>
                  <p className="text-2xl font-bold text-white mt-1">{batches.length}</p>
                </div>
              </div>
              {/* Background accent */}
              <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-cyan-500/10 blur-[60px] rounded-full pointer-events-none" />
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
              <h2 className="text-sm font-bold text-white tracking-widest uppercase opacity-70 mb-5">处理延迟指标</h2>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-[11px] mb-2 uppercase tracking-wider">
                    <span className="text-white/40 font-medium">P95 排队时延 (Queue Wait)</span>
                    <span className="text-cyan-400 font-bold">{opsMetrics?.p95_queue_wait_ms ?? 0} ms</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400/60 rounded-full" style={{ width: `${Math.min(100, (opsMetrics?.p95_queue_wait_ms ?? 0) / 10)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-2 uppercase tracking-wider">
                    <span className="text-white/40 font-medium">P95 运行耗时 (Execution)</span>
                    <span className="text-cyan-400 font-bold">{opsMetrics?.p95_run_ms ?? 0} ms</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400/60 rounded-full" style={{ width: `${Math.min(100, (opsMetrics?.p95_run_ms ?? 0) / 100)}%` }} />
                  </div>
                </div>
                <p className="text-[10px] text-white/20 mt-4 leading-relaxed italic">
                  * 延迟指标直接反映后端的弹性计算负载与 Worker 处理能力。
                </p>
              </div>
            </div>
          </div>

          {/* --- THIRD ROW: DISTRIBUTIONS & RANKINGS --- */}
          
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-4">异常失败码 Top 5</h3>
                <div className="space-y-3">
                  {Object.entries(failureDist).length === 0 ? (
                    <p className="text-xs text-white/20 italic py-4">暂无失败记录</p>
                  ) : (
                    Object.entries(failureDist).slice(0, 5).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
                      <div key={code} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                        <span className="text-xs font-mono text-rose-300/80">{code}</span>
                        <span className="text-xs font-bold text-white/60">{count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-4">执行状态分布</h3>
                <div className="space-y-3">
                  {Object.entries(statusDist).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className={`text-xs font-bold uppercase tracking-widest ${status === 'succeeded' ? 'text-cyan-400' : status === 'failed' ? 'text-rose-400' : 'text-amber-400'}`}>{status}</span>
                      <span className="text-xs font-bold text-white/60">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <svg className="h-32 w-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.45l8.28 14.1H3.72L12 5.45zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/></svg>
             </div>
             
             <h3 className="text-sm font-bold text-white tracking-widest uppercase mb-6 flex items-center gap-2">
               风险批次排名
               <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded">Risk Focus</span>
             </h3>
             
             <div className="space-y-3">
               {topRiskBatches.length === 0 && <p className="text-xs text-white/20 italic">目前无高风险批次需要关注。</p>}
               {topRiskBatches.map((item, idx) => (
                 <div key={item.id} className="relative group p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] transition-all cursor-default">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-wider">{item.code}</span>
                      <span className="text-[10px] font-black tabular-nums text-rose-400">SCORE {item.score}</span>
                    </div>
                    <p className="text-[10px] text-white/40 mb-3 truncate">{item.bridge}</p>
                    <div className="flex gap-4">
                      <div className="text-[9px] text-white/20 uppercase font-bold tracking-tighter">
                        Fail <span className="text-rose-400 ml-1">{item.failed}</span>
                      </div>
                      <div className="text-[9px] text-white/20 uppercase font-bold tracking-tighter">
                        Alert <span className="text-amber-400 ml-1">{item.alerts}</span>
                      </div>
                      <div className="text-[9px] text-white/20 uppercase font-bold tracking-tighter">
                        Idle <span className="text-white/40 ml-1">{item.pending}</span>
                      </div>
                    </div>
                    {/* Rank number */}
                    <div className="absolute top-2 right-2 text-[40px] font-black text-white/[0.02] select-none italic">{idx + 1}</div>
                 </div>
               ))}
             </div>
          </div>

        </div>
      )}

      {/* --- FOOTER CTA --- */}
      <footer className="pt-10 flex flex-wrap gap-4 border-t border-white/5">
        <Link 
          href="/dashboard/ops"
          className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20 transition-all font-bold text-sm tracking-wide group"
        >
          查看批次详情列表
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
        <p className="flex-1 text-xs text-white/20 self-center max-w-md">
          基于研报建议运营视角设计：通过“风险权重积分算法”自动识别待处置项，确保企业巡检数据的闭环处置。
        </p>
      </footer>
    </div>
  );
}
