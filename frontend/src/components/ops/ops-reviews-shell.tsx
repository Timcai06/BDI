"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { listV1Batches, listV1Reviews } from "@/lib/predict-client";
import type { BatchV1, ReviewRecordV1 } from "@/lib/types";

export function OpsReviewsShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [reviews, setReviews] = useState<ReviewRecordV1[]>([]);

  const [batchId, setBatchId] = useState(searchParams.get("batchId") ?? "");
  const [reviewer, setReviewer] = useState(searchParams.get("reviewer") ?? "");
  const [sortBy, setSortBy] = useState<"reviewed_at" | "created_at">(
    (searchParams.get("sortBy") as "reviewed_at" | "created_at") ?? "reviewed_at",
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

  async function runQuery() {
    setLoading(true);
    setError(null);
    try {
      const resp = await listV1Reviews({
        batchId: batchId || undefined,
        reviewer: reviewer || undefined,
        sortBy,
        sortOrder,
        limit: 200,
        offset: 0
      });
      setReviews(resp.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "复核记录加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, reviewer, sortBy, sortOrder]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (batchId) params.set("batchId", batchId);
    if (reviewer) params.set("reviewer", reviewer);
    if (sortBy !== "reviewed_at") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [batchId, pathname, reviewer, router, sortBy, sortOrder]);

  const currentHref = (() => {
    const params = new URLSearchParams();
    if (batchId) params.set("batchId", batchId);
    if (reviewer) params.set("reviewer", reviewer);
    if (sortBy !== "reviewed_at") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    return params.toString() ? `${pathname}?${params.toString()}` : pathname;
  })();

  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden bg-black/40 backdrop-blur-3xl">
      <div className="relative flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400 m-0">REVIEWS</p>
            </div>
            <h1 className="text-xl lg:text-3xl font-black tracking-tight text-white uppercase">复核中心</h1>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">
              DECISION TRACKING / <span className="font-mono">{reviews.length} RECORDS FOUND</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void runQuery();
            }}
            disabled={loading}
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-200 transition-all hover:bg-cyan-500/20 disabled:opacity-30 active:scale-95"
          >
            {loading ? "SYNCING..." : "RELOAD RECORDS"}
          </button>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 m-0">查询参数 / QUERY PARAMETERS</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">BATCH</label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all"
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">REVIEWER ID</label>
              <input
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder="reviewer"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-white/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">SORT BY</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "reviewed_at" | "created_at")}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500/50 outline-none transition-all"
              >
                <option value="reviewed_at">reviewed_at</option>
                <option value="created_at">created_at</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">ORDER</label>
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
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 m-0">复核历史 / DECISION STREAM</h3>
          </div>
          
          <div className="space-y-4 max-h-[800px] overflow-auto scroll-smooth pr-2 custom-scrollbar">
            {reviews.map((review) => (
              <div 
                key={review.id} 
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.01] p-4 lg:p-5 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-xs font-black italic shadow-inner ${
                      review.review_decision === "confirm" 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}>
                      {review.review_decision === "confirm" ? "OK" : "NO"}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">ACTION: </span>
                        <span className="text-[10px] font-black uppercase text-white/60 tracking-tight">{review.review_action}</span>
                      </div>
                      <div className="text-sm font-medium text-white group-hover:text-cyan-100 transition-colors">
                        Review by <span className="font-mono text-cyan-400/80">{review.reviewer}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-white/30 font-mono">
                         ID: {review.id.slice(0, 8)}... | {new Date(review.reviewed_at).toLocaleString("zh-CN", { hour12: false })}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/ops/items/${encodeURIComponent(review.batch_item_id)}?returnTo=${encodeURIComponent(currentHref)}`}
                    className="rounded-lg border border-white/10 bg-white/5 py-2 px-4 text-[11px] font-bold uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                  >
                    VIEW IMAGE
                  </Link>
                </div>
                {review.review_note && (
                  <div className="mt-4 rounded-lg border border-white/5 bg-black/40 p-3 italic text-[11px] text-white/40 leading-relaxed">
                     &ldquo; {review.review_note} &rdquo;
                  </div>
                )}
              </div>
            ))}
            {!loading && reviews.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-full bg-white/5 p-4 mb-4 border border-white/10">
                  <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-light text-white/40">暂无复核记录</h4>
                <p className="text-xs text-white/20 mt-1 uppercase tracking-widest">Awaiting human review signals</p>
              </div>
            )}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-cyan-500 border-r-2 border-transparent" />
                  <p className="text-[10px] uppercase tracking-widest text-white/30 animate-pulse">Scanning Cloud History...</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
