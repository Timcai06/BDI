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
        const alertPayloads = await Promise.all(
          batchResp.items.slice(0, 20).map((batch) =>
            listV1Alerts({ batchId: batch.id, limit: 20, offset: 0, sortBy: "triggered_at", sortOrder: "desc" }),
          ),
        );
        if (cancelled) return;
        setAlerts(alertPayloads.flatMap((item) => item.items).slice(0, 20));
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

  const latestBatches = useMemo(() => batches.slice(0, 8), [batches]);
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
          eyebrow="BRIDGE"
          title={bridge?.bridge_name ?? "桥梁资产"}
          subtitle={bridge ? `${bridge.bridge_code} / 资产视角下查看批次、风险与异常` : "正在载入桥梁资产信息"}
          accent="cyan"
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/bridges"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                返回资产列表
              </Link>
              <Link
                href={bridge ? `/dashboard/ops?bridgeId=${encodeURIComponent(bridge.id)}` : "/dashboard/ops"}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                批次工作台
              </Link>
              {bridge ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteBridge()}
                  disabled={deleting}
                  className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
                >
                  {deleting ? "删除中..." : "删除桥梁"}
                </button>
              ) : null}
            </div>
          }
        />
      }
    >
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div> : null}
      {loading ? <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-white/45">正在加载桥梁资产视图...</div> : null}

      {bridge ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">桥梁编码</p>
              <p className="mt-2 text-base font-black text-white">{bridge.bridge_code}</p>
              <p className="mt-1 text-xs text-white/45">{bridge.region ?? "未设置区域"}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">活跃批次</p>
              <p className="mt-2 text-base font-black text-white">{bridge.active_batch_count}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">异常批次</p>
              <p className="mt-2 text-base font-black text-white">{bridge.abnormal_batch_count}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">未关闭告警</p>
              <p className="mt-2 text-base font-black text-white">{openAlerts.length}</p>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">最近批次</p>
                  <p className="mt-1 text-sm text-white/45">从桥梁资产视角查看本桥近批次。</p>
                </div>
                <Link
                  href={`/dashboard/ops?bridgeId=${encodeURIComponent(bridge.id)}`}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                >
                  进入批次中心
                </Link>
              </div>
              <div className="space-y-3">
                {latestBatches.map((batch) => (
                  <Link
                    key={batch.id}
                    href={`/dashboard/ops?bridgeId=${encodeURIComponent(bridge.id)}&batchId=${encodeURIComponent(batch.id)}`}
                    className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/75 hover:bg-white/[0.05]"
                  >
                    <div>
                      <p className="font-semibold text-white">{batch.batch_code}</p>
                      <p className="mt-1 text-xs text-white/45">{batch.status} / success {batch.succeeded_item_count} / failed {batch.failed_item_count}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-white/50">
                      {batch.enhancement_mode ?? "auto"}
                    </span>
                  </Link>
                ))}
                {latestBatches.length === 0 ? <div className="text-sm text-white/45">当前桥梁还没有巡检批次。</div> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">当前风险摘要</p>
              <div className="mt-4 space-y-3">
                {openAlerts.slice(0, 8).map((alert) => (
                  <div key={alert.id} className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                    <p className="text-sm font-semibold text-white">{alert.title}</p>
                    <p className="mt-1 text-xs text-white/45">{alert.alert_level} / {alert.status}</p>
                  </div>
                ))}
                {openAlerts.length === 0 ? <div className="text-sm text-white/45">当前桥梁没有开放中的异常告警。</div> : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </OpsPageLayout>
  );
}
