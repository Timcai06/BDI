"use client";

import { motion } from "framer-motion";
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
          eyebrow="资产管理层"
          title="桥梁资产中心"
          subtitle="在此管理您的桥梁资产底座，这是进行巡检批次管理的第一层级对象"
          accent="cyan"
        />
      }
    >
      {error && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300 backdrop-blur-md">
          {error}
        </motion.div>
      )}
      {notice && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300 backdrop-blur-md">
          {notice}
        </motion.div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Left Card: Asset List */}
        <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] transition-all hover:border-white/20">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px] transition-all group-hover:bg-cyan-500/10" />
          
          <div className="relative mb-8 flex items-end justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 opacity-30">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12M16 2v4M8 2v4M3 10h18"/></svg>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">资产底座</p>
              </div>
              <h3 className="text-2xl font-black tracking-tight text-white uppercase">基础设施名录</h3>
              <p className="mt-1 text-xs font-medium text-white/40">管理已接入平台的数字化桥梁资产实体</p>
            </div>
            <div className="rounded-full border border-white/5 bg-white/5 px-4 py-1 text-[10px] font-bold text-white/30 tabular-nums">
              共 {bridges.length} 座
            </div>
          </div>

          <div className="relative space-y-4">
            {loading ? (
              <div className="flex items-center gap-3 py-12 text-sm text-white/20">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
                正在载入数字资产...
              </div>
            ) : null}
            
            {bridges.map((bridge) => (
              <motion.div 
                key={bridge.id} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group/item relative overflow-hidden rounded-2xl border border-white/5 bg-black/40 p-5 ring-1 ring-white/5 transition-all hover:bg-white/[0.04] hover:ring-white/20"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex flex-1 gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/30 transition-colors group-hover/item:bg-cyan-500/10 group-hover/item:text-cyan-400">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7l9-4 9 4M5 7v14M19 7v14M10 21v-8h4v8m-7-8h10"/></svg>
                    </div>
                    <div>
                      <p className="text-base font-black text-white">{bridge.bridge_name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-cyan-400/60 tabular-nums uppercase">{bridge.bridge_code}</span>
                        <span className="h-1 w-1 rounded-full bg-white/10" />
                        <span className="text-[10px] font-medium text-white/30">{bridge.region ?? "全域资产"}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex items-center gap-1.5 grayscale opacity-40 group-hover/item:grayscale-0 group-hover/item:opacity-100 transition-all">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                          <span className="text-[10px] font-black text-white/60 tabular-nums">{bridge.active_batch_count} 活跃</span>
                        </div>
                        <div className="flex items-center gap-1.5 grayscale opacity-40 group-hover/item:grayscale-0 group-hover/item:opacity-100 transition-all">
                          <span className={`h-1.5 w-1.5 rounded-full ${bridge.abnormal_batch_count > 0 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : "bg-white/20"}`} />
                          <span className="text-[10px] font-black text-white/60 tabular-nums">{bridge.abnormal_batch_count} 异常</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/bridges/${encodeURIComponent(bridge.id)}`}
                      title="资产概览"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </Link>
                    <Link
                      href={`/dashboard/ops?bridgeId=${encodeURIComponent(bridge.id)}`}
                      title="进入批次中心"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 transition-all hover:bg-cyan-500/20"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDeleteBridge(bridge)}
                      disabled={deletingId === bridge.id}
                      title="移除资产"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400/60 transition-all hover:bg-rose-500/20 hover:text-rose-400"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {!loading && bridges.length === 0 ? <div className="py-20 text-center text-sm text-white/20">系统内暂无已注册的桥梁资产实体</div> : null}
          </div>
        </div>

        {/* Right Card: Create Asset Form */}
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] text-left">
          <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-[100px]" />
          
          <div className="relative mb-8">
            <div className="mb-2 flex items-center gap-2 opacity-30">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">业务入口</p>
            </div>
            <h3 className="text-2xl font-black tracking-tight text-white uppercase">注册新资产</h3>
            <p className="mt-1 text-xs font-medium text-white/40">手动建立物理桥梁与数字孪生实体的映射关系</p>
          </div>

          <div className="relative space-y-6">
            <div className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">资产唯一编码</label>
                <div className="relative rounded-2xl border border-white/5 bg-black/40 p-1.5 ring-1 ring-white/5 focus-within:ring-cyan-500/50 transition-all">
                  <input
                    value={bridgeCode}
                    onChange={(event) => setBridgeCode(event.target.value)}
                    placeholder="例如：NJ-Y001"
                    className="h-12 w-full bg-transparent px-4 text-sm font-bold text-white outline-none placeholder:text-white/10"
                  />
                </div>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">资产官方名称</label>
                <div className="relative rounded-2xl border border-white/5 bg-black/40 p-1.5 ring-1 ring-white/5 focus-within:ring-cyan-500/50 transition-all">
                  <input
                    value={bridgeName}
                    onChange={(event) => setBridgeName(event.target.value)}
                    placeholder="例如：南京长江大桥一期"
                    className="h-12 w-full bg-transparent px-4 text-sm font-bold text-white outline-none placeholder:text-white/10"
                  />
                </div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => void handleCreateBridge()}
              disabled={submitting}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-cyan-500 text-sm font-black uppercase tracking-widest text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  正在注册...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  新增桥梁
                </>
              )}
            </button>
            <p className="text-center text-[10px] font-medium leading-relaxed text-white/20">
              资产建立后，您可以在巡检批次中心针对该桥梁<br />上传、处理和分析巡检图像数据。
            </p>
          </div>
        </div>
      </section>
    </OpsPageLayout>
  );
}
