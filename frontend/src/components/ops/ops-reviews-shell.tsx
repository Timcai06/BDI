"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listV1Batches, listV1Reviews } from "@/lib/predict-client";
import type { BatchV1, ReviewRecordV1 } from "@/lib/types";

export function OpsReviewsShell() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [reviews, setReviews] = useState<ReviewRecordV1[]>([]);

  const [batchId, setBatchId] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [sortBy, setSortBy] = useState<"reviewed_at" | "created_at">("reviewed_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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
  }, []);

  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-xl lg:text-2xl font-semibold text-white">复核中心</h1>
        <p className="mt-1 text-sm text-white/60">集中查看复核动作，追踪 reviewer、决策结果与关联图片。</p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 text-xs">
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          >
            <option value="">全部批次</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batch_code}
              </option>
            ))}
          </select>
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="reviewer"
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "reviewed_at" | "created_at")}
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          >
            <option value="reviewed_at">reviewed_at</option>
            <option value="created_at">created_at</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          >
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void runQuery();
            }}
            disabled={loading}
            className="rounded border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40"
          >
            刷新复核记录
          </button>
          <span className="text-xs text-white/50">记录数: {reviews.length}</span>
        </div>
      </section>

      {error && <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="max-h-[60vh] overflow-auto space-y-2">
          {reviews.map((review) => (
            <div key={review.id} className="rounded border border-white/10 bg-black/20 p-3 text-xs text-white/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {review.review_action} {"->"} {review.review_decision} | by={review.reviewer}
                </div>
                <Link
                  href={`/dashboard/ops/items/${encodeURIComponent(review.batch_item_id)}`}
                  className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/80 hover:bg-white/[0.05]"
                >
                  打开图片详情
                </Link>
              </div>
              {review.review_note && <p className="mt-2 text-white/55">note: {review.review_note}</p>}
            </div>
          ))}
          {!loading && reviews.length === 0 && <div className="text-xs text-white/50">暂无复核记录</div>}
          {loading && <div className="text-xs text-white/50">加载中...</div>}
        </div>
      </section>
    </div>
  );
}
