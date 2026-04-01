"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createV1Review,
  getV1BatchItemDetail,
  getV1BatchItemResult,
  listV1Alerts,
  listV1Reviews,
  updateV1AlertStatus
} from "@/lib/predict-client";
import type { AlertV1, BatchItemDetailV1Response, BatchItemResultV1Response, ReviewRecordV1 } from "@/lib/types";

export function OpsItemDetailShell({ batchItemId }: { batchItemId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [detail, setDetail] = useState<BatchItemDetailV1Response | null>(null);
  const [result, setResult] = useState<BatchItemResultV1Response | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewRecordV1[]>([]);
  const [alerts, setAlerts] = useState<AlertV1[]>([]);

  const [detectionId, setDetectionId] = useState("");
  const [reviewAction, setReviewAction] = useState<"confirm" | "reject" | "edit">("confirm");
  const [reviewer, setReviewer] = useState("manual-reviewer");
  const [reviewNote, setReviewNote] = useState("");

  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [alertAction, setAlertAction] = useState<"acknowledge" | "resolve">("acknowledge");
  const [alertOperator, setAlertOperator] = useState("manual-reviewer");
  const [alertNote, setAlertNote] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const detailResp = await getV1BatchItemDetail(batchItemId);
      const resultResp = await getV1BatchItemResult(batchItemId);
      const [alertsResp, reviewsResp] = await Promise.all([
        listV1Alerts({ batchId: detailResp.batch_id, limit: 200, offset: 0 }),
        listV1Reviews({
          batchItemId,
          sortBy: "reviewed_at",
          sortOrder: "desc",
          limit: 200,
          offset: 0
        })
      ]);
      const linkedAlerts = alertsResp.items.filter((item) => item.batch_item_id === batchItemId);

      setDetail(detailResp);
      setResult(resultResp);
      setReviewHistory(reviewsResp.items);
      setAlerts(linkedAlerts);

      if (resultResp.detections.length > 0) {
        setDetectionId((prev) => prev || resultResp.detections[0].id);
      }
      if (linkedAlerts.length > 0) {
        setSelectedAlertId((prev) => prev || linkedAlerts[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchItemId]);

  const selectedAlert = useMemo(
    () => alerts.find((item) => item.id === selectedAlertId) ?? null,
    [alerts, selectedAlertId]
  );

  async function submitReview() {
    setNotice(null);
    setError(null);
    try {
      await createV1Review({
        detectionId,
        reviewAction,
        reviewer,
        reviewNote,
        afterPayload: reviewAction === "edit" ? { manual_note: reviewNote } : {}
      });
      setNotice("复核已提交");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "复核提交失败");
    }
  }

  async function submitAlertUpdate() {
    if (!selectedAlertId) {
      return;
    }
    setNotice(null);
    setError(null);
    try {
      await updateV1AlertStatus({
        alertId: selectedAlertId,
        action: alertAction,
        operator: alertOperator,
        note: alertNote
      });
      setNotice("告警状态已更新");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "告警状态更新失败");
    }
  }

  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-white">图片详情与人工复核</h1>
          <p className="text-sm text-white/60 mt-1">batch_item_id={batchItemId}</p>
        </div>
        <Link
          href="/dashboard/ops"
          className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
        >
          返回工作台
        </Link>
      </header>

      {error && <div className="rounded border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
      {notice && <div className="rounded border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</div>}

      {loading ? (
        <div className="text-sm text-white/60">加载中...</div>
      ) : (
        <>
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-2">基础信息</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-xs text-white/80">
              <div>batch={detail?.batch_id}</div>
              <div>sequence={detail?.sequence_no}</div>
              <div>processing={detail?.processing_status}</div>
              <div>review={detail?.review_status}</div>
              <div>alert={detail?.alert_status}</div>
              <div>file={detail?.media_asset.original_filename}</div>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-2">识别结果</h3>
            <p className="text-xs text-white/60 mb-3">
              model={result?.model_name}:{result?.model_version} | detections={result?.detection_count ?? 0} | inference_ms={result?.inference_ms ?? 0}
            </p>
            <div className="max-h-72 overflow-auto space-y-2">
              {result?.detections.map((item) => (
                <label key={item.id} className="flex items-center justify-between rounded border border-white/10 bg-black/20 p-2 text-xs text-white/80">
                  <span>
                    {item.category} | conf={item.confidence.toFixed(3)} | valid={String(item.is_valid)}
                  </span>
                  <input
                    type="radio"
                    name="detectionId"
                    checked={detectionId === item.id}
                    onChange={() => setDetectionId(item.id)}
                  />
                </label>
              ))}
              {(result?.detections.length ?? 0) === 0 && <div className="text-xs text-white/50">暂无病害记录</div>}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-2">复核历史时间线</h3>
            <div className="max-h-56 overflow-auto space-y-2">
              {reviewHistory.map((item) => (
                <div key={item.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs text-white/80">
                  <div>
                    {item.review_action} {"->"} {item.review_decision} | detection={item.detection_id}
                  </div>
                  <div className="text-white/60 mt-1">
                    reviewer={item.reviewer} | reviewed_at={new Date(item.reviewed_at).toLocaleString()}
                  </div>
                  {item.review_note ? <div className="text-white/50 mt-1">note: {item.review_note}</div> : null}
                </div>
              ))}
              {reviewHistory.length === 0 ? <div className="text-xs text-white/50">暂无复核历史</div> : null}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/90">提交复核</h3>
              <select
                value={reviewAction}
                onChange={(e) => setReviewAction(e.target.value as "confirm" | "reject" | "edit")}
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              >
                <option value="confirm">confirm</option>
                <option value="reject">reject</option>
                <option value="edit">edit</option>
              </select>
              <input
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder="reviewer"
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="review_note"
                className="w-full h-20 rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
              <button
                disabled={!detectionId}
                onClick={submitReview}
                className="rounded border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-200 disabled:opacity-50"
              >
                提交复核
              </button>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white/90">更新告警状态</h3>
              <select
                value={selectedAlertId}
                onChange={(e) => setSelectedAlertId(e.target.value)}
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              >
                <option value="">选择告警</option>
                {alerts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.status})
                  </option>
                ))}
              </select>
              <select
                value={alertAction}
                onChange={(e) => setAlertAction(e.target.value as "acknowledge" | "resolve")}
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              >
                <option value="acknowledge">acknowledge</option>
                <option value="resolve">resolve</option>
              </select>
              <input
                value={alertOperator}
                onChange={(e) => setAlertOperator(e.target.value)}
                placeholder="operator"
                className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
              <textarea
                value={alertNote}
                onChange={(e) => setAlertNote(e.target.value)}
                placeholder="note"
                className="w-full h-20 rounded border border-white/15 bg-black/30 px-2 py-2 text-xs text-white"
              />
              <button
                disabled={!selectedAlertId}
                onClick={submitAlertUpdate}
                className="rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-200 disabled:opacity-50"
              >
                更新告警
              </button>
              {selectedAlert && (
                <p className="text-xs text-white/60">
                  当前: {selectedAlert.event_type} | {selectedAlert.alert_level} | {selectedAlert.status}
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
