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

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-white/50">{hint}</p>
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
  if (entries.length === 0) {
    return "暂无数据";
  }
  return entries.map(([k, v]) => `${k}: ${v}`).join(" | ");
}

function toPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) {
    return "N/A";
  }
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function ageHours(isoTime: string): number {
  const ts = Date.parse(isoTime);
  if (Number.isNaN(ts)) {
    return 0;
  }
  return (Date.now() - ts) / 3_600_000;
}

const ALERT_WEIGHT: Record<string, number> = {
  critical: 8,
  high: 5,
  medium: 3,
  low: 1
};

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
        if (cancelled) {
          return;
        }
        setBatches(batchResp.items);
        setBridges(bridgeResp.items);
        setAlerts(alertResp.items);
        setReviews(reviewResp.items);
        setDetections(detectionResp.items);
        setOpsMetrics(metricsResp);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "总览数据加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [windowHours, refreshTick]);

  const bridgeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const bridge of bridges) {
      map.set(bridge.id, `${bridge.bridge_code} | ${bridge.bridge_name}`);
    }
    return map;
  }, [bridges]);

  const openAlerts = useMemo(() => alerts.filter((item) => item.status === "open"), [alerts]);
  const highPriorityOpenAlerts = useMemo(
    () => openAlerts.filter((item) => item.alert_level === "critical" || item.alert_level === "high"),
    [openAlerts]
  );
  const overdueOpenAlerts = useMemo(
    () => openAlerts.filter((item) => ageHours(item.triggered_at) > 24),
    [openAlerts]
  );

  const totalReceivedItems = useMemo(
    () => batches.reduce((sum, item) => sum + item.received_item_count, 0),
    [batches]
  );
  const totalSucceededItems = useMemo(
    () => batches.reduce((sum, item) => sum + item.succeeded_item_count, 0),
    [batches]
  );
  const failedItemCount = useMemo(
    () => batches.reduce((sum, item) => sum + item.failed_item_count, 0),
    [batches]
  );
  const processingItemCount = useMemo(
    () => batches.reduce((sum, item) => sum + item.queued_item_count + item.running_item_count, 0),
    [batches]
  );

  const reviewedDetectionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const review of reviews) {
      ids.add(review.detection_id);
    }
    return ids;
  }, [reviews]);

  const reviewedDetectionCount = reviewedDetectionIds.size;
  const reviewCoverageText = toPercent(reviewedDetectionCount, detections.length);
  const autoPassRateText = toPercent(totalSucceededItems, totalReceivedItems);
  const pendingReviewDetections = Math.max(0, detections.length - reviewedDetectionCount);

  const resolvedAlertCount = useMemo(
    () => alerts.filter((item) => item.status === "resolved").length,
    [alerts]
  );
  const alertClosureRate = toPercent(resolvedAlertCount, alerts.length);

  const categoryBreakdown = useMemo(() => countBy(detections, (item) => item.category), [detections]);
  const alertLevelBreakdown = useMemo(() => countBy(alerts, (item) => item.alert_level), [alerts]);

  const topRiskBatches = useMemo(() => {
    const openAlertWeightsByBatch = new Map<string, number>();
    for (const alert of openAlerts) {
      const current = openAlertWeightsByBatch.get(alert.batch_id) ?? 0;
      const weight = ALERT_WEIGHT[alert.alert_level] ?? 1;
      openAlertWeightsByBatch.set(alert.batch_id, current + weight);
    }

    return batches
      .map((batch) => {
        const openWeight = openAlertWeightsByBatch.get(batch.id) ?? 0;
        const score = openWeight + batch.failed_item_count * 2 + batch.running_item_count + batch.queued_item_count;
        return {
          id: batch.id,
          batchCode: batch.batch_code,
          bridgeName: bridgeNameMap.get(batch.bridge_id) ?? batch.bridge_id,
          score,
          failed: batch.failed_item_count,
          queuedRunning: batch.queued_item_count + batch.running_item_count,
          openAlertWeight: openWeight
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [batches, bridgeNameMap, openAlerts]);

  const failureCodeBreakdown = useMemo(
    () => (opsMetrics ? breakdownText(opsMetrics.failure_code_breakdown) : "暂无数据"),
    [opsMetrics]
  );

  const p95QueueText = opsMetrics?.p95_queue_wait_ms != null ? `${opsMetrics.p95_queue_wait_ms} ms` : "N/A";
  const p95RunText = opsMetrics?.p95_run_ms != null ? `${opsMetrics.p95_run_ms} ms` : "N/A";
  const successRateText = `${((opsMetrics?.success_rate ?? 0) * 100).toFixed(1)}%`;
  const retryRecoveryText =
    opsMetrics?.retry_recovery_rate == null ? "N/A" : `${(opsMetrics.retry_recovery_rate * 100).toFixed(1)}%`;
  const queueBacklogText = String((opsMetrics?.queued_tasks ?? 0) + (opsMetrics?.running_tasks ?? 0));

  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-white">运营总览</h1>
          <p className="mt-1 text-sm text-white/60">
            企业巡检主入口：从识别结果走向处置优先级、人工复核与闭环效率。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
            className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-xs tracking-wider text-white/80"
          >
            <option value={24}>24h 视窗</option>
            <option value={72}>72h 视窗</option>
            <option value={168}>7d 视窗</option>
          </select>
          <button
            type="button"
            onClick={() => setRefreshTick((v) => v + 1)}
            className="rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-xs tracking-wider text-white/80 hover:bg-white/[0.08]"
          >
            刷新数据
          </button>
          <Link
            href="/dashboard/ops"
            className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs tracking-wider text-cyan-200 hover:bg-cyan-300/20"
          >
            进入批次中心
          </Link>
          <Link
            href="/dashboard/ops/alerts"
            className="rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-xs tracking-wider text-white/80 hover:bg-white/[0.08]"
          >
            查看告警中心
          </Link>
        </div>
      </header>

      {error && <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">总览加载中...</div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <MetricCard label={`任务成功率(${windowHours}h)`} value={successRateText} hint="succeeded / total_tasks" />
            <MetricCard label={`重试恢复率(${windowHours}h)`} value={retryRecoveryText} hint="重试后成功回归比例" />
            <MetricCard label="任务积压" value={queueBacklogText} hint="queued + running 任务数" />
            <MetricCard label="P95 排队时延" value={p95QueueText} hint="入队到开始执行耗时" />
            <MetricCard label="P95 执行时延" value={p95RunText} hint="started -> finished" />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <MetricCard label="AI通过率" value={autoPassRateText} hint="succeeded_item / received_item" />
            <MetricCard label="复核覆盖率" value={reviewCoverageText} hint="已复核 detection / detection 总数" />
            <MetricCard label="待复核 detection" value={String(pendingReviewDetections)} hint="人机协同剩余工作量" />
            <MetricCard label="Open 告警" value={String(openAlerts.length)} hint="待处置告警" />
            <MetricCard label="告警关闭率" value={alertClosureRate} hint="resolved / alerts 总数" />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <article className="rounded-xl border border-rose-300/20 bg-rose-400/5 p-4">
              <h2 className="text-sm font-semibold tracking-wide text-rose-100">处置优先队列</h2>
              <div className="mt-3 space-y-2 text-sm text-white/80">
                <p>高优先级 Open 告警（high/critical）：{highPriorityOpenAlerts.length}</p>
                <p>超 24h 未处置 Open 告警：{overdueOpenAlerts.length}</p>
                <p>失败图片：{failedItemCount}</p>
                <p>处理中图片：{processingItemCount}</p>
              </div>
              <p className="mt-2 text-xs text-white/45">对齐研报“风险优先级+闭环处置”的运营视角。</p>
            </article>

            <article className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
              <h2 className="text-sm font-semibold tracking-wide text-cyan-100">合规与证据链就绪度</h2>
              <div className="mt-3 space-y-2 text-sm text-white/80">
                <p>批次数：{batches.length}</p>
                <p>桥梁资产数：{bridges.length}</p>
                <p>检测记录：{detections.length}</p>
                <p>复核记录：{reviews.length}</p>
              </div>
              <p className="mt-2 text-xs text-white/45">体现“资产-检测-复核-告警”是否已经形成闭环数据骨架。</p>
            </article>

            <article className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
              <h2 className="text-sm font-semibold tracking-wide text-amber-100">建议动作</h2>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                <li>1. 先处理超 24h 未关闭告警，避免风险积压。</li>
                <li>2. 针对失败图片批量重试，观察失败码 Top1 原因。</li>
                <li>3. 对高频病害类别提高复核覆盖率，稳定告警阈值。</li>
              </ul>
              <p className="mt-2 text-xs text-white/45">符合研报建议：从“识别”走向“可执行维护决策”。</p>
            </article>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold tracking-wide text-white/90">告警等级分布</h2>
              <p className="mt-3 text-sm text-white/75">{breakdownText(alertLevelBreakdown)}</p>
              <p className="mt-2 text-xs text-white/45">用于确认告警压力主要落在哪个级别。</p>
            </article>
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold tracking-wide text-white/90">病害类别分布</h2>
              <p className="mt-3 text-sm text-white/75">{breakdownText(categoryBreakdown)}</p>
              <p className="mt-2 text-xs text-white/45">用于识别高频病害类型，支撑策略调优。</p>
            </article>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold tracking-wide text-white/90">任务状态分布 ({windowHours}h)</h2>
              <p className="mt-3 text-sm text-white/75">{breakdownText(opsMetrics?.status_breakdown ?? {})}</p>
              <p className="mt-2 text-xs text-white/45">用于确认瓶颈在 queued / running / failed 哪一段。</p>
            </article>
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold tracking-wide text-white/90">失败码分布 ({windowHours}h)</h2>
              <p className="mt-3 text-sm text-white/75">{failureCodeBreakdown}</p>
              <p className="mt-2 text-xs text-white/45">用于快速定位最常见失败类型并安排修复优先级。</p>
            </article>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold tracking-wide text-white/90">风险批次 Top 6（按综合分）</h2>
            <p className="mt-1 text-xs text-white/45">综合分 = Open告警权重 + 失败项×2 + 排队/运行项。</p>
            <div className="mt-3 space-y-2">
              {topRiskBatches.length === 0 && <p className="text-sm text-white/55">暂无高风险批次。</p>}
              {topRiskBatches.map((item) => (
                <div key={item.id} className="rounded border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-white">{item.batchCode}</span>
                    <span className="text-amber-200">风险分: {item.score}</span>
                  </div>
                  <p className="mt-1 text-white/60">{item.bridgeName}</p>
                  <p className="mt-1 text-white/60">
                    open_alert_weight={item.openAlertWeight} | failed={item.failed} | queued+running={item.queuedRunning}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
