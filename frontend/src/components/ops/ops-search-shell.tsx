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
        const resp = await listV1Batches(200, 0);
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
            <>
              CROSS-BATCH RETRIEVAL /{" "}
              <span className="font-mono text-cyan-200/40">{detections.length} RESULTS</span>
            </>
          }
          actions={
            <button
              type="button"
              onClick={() => {
                void runSearch();
              }}
              disabled={loading}
              className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-100 transition-all hover:bg-cyan-500/20 disabled:opacity-30 active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.1)]"
            >
              {loading ? "SEARCHING..." : "INVOKE SEARCH"}
            </button>
          }
        />
      }
    >
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
           <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 m-0">检索配置 / RETRIEVAL CONFIG</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">TARGET BATCH</label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/10"
              >
                <option value="">全部批次</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">CATEGORY</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="category"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">MIN CONFIDENCE</label>
              <input
                value={minConfidence}
                onChange={(e) => setMinConfidence(e.target.value)}
                placeholder="0.80"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">ORDER BY</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "created_at" | "confidence" | "area_mm2")}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all"
              >
                <option value="created_at">created_at</option>
                <option value="confidence">confidence</option>
                <option value="area_mm2">area_mm2</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">SEQUENCE</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all"
              >
                <option value="desc">desc</option>
                <option value="asc">asc</option>
              </select>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 m-0">识别产出 / DETECTION RECOGNITION</h3>
          </div>
          
          <div className="space-y-4 max-h-[800px] overflow-auto scroll-smooth pr-2 custom-scrollbar">
            {detections.map((det) => (
              <div 
                key={det.id} 
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.01] p-4 lg:px-6 lg:py-5 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-black italic shadow-inner">
                      {(det.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-white uppercase tracking-tight group-hover:text-cyan-200 transition-colors">
                        {det.category}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/30 font-mono">
                         ID: {det.id.slice(0, 8)}... | 
                         AREA: <span className="text-white/50">{det.area_mm2 ? `${det.area_mm2} mm²` : "N/A"}</span> |
                         VALID: <span className={det.is_valid ? "text-emerald-400/60" : "text-rose-400/60"}>{String(det.is_valid)}</span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/ops/items/${encodeURIComponent(det.batch_item_id)}?returnTo=${encodeURIComponent(currentHref)}`}
                    className="rounded-lg border border-white/10 bg-white/5 py-2 px-5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                  >
                    VIEW ITEM DETAIL
                  </Link>
                </div>
              </div>
            ))}
            {!loading && detections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="rounded-full bg-white/5 p-5 mb-4 border border-white/10">
                   <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h4 className="text-xl font-light text-white/30 italic">No matches found in visual registry</h4>
                <p className="text-xs text-white/10 mt-1 uppercase tracking-[0.2em]">Try adjusting confidence thresholds</p>
              </div>
            )}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-cyan-500 border-r-2 border-transparent" />
                  <p className="text-[10px] uppercase tracking-widest text-white/20 animate-pulse">Running Neural Query...</p>
                </div>
              </div>
            )}
          </div>
        </section>
    </OpsPageLayout>
  );
}
