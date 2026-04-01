"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listV1Batches, listV1Detections } from "@/lib/predict-client";
import type { BatchV1, DetectionRecordV1 } from "@/lib/types";

export function OpsSearchShell() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchV1[]>([]);
  const [detections, setDetections] = useState<DetectionRecordV1[]>([]);

  const [batchId, setBatchId] = useState("");
  const [category, setCategory] = useState("");
  const [minConfidence, setMinConfidence] = useState("0.8");
  const [sortBy, setSortBy] = useState<"created_at" | "confidence" | "area_mm2">("created_at");
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
  }, []);

  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-xl lg:text-2xl font-semibold text-white">病害检索</h1>
        <p className="mt-1 text-sm text-white/60">按批次、病害类别、置信度进行跨批次检索并跳转图片详情。</p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 text-xs">
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
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="category"
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          />
          <input
            value={minConfidence}
            onChange={(e) => setMinConfidence(e.target.value)}
            placeholder="min_confidence"
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "created_at" | "confidence" | "area_mm2")}
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          >
            <option value="created_at">created_at</option>
            <option value="confidence">confidence</option>
            <option value="area_mm2">area_mm2</option>
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
              void runSearch();
            }}
            disabled={loading}
            className="rounded border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40"
          >
            执行检索
          </button>
          <span className="text-xs text-white/50">结果数: {detections.length}</span>
        </div>
      </section>

      {error && <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="max-h-[60vh] overflow-auto space-y-2">
          {detections.map((det) => (
            <div key={det.id} className="rounded border border-white/10 bg-black/20 p-3 text-xs text-white/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {det.category} | conf={det.confidence.toFixed(3)} | area={det.area_mm2 ?? "-"} | valid=
                  {String(det.is_valid)}
                </div>
                <Link
                  href={`/dashboard/ops/items/${encodeURIComponent(det.batch_item_id)}`}
                  className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/80 hover:bg-white/[0.05]"
                >
                  查看图片详情
                </Link>
              </div>
            </div>
          ))}
          {!loading && detections.length === 0 && <div className="text-xs text-white/50">暂无检索结果</div>}
          {loading && <div className="text-xs text-white/50">检索中...</div>}
        </div>
      </section>
    </div>
  );
}
