"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { OpsPageLayout } from "@/components/ops/ops-page-layout";
import { createV1Bridge, deleteV1Bridge, listV1Bridges } from "@/lib/predict-client";
import type { BridgeV1 } from "@/lib/types";

export function BridgeAssetsShell() {
  const [bridges, setBridges] = useState<BridgeV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bridgeCode, setBridgeCode] = useState("");
  const [bridgeName, setBridgeName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await listV1Bridges(200, 0);
      setBridges(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "桥梁资产列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreateBridge() {
    if (!bridgeCode.trim() || !bridgeName.trim()) {
      setError("桥梁编码和桥梁名称不能为空。");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createV1Bridge({
        bridgeCode: bridgeCode.trim(),
        bridgeName: bridgeName.trim(),
      });
      setNotice(`桥梁创建成功：${created.bridge_code}`);
      setBridgeCode("");
      setBridgeName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "桥梁创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBridge(bridge: BridgeV1) {
    const confirmed = window.confirm(`确认删除桥梁资产 ${bridge.bridge_code} / ${bridge.bridge_name}？该操作会同时删除该桥下所有批次和结果记录。`);
    if (!confirmed) {
      return;
    }
    setDeletingId(bridge.id);
    setError(null);
    setNotice(null);
    try {
      await deleteV1Bridge(bridge.id);
      setNotice(`桥梁已删除：${bridge.bridge_code}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "桥梁删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <OpsPageLayout
      contentClassName="space-y-8"
      header={
        <OpsPageHeader
          eyebrow="ASSET"
          title="桥梁资产"
          subtitle="第一层对象。先管理桥梁资产，再进入该桥下的批次工作台。"
          accent="cyan"
          actions={
            <Link
              href="/dashboard/ops"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              进入批次中心
            </Link>
          }
        />
      }
    >
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{notice}</div> : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">桥梁资产列表</p>
            <p className="mt-1 text-sm text-white/45">桥梁是第一层对象。批次、历史和风险都从桥梁资产进入。</p>
          </div>
          {loading ? <div className="text-sm text-white/45">正在加载桥梁资产...</div> : null}
          <div className="space-y-3">
            {bridges.map((bridge) => (
              <div key={bridge.id} className="rounded-xl border border-white/8 bg-black/20 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{bridge.bridge_name}</p>
                    <p className="mt-1 text-xs text-white/45">{bridge.bridge_code} / {bridge.region ?? "未设置区域"}</p>
                    <p className="mt-2 text-[11px] text-white/50">
                      活跃批次 {bridge.active_batch_count} / 异常批次 {bridge.abnormal_batch_count}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/bridges/${encodeURIComponent(bridge.id)}`}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      查看资产
                    </Link>
                    <Link
                      href={`/dashboard/ops?bridgeId=${encodeURIComponent(bridge.id)}`}
                      className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20"
                    >
                      进入批次
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDeleteBridge(bridge)}
                      disabled={deletingId === bridge.id}
                      className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      {deletingId === bridge.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && bridges.length === 0 ? <div className="text-sm text-white/45">暂无桥梁资产。</div> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">新建桥梁资产</p>
            <p className="mt-1 text-sm text-white/45">先创建桥梁资产，再进入该桥下创建批次。</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">桥梁编码</label>
              <input
                value={bridgeCode}
                onChange={(event) => setBridgeCode(event.target.value)}
                placeholder="例如：NJ-001"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
              />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">桥梁名称</label>
              <input
                value={bridgeName}
                onChange={(event) => setBridgeName(event.target.value)}
                placeholder="例如：南京长江大桥"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleCreateBridge()}
              disabled={submitting}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-black transition-all hover:bg-cyan-400 disabled:opacity-40"
            >
              {submitting ? "创建中..." : "新建桥梁资产"}
            </button>
          </div>
        </div>
      </section>
    </OpsPageLayout>
  );
}
