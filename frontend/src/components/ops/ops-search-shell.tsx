"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { OpsPageLayout } from "@/components/ops/ops-page-layout";
import { listV1Batches, listV1Detections } from "@/lib/predict-client";
import type { BatchV1, DetectionRecordV1 } from "@/lib/types";

export function OpsSearchShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [detections, setDetections] = useState<DetectionRecordV1[]>([]);

  const [batchId, setBatchId] = useState(searchParams.get("batchId") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [minConfidence, setMinConfidence] = useState(searchParams.get("minConfidence") ?? "0.8");
  const [sortBy, setSortBy] = useState<"created_at" | "confidence" | "area_mm2">(
    (searchParams.get("sortBy") as "created_at" | "confidence" | "area_mm2") ?? "created_at",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("sortOrder") as "asc" | "desc") ?? "desc",
  );

  useEffect(() => {
    let cancelled = false;
    async function loadBatches() {
      try {
        const resp = await listV1Batches({ limit: 200, offset: 0 });
        if (!cancelled) {
          setBatches(resp.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "批次列表加载失败");
        }
      }
    }
    loadBatches();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const resp = await listV1Detections({
        batchId: batchId || undefined,
        category: category || undefined,
        minConfidence: minConfidence ? Number(minConfidence) : undefined,
        sortBy,
        sortOrder,
        limit: 200,
        offset: 0
      });
      setDetections(resp.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "病害检索失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, category, minConfidence, sortBy, sortOrder]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (batchId) params.set("batchId", batchId);
    if (category) params.set("category", category);
    if (minConfidence && minConfidence !== "0.8") params.set("minConfidence", minConfidence);
    if (sortBy !== "created_at") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [batchId, category, minConfidence, pathname, router, sortBy, sortOrder]);

  const currentHref = (() => {
    const params = new URLSearchParams();
    if (batchId) params.set("batchId", batchId);
    if (category) params.set("category", category);
    if (minConfidence && minConfidence !== "0.8") params.set("minConfidence", minConfidence);
    if (sortBy !== "created_at") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    return params.toString() ? `${pathname}?${params.toString()}` : pathname;
  })();

  return (
    <OpsPageLayout
      contentClassName="space-y-6"
      header={
        <OpsPageHeader
          eyebrow="SEARCH"
          title="病害检索"
          subtitle={
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-white/30">
              <span className="uppercase">Cross-Batch Neural Retrieval</span>
              <span className="h-1 w-1 rounded-full bg-white/10" />
              <span className="text-cyan-400/60 transition-all group-hover:text-cyan-400">{detections.length} NODES FOUND</span>
            </div>
          }
          actions={
            <button
              type="button"
              onClick={() => {
                void runSearch();
              }}
              disabled={loading}
              className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100 transition-all hover:bg-cyan-500/20 disabled:opacity-30 active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.1)]"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              {loading ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                  <span>Searching</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <span>Invoke Search</span>
                </>
              )}
            </button>
          }
        />
      }
    >
        <section 
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] page-enter"
        >
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/5 blur-[100px]" />
          
          <div className="relative mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">检索配置 / RETRIEVAL CONFIG</h3>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-4" />
          </div>

          <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Target Batch */}
            <div className="group space-y-2">
              <div className="flex items-center gap-2 opacity-50 transition-opacity group-focus-within:opacity-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">目标批次</label>
              </div>
              <div className="relative rounded-xl border border-white/5 bg-black/40 p-1 ring-1 ring-inset ring-white/5 focus-within:ring-cyan-500/50 transition-all">
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="h-9 w-full appearance-none bg-transparent px-3 text-xs font-bold text-white outline-none"
                >
                  <option value="" className="bg-[#121212]">全部批次 (ALL)</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id} className="bg-[#121212]">
                      {batch.batch_code}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-20">
                  <svg width="8" height="6" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L6 6L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                </div>
              </div>
            </div>

            {/* Category */}
            <div className="group space-y-2">
              <div className="flex items-center gap-2 opacity-50 transition-opacity group-focus-within:opacity-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">识别类别</label>
              </div>
              <div className="relative rounded-xl border border-white/5 bg-black/40 p-1 ring-1 ring-inset ring-white/5 focus-within:ring-cyan-500/50 transition-all">
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="检索类别..."
                  className="h-9 w-full bg-transparent px-3 text-xs font-bold text-white outline-none placeholder:text-white/10"
                />
              </div>
            </div>

            {/* Confidence */}
            <div className="group space-y-2">
              <div className="flex items-center gap-2 opacity-50 transition-opacity group-focus-within:opacity-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">最低置信度</label>
              </div>
              <div className="relative rounded-xl border border-white/5 bg-black/40 p-1 ring-1 ring-inset ring-white/5 focus-within:ring-cyan-500/50 transition-all">
                <input
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(e.target.value)}
                  placeholder="0.80"
                  className="h-9 w-full bg-transparent px-3 text-xs font-bold text-white outline-none placeholder:text-white/10"
                />
              </div>
            </div>

            {/* SortBy */}
            <div className="group space-y-2">
               <div className="flex items-center gap-2 opacity-50 transition-opacity group-focus-within:opacity-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">排序依据</label>
              </div>
              <div className="relative rounded-xl border border-white/5 bg-black/40 p-1 ring-1 ring-inset ring-white/5 focus-within:ring-cyan-500/50 transition-all">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "created_at" | "confidence" | "area_mm2")}
                  className="h-9 w-full appearance-none bg-transparent px-3 text-xs font-bold text-white outline-none"
                >
                  <option value="created_at" className="bg-[#121212]">时间顺序</option>
                  <option value="confidence" className="bg-[#121212]">自信度</option>
                  <option value="area_mm2" className="bg-[#121212]">样本面积</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-20">
                  <svg width="8" height="6" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L6 6L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                </div>
              </div>
            </div>

            {/* SortOrder */}
            <div className="group space-y-2">
              <div className="flex items-center gap-2 opacity-50 transition-opacity group-focus-within:opacity-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="7" y1="7" x2="17" y2="7"/><line x1="7" y1="11" x2="17" y2="11"/><line x1="7" y1="15" x2="13" y2="15"/></svg>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">排列顺序</label>
              </div>
              <div className="relative rounded-xl border border-white/5 bg-black/40 p-1 ring-1 ring-inset ring-white/5 focus-within:ring-cyan-500/50 transition-all">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                  className="h-9 w-full appearance-none bg-transparent px-3 text-xs font-bold text-white outline-none"
                >
                  <option value="desc" className="bg-[#121212]">降序排列 (DESC)</option>
                  <option value="asc" className="bg-[#121212]">升序排列 (ASC)</option>
                </select>
                 <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-20">
                  <svg width="8" height="6" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L6 6L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-8 min-h-[400px]">
          <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-[100px]" />
          
          <div className="relative mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">识别产出 / DETECTION RECOGNITION</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-px w-24 bg-white/10" />
              <span className="text-[10px] font-bold tabular-nums text-white/20">RESULT_SET: {detections.length}</span>
            </div>
          </div>
          
            <div className="relative grid grid-cols-1 gap-4 max-h-[800px] overflow-auto scroll-smooth pr-4 custom-scrollbar lg:grid-cols-2">
              {detections.map((det, idx) => (
                <div 
                  key={det.id}
                  className="list-item-enter group relative flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-500 hover:border-white/20 hover:bg-white/[0.04] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Confidence Badge */}
                      <div className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br border shadow-inner ${
                        det.confidence > 0.9 ? "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400" :
                        det.confidence > 0.7 ? "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400" :
                        "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400"
                      }`}>
                        <div className="text-center">
                          <span className="block text-[8px] font-black uppercase tracking-tighter opacity-50">Conf</span>
                          <span className="text-sm font-black italic">{(det.confidence * 100).toFixed(0)}</span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4 className="truncate text-base font-black tracking-tight text-white uppercase group-hover:text-cyan-400 transition-colors">
                          {det.category}
                        </h4>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`h-1 w-1 rounded-full ${det.is_valid ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"}`} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 truncate">ID: {det.id.slice(0, 12)}</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/ops/items/${encodeURIComponent(det.batch_item_id)}?returnTo=${encodeURIComponent(currentHref)}`}
                      aria-label="VIEW ITEM DETAIL"
                      title="VIEW ITEM DETAIL"
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
                    <div className="rounded-xl bg-black/20 p-2 text-center">
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/20">样本面积</p>
                      <p className="font-mono text-[10px] font-bold text-white/60">{det.area_mm2 ? `${det.area_mm2} mm²` : "N/A"}</p>
                    </div>
                    <div className="rounded-xl bg-black/20 p-2 text-center">
                      <p className="text-[8px] font-black uppercase tracking-widest text-white/20">校验状态</p>
                      <p className={`text-[10px] font-bold uppercase ${det.is_valid ? "text-emerald-400" : "text-rose-400"}`}>{det.is_valid ? "Valid" : "Rejected"}</p>
                    </div>
                  </div>
                </div>
              ))}

            {loading && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 px-4">
                <div className="relative mb-6">
                  <div className="h-16 w-16 animate-spin rounded-full border-t-2 border-cyan-500 border-r-2 border-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-cyan-500/20" />
                  </div>
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 animate-pulse">Running Neural Query</h4>
                <p className="mt-2 text-[8px] font-bold uppercase tracking-widest text-white/20">Synchronizing with edge registry...</p>
              </div>
            )}

            {!loading && detections.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
                <div className="relative mb-6 rounded-3xl bg-white/[0.01] p-8 border border-white/5 shadow-inner">
                  <svg className="w-12 h-12 text-white/5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <div className="absolute -right-2 -top-2">
                    <span className="flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-20"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500/40"></span>
                    </span>
                  </div>
                </div>
                <h4 className="text-xl font-light italic tracking-tight text-white/30 uppercase">No defect registry matches</h4>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/10">Try adjusting categorical or confidence filters</p>
              </div>
            )}
          </div>
        </section>
    </OpsPageLayout>
  );
}
