"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { OpsPageLayout } from "@/components/ops/ops-page-layout";
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
          listV1Batches({ limit: 500, offset: 0 }),
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
    <OpsPageLayout
      contentClassName="space-y-12 pb-24"
      header={
        <OpsPageHeader
          eyebrow="OVERVIEW"
          title="运营总览"
          subtitle="全链路数据看板 / 风险优先级与处置效率 / REAL-TIME"
          actions={
            <div className="flex items-center gap-3">
              <div className="flex rounded-xl border border-white/5 bg-white/[0.03] p-1">
                {[24, 72, 168].map((h) => (
                  <button
                    key={h}
                    onClick={() => setWindowHours(h)}
                    className={`rounded-lg px-4 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all ${
                      windowHours === h ? "bg-white/10 text-cyan-400 shadow-xl" : "text-white/30 hover:text-white/60"
                    }`}
                  >
                    {h === 168 ? "7d" : `${h}h`}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setRefreshTick((v) => v + 1)}
                className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-white/40 transition-all hover:bg-white/10 hover:text-white"
                title="刷新数据"
              >
                <svg className={`h-4 w-4 transition-transform group-hover:rotate-180 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          }
        />
      }
    >
      <AnimatePresence mode="wait">
        <motion.div 
          key={windowHours}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-12"
        >
          {error && (
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-bold text-rose-300">
              <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
              {error}
            </div>
          )}

          {/* --- Zone 1: Real-time Status Snapshot --- */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
              label="任务处理成功率" 
              value={`${successRate.toFixed(1)}%`} 
              hint="端到端执行结果统计。"
              status={successRate > 95 ? "healthy" : successRate > 85 ? "warning" : "risk"}
              trend={[70, 85, 80, 92, 95, 94, successRate]}
            />
            <MetricCard 
              label="活跃 Open 告警" 
              value={String(openAlerts.length)} 
              hint="各级别待处理告警总数。"
              status={openAlerts.length > 50 ? "risk" : openAlerts.length > 20 ? "warning" : "healthy"}
            />
            <MetricCard 
              label="AI 数据通过率" 
              value={`${autoPassPercent.toFixed(1)}%`} 
              hint="体现模型异常过滤效能。"
              status="healthy"
              trend={[40, 45, 42, 50, 48, 55, autoPassPercent]}
            />
            <MetricCard 
              label="人机复核覆盖率" 
              value={`${reviewCoveragePercent.toFixed(1)}%`} 
              hint="已复核检测结果比例。"
              status={reviewCoveragePercent > 50 ? "healthy" : "warning"}
            />
          </section>

          {/* --- Zone 2: Action & Risk Workcenter --- */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Focus: Risk Ranking & Actions */}
            <div className="lg:col-span-8 flex flex-col gap-8">
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-2xl">
                <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-rose-500/5 blur-[100px]" />
                
                <div className="relative mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">风险处置中心 / RISK ACTION CENTER</h2>
                  </div>
                  <Link href="/dashboard/ops/alerts" className="text-[9px] font-bold text-white/30 hover:text-cyan-400 uppercase tracking-widest transition-colors">视图全局告警 &rarr;</Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Action Items List */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all">
                      <div className="flex items-center gap-4">
                        <ProgressRing percent={(highPriorityOpenAlertsCount / (openAlerts.length || 1)) * 100} color="#fb7185" size={56} />
                        <div>
                          <p className="text-2xl font-black text-rose-400 tabular-nums">{highPriorityOpenAlertsCount}</p>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">核心待办 (High/Critical)</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all">
                      <div className="flex items-center gap-4">
                        <ProgressRing percent={(overdueOpenAlertsCount / (openAlerts.length || 1)) * 100} color="#fbbf24" size={56} />
                        <div>
                          <p className="text-2xl font-black text-amber-400 tabular-nums">{overdueOpenAlertsCount}</p>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">超时未处置 (Over 24h)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Risks */}
                  <div className="space-y-3">
                    {topRiskBatches.slice(0, 3).map((item, idx) => (
                      <div key={item.id} className="group relative p-4 rounded-2xl border border-white/5 bg-black/20 hover:bg-white/[0.05] transition-all overflow-hidden cursor-default">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-white uppercase group-hover:text-rose-400 transition-colors">{item.code}</span>
                          <span className="text-[9px] font-bold text-rose-400/60 tracking-wider">RANK {idx + 1}</span>
                        </div>
                        <p className="truncate text-[9px] text-white/20 mb-2">{item.bridge}</p>
                        <div className="flex gap-4">
                          <span className="text-[8px] font-bold text-rose-400 uppercase tracking-tighter">Fail {item.failed}</span>
                          <span className="text-[8px] font-bold text-amber-400 uppercase tracking-tighter">Alert {item.alerts}</span>
                        </div>
                      </div>
                    ))}
                    {topRiskBatches.length === 0 && <p className="text-[10px] text-white/10 italic py-8 text-center uppercase tracking-widest">No matching risk nodes found</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Side info: Distribution */}
            <div className="lg:col-span-4 flex flex-col gap-6 h-full">
              <div className="flex-1 rounded-[2.5rem] border border-white/5 bg-white/[0.01] p-8 backdrop-blur-sm">
                <div className="mb-6 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/40" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">任务执行分布</h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(statusDist).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${status === 'succeeded' ? 'text-emerald-400' : status === 'failed' ? 'text-rose-400' : 'text-amber-400 group-hover:text-amber-300'}`}>{status}</span>
                      <span className="text-xs font-black tabular-nums text-white/50">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* --- Zone 3: Infrastructure & Health Base --- */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* System Readiness (Compact Tags) */}
            <div className="grid grid-cols-2 gap-4 rounded-[2rem] border border-white/5 bg-white/[0.01] p-6">
              {[
                { label: "巡检批次", val: batches.length },
                { label: "桥梁资产", val: bridges.length },
                { label: "检测记录", val: detections.length },
                { label: "复核记录", val: reviews.length }
              ].map(tag => (
                <div key={tag.label} className="p-4 rounded-2xl bg-black/20 border border-white/5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">{tag.label}</p>
                  <p className="text-lg font-black text-white/70 tabular-nums">{tag.val}</p>
                </div>
              ))}
            </div>

            {/* Latency P95 (Simplified Bars) */}
            <div className="rounded-[2rem] border border-white/5 bg-white/[0.01] p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                 <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/40" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">P95 系统处理延迟</h3>
              </div>
              <div>
                <div className="flex justify-between text-[9px] font-bold text-white/40 uppercase mb-2">
                  <span>QUEUE WAIT</span>
                  <span className="text-cyan-400">{opsMetrics?.p95_queue_wait_ms ?? 0} MS</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (opsMetrics?.p95_queue_wait_ms ?? 0) / 10)}%` }} className="h-full bg-gradient-to-r from-cyan-500/50 to-cyan-400" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[9px] font-bold text-white/40 uppercase mb-2">
                  <span>EXEC TIME</span>
                  <span className="text-cyan-400">{opsMetrics?.p95_run_ms ?? 0} MS</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                   <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (opsMetrics?.p95_run_ms ?? 0) / 100)}%` }} className="h-full bg-gradient-to-r from-cyan-500/50 to-cyan-400" />
                </div>
              </div>
            </div>

            {/* Failure Codes Top 5 */}
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-5">
                 <span className="h-1.5 w-1.5 rounded-full bg-rose-400/40" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">异常失败 Top 5</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(failureDist).slice(0, 5).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
                  <div key={code} className="flex items-center justify-between p-2.5 px-4 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-[9px] font-mono font-bold text-rose-300/60 uppercase">{code}</span>
                    <span className="text-xs font-black tabular-nums text-white/30">{count}</span>
                  </div>
                ))}
                {Object.entries(failureDist).length === 0 && <p className="text-[10px] text-white/10 italic text-center py-4 uppercase tracking-widest">No errors recorded</p>}
              </div>
            </div>
          </section>

          {/* --- Bottom Footer Annotation --- */}
          <footer className="pt-8 flex justify-center border-t border-white/5">
            <p className="text-[9px] font-bold text-white/10 uppercase tracking-[0.4em] max-w-xl text-center leading-relaxed">
              OPERATIONAL PERSPECTIVE DESIGNED: RISK-WEIGHTED SCORING ALGORITHM AUTOMATICALLY IDENTIFIES PENDING ITEMS.
            </p>
          </footer>
        </motion.div>
      </AnimatePresence>
    </OpsPageLayout>
  );
}
