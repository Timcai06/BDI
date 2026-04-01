"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { listV1Alerts, listV1Batches, listV1Detections, listV1Reviews } from "@/lib/predict-client";
import type { AlertV1, BatchV1, DetectionRecordV1, ReviewRecordV1 } from "@/lib/types";

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

export function OpsOverviewShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [alerts, setAlerts] = useState<AlertV1[]>([]);
  const [reviews, setReviews] = useState<ReviewRecordV1[]>([]);
  const [detections, setDetections] = useState<DetectionRecordV1[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [batchResp, alertResp, reviewResp, detectionResp] = await Promise.all([
          listV1Batches(200, 0),
          listV1Alerts({ limit: 200, offset: 0, sortBy: "triggered_at", sortOrder: "desc" }),
          listV1Reviews({ limit: 200, offset: 0, sortBy: "reviewed_at", sortOrder: "desc" }),
          listV1Detections({ limit: 300, offset: 0, sortBy: "created_at", sortOrder: "desc" })
        ]);
        if (cancelled) {
          return;
        }
        setBatches(batchResp.items);
        setAlerts(alertResp.items);
        setReviews(reviewResp.items);
        setDetections(detectionResp.items);
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
  }, []);

  const openAlertCount = useMemo(() => alerts.filter((item) => item.status === "open").length, [alerts]);
  const pendingReviewCount = useMemo(
    () => batches.reduce((sum, item) => sum + Math.max(0, item.succeeded_item_count), 0) - reviews.length,
    [batches, reviews]
  );
  const failedItemCount = useMemo(
    () => batches.reduce((sum, item) => sum + item.failed_item_count, 0),
    [batches]
  );
  const processingItemCount = useMemo(
    () => batches.reduce((sum, item) => sum + item.queued_item_count + item.running_item_count, 0),
    [batches]
  );
  const alertLevelBreakdown = useMemo(() => countBy(alerts, (item) => item.alert_level), [alerts]);
  const categoryBreakdown = useMemo(() => countBy(detections, (item) => item.category), [detections]);

  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-white">运营总览</h1>
          <p className="mt-1 text-sm text-white/60">企业巡检主入口：监控批次健康、复核压力与告警风险。</p>
        </div>
        <div className="flex items-center gap-2">
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
            <MetricCard label="批次数" value={String(batches.length)} hint="当前已创建巡检批次总数" />
            <MetricCard label="处理中图片" value={String(processingItemCount)} hint="队列 + 运行中的图片项" />
            <MetricCard label="失败图片" value={String(failedItemCount)} hint="需要重试或排查的图片项" />
            <MetricCard label="Open 告警" value={String(openAlertCount)} hint="待处置告警数量" />
            <MetricCard label="待复核估算" value={String(Math.max(0, pendingReviewCount))} hint="已成功结果减去已提交复核" />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold tracking-wide text-white/90">告警等级分布</h2>
              <p className="mt-3 text-sm text-white/75">{breakdownText(alertLevelBreakdown)}</p>
              <p className="mt-2 text-xs text-white/45">用于确认当前告警压力主要落在哪个级别。</p>
            </article>
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold tracking-wide text-white/90">病害类别分布</h2>
              <p className="mt-3 text-sm text-white/75">{breakdownText(categoryBreakdown)}</p>
              <p className="mt-2 text-xs text-white/45">用于识别高频病害类型，支撑策略调优。</p>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
