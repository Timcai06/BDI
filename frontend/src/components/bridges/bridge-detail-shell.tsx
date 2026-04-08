"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { OpsPageLayout } from "@/components/ops/ops-page-layout";
import { deleteV1Bridge, listV1Alerts, listV1Batches, listV1Bridges } from "@/lib/predict-client";
import type { AlertV1, BatchV1, BridgeV1 } from "@/lib/types";

interface Props {
  bridgeId: string;
}

export function BridgeDetailShell({ bridgeId }: Props) {
  const router = useRouter();
  const [bridge, setBridge] = useState<BridgeV1 | null>(null);
  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [alerts, setAlerts] = useState<AlertV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [bridgeResp, batchResp] = await Promise.all([
          listV1Bridges(200, 0),
          listV1Batches({ limit: 100, offset: 0, bridgeId }),
        ]);
        if (cancelled) return;
        const currentBridge = bridgeResp.items.find((item) => item.id === bridgeId) ?? null;
        setBridge(currentBridge);
        setBatches(batchResp.items);
        const batchIds = new Set(batchResp.items.map((batch) => batch.id));
        const alertPayload = await listV1Alerts({
          statusFilter: "open",
          limit: 100,
          offset: 0,
          sortBy: "triggered_at",
          sortOrder: "desc",
        });
        if (cancelled) return;
        setAlerts(alertPayload.items.filter((item) => batchIds.has(item.batch_id)).slice(0, 20));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "桥梁视图加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bridgeId]);

  const latestBatches = useMemo(() => batches.slice(0, 10), [batches]);
  const openAlerts = useMemo(() => alerts.filter((item) => item.status === "open"), [alerts]);

  async function handleDeleteBridge() {
    if (!bridge) {
      return;
    }
    const confirmed = window.confirm(`确认删除桥梁资产 ${bridge.bridge_code} / ${bridge.bridge_name}？该操作会同时删除该桥下的所有批次和识别结果。`);
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteV1Bridge(bridge.id);
      router.push("/dashboard/bridges");
    } catch (err) {
      setError(err instanceof Error ? err.message : "桥梁删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <OpsPageLayout
      contentClassName="space-y-8"
      header={
        <OpsPageHeader
          eyebrow="资产驾驶舱"
          title={bridge?.bridge_name ?? "资产详情"}
          subtitle={bridge ? `${bridge.bridge_code} | 实时监测全桥风险隐患、批次任务与数据完整度` : "正在载入资产底座信息..."}
          accent="cyan"
          actions={
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/bridges"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black text-white/50 transition-all hover:bg-white/10 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                返回列表
              </Link>
              <Link
                href={bridge ? `/dashboard/ops?bridgeId=${encodeURIComponent(bridge.id)}` : "/dashboard/ops"}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-2.5 text-xs font-black text-cyan-200 transition-all hover:bg-cyan-500/20"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20L12 2z"/></svg>
                批次中心
              </Link>
              {bridge ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteBridge()}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs font-black text-rose-300 transition-all hover:bg-rose-500/20 disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  {deleting ? "移除中" : "移除资产"}
                </button>
              ) : null}
            </div>
          }
        />
      }
    >
      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300 backdrop-blur-md">{error}</div> : null}

      {loading ? (
        <div className="space-y-8 page-enter">
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 space-y-4">
                <div className="skeleton-pulse h-10 w-10 !rounded-xl" />
                <div className="skeleton-bar h-2 w-16" />
                <div className="skeleton-bar h-6 w-12" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="skeleton-pulse min-h-[400px]" />
            <div className="skeleton-pulse min-h-[400px]" />
          </div>
        </div>
      ) : bridge ? (
        <div className="space-y-8 page-enter">
          {/* Top Bento Stats */}
          <section className="grid gap-4 md:grid-cols-4">
            <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-white/20">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">资产区域</p>
              <p className="mt-2 text-xl font-black text-white">{bridge.region ?? "全域注册"}</p>
              <p className="mt-1 text-[10px] font-bold text-white/30 uppercase tracking-widest">{bridge.bridge_code}</p>
            </article>

            <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-white/20">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">活跃巡检</p>
              <p className="mt-2 text-3xl font-black text-white tabular-nums">{bridge.active_batch_count}</p>
            </article>

            <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-white/20">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"/></svg>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">异常批次</p>
              <p className={`mt-2 text-3xl font-black tabular-nums ${bridge.abnormal_batch_count > 0 ? "text-rose-400" : "text-white"}`}>{bridge.abnormal_batch_count}</p>
            </article>

            <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-white/20">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">待处理告警</p>
              <p className={`mt-2 text-3xl font-black tabular-nums ${openAlerts.length > 0 ? "text-amber-400" : "text-white"}`}>{openAlerts.length}</p>
            </article>
          </section>

          {/* Detailed Bento Grid */}
          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* Recent Batches Card */}
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] transition-all hover:border-white/20">
              <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px]" />
              
              <div className="relative mb-8 flex items-center justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 opacity-30">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">时序记录</p>
                  </div>
                  <h3 className="text-2xl font-black tracking-tight text-white uppercase">最新巡检动态</h3>
                  <p className="mt-1 text-xs font-medium text-white/40">该资产下近期发起的数字化巡检任务批次</p>
                </div>
                <Link
                  href={`/dashboard/ops?bridgeId=${encodeURIComponent(bridge.id)}`}
                  className="rounded-full border border-white/5 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/40 transition-all hover:bg-white/10 hover:text-white"
                >
                  全量记录
                </Link>
              </div>

              <div className="relative grid gap-3 sm:grid-cols-2">
                {latestBatches.map((batch) => (
                  <Link
                    key={batch.id}
                    href={`/dashboard/ops?bridgeId=${encodeURIComponent(bridge.id)}&batchId=${encodeURIComponent(batch.id)}`}
                    className="group/item flex flex-col justify-between rounded-2xl border border-white/5 bg-black/40 p-5 ring-1 ring-white/5 transition-all hover:bg-white/[0.04] hover:ring-white/20"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-white">{batch.batch_code}</p>
                        <span className="rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-white/20 uppercase tracking-widest">
                          {batch.enhancement_mode ?? "auto"}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-4">
                        <div>
                          <p className="text-[9px] font-bold text-white/20 uppercase">成功</p>
                          <p className="text-sm font-black text-emerald-400/80 tabular-nums">{batch.succeeded_item_count}</p>
                        </div>
                        <div className="h-4 w-px bg-white/5" />
                        <div>
                          <p className="text-[9px] font-bold text-white/20 uppercase">失败</p>
                          <p className="text-sm font-black text-rose-400/80 tabular-nums">{batch.failed_item_count}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3">
                      <span className={`h-1.5 w-1.5 rounded-full ${batch.status === "completed" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]"}`} />
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">{batch.status}</span>
                    </div>
                  </Link>
                ))}
                {latestBatches.length === 0 ? <div className="col-span-2 py-12 text-center text-sm text-white/10">暂无关联巡检数据</div> : null}
              </div>
            </div>

            {/* Risk Summary Card */}
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] transition-all hover:border-white/20">
              <div className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-amber-500/5 blur-[120px]" />
              
              <div className="relative mb-8">
                <div className="mb-2 flex items-center gap-2 opacity-30">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"/></svg>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">风险态势</p>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white uppercase">开放异常告警</h3>
                <p className="mt-1 text-xs font-medium text-white/40">当前资产存在的未闭环业务预警或结构异常</p>
              </div>

              <div className="relative space-y-3">
                {openAlerts.slice(0, 10).map((alert) => (
                  <div key={alert.id} className="group/item flex items-start justify-between rounded-2xl border border-white/5 bg-black/40 p-4 transition-all hover:bg-white/[0.04]">
                    <div>
                      <p className="text-sm font-black text-white">{alert.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase ${alert.alert_level === "high" ? "text-rose-400" : alert.alert_level === "medium" ? "text-amber-400" : "text-cyan-400"}`}>
                          {alert.alert_level}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-white/10" />
                        <span className="text-[10px] font-medium text-white/30 lowercase">触发于 {new Date(alert.triggered_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/20 transition-all group-hover/item:bg-white/10 group-hover/item:text-white">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </div>
                ))}
                {openAlerts.length === 0 ? <div className="py-12 text-center text-sm text-white/10">当前全桥状态安全，无活动告警</div> : null}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="py-20 text-center text-white/20 font-black">未找到指定的桥梁资产实体</div>
      )}
    </OpsPageLayout>
  );
}
