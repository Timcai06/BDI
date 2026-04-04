"use client";

import { useCallback, useEffect, useState } from "react";

import { getV1AlertRules, listV1AlertRulesAudit, updateV1AlertRules } from "@/lib/predict-client";
import type { OpsAuditLogV1 } from "@/lib/types";

export function OpsSettingsShell() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<OpsAuditLogV1[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLimit, setAuditLimit] = useState(10);
  const [auditOffset, setAuditOffset] = useState(0);
  const [selectedAuditLog, setSelectedAuditLog] = useState<OpsAuditLogV1 | null>(null);
  const [auditActor, setAuditActor] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  const [updatedBy, setUpdatedBy] = useState("ops-admin");
  const [profileName, setProfileName] = useState("JTG-v1");
  const [alertAutoEnabled, setAlertAutoEnabled] = useState(true);
  const [countThreshold, setCountThreshold] = useState(3);
  const [repeatEscalationHits, setRepeatEscalationHits] = useState(2);
  const [categoryWatchlist, setCategoryWatchlist] = useState("seepage");
  const [categoryConfidenceThreshold, setCategoryConfidenceThreshold] = useState(0.8);
  const [nearDueHours, setNearDueHours] = useState(2);
  const [slaLowHours, setSlaLowHours] = useState(72);
  const [slaMediumHours, setSlaMediumHours] = useState(48);
  const [slaHighHours, setSlaHighHours] = useState(24);
  const [slaCriticalHours, setSlaCriticalHours] = useState(12);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getV1AlertRules();
      setProfileName(response.profile_name);
      setAlertAutoEnabled(response.alert_auto_enabled);
      setCountThreshold(response.count_threshold);
      setRepeatEscalationHits(response.repeat_escalation_hits);
      setCategoryWatchlist(response.category_watchlist.join(","));
      setCategoryConfidenceThreshold(response.category_confidence_threshold);
      setNearDueHours(response.near_due_hours);
      setSlaLowHours(response.sla_hours_by_level.low ?? 72);
      setSlaMediumHours(response.sla_hours_by_level.medium ?? 48);
      setSlaHighHours(response.sla_hours_by_level.high ?? 24);
      setSlaCriticalHours(response.sla_hours_by_level.critical ?? 12);
      const auditResp = await listV1AlertRulesAudit({
        limit: auditLimit,
        offset: auditOffset,
        actor: auditActor || undefined,
        dateFrom: auditDateFrom ? new Date(`${auditDateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: auditDateTo ? new Date(`${auditDateTo}T23:59:59`).toISOString() : undefined
      });
      setAuditLogs(auditResp.items);
      setAuditTotal(auditResp.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "告警规则加载失败");
    } finally {
      setLoading(false);
    }
  }, [auditActor, auditDateFrom, auditDateTo, auditLimit, auditOffset]);

  async function exportAuditLogs(format: "json" | "csv", mode: "current_page" | "all_filtered") {
    const logs = mode === "all_filtered" ? await fetchAllFilteredAuditLogs() : auditLogs;
    if (logs.length === 0) {
      setNotice("暂无可导出的审计日志");
      return;
    }
    if (format === "json") {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json;charset=utf-8" });
      downloadBlob(blob, `alert-rules-audit-${mode}-${Date.now()}.json`);
      return;
    }
    const lines = [
      "id,audit_type,actor,target_key,note,created_at,diff_keys",
      ...logs.map((item) => {
        const diffKeys = Object.keys(item.diff_payload).join("|");
        return [
          safeCsv(item.id),
          safeCsv(item.audit_type),
          safeCsv(item.actor),
          safeCsv(item.target_key ?? ""),
          safeCsv(item.note ?? ""),
          safeCsv(item.created_at),
          safeCsv(diffKeys)
        ].join(",");
      })
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `alert-rules-audit-${mode}-${Date.now()}.csv`);
  }

  async function fetchAllFilteredAuditLogs(): Promise<OpsAuditLogV1[]> {
    setExporting(true);
    setError(null);
    setNotice(null);
    setExportProgressText("准备拉取...");
    try {
      const pageSize = 200;
      const first = await listV1AlertRulesAudit({
        limit: pageSize,
        offset: 0,
        actor: auditActor || undefined,
        dateFrom: auditDateFrom ? new Date(`${auditDateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: auditDateTo ? new Date(`${auditDateTo}T23:59:59`).toISOString() : undefined
      });
      let allItems = [...first.items];
      let nextOffset = first.items.length;
      const total = first.total;
      setExportProgressText(`已拉取 ${allItems.length} / ${total}`);
      while (nextOffset < total) {
        const page = await listV1AlertRulesAudit({
          limit: pageSize,
          offset: nextOffset,
          actor: auditActor || undefined,
          dateFrom: auditDateFrom ? new Date(`${auditDateFrom}T00:00:00`).toISOString() : undefined,
          dateTo: auditDateTo ? new Date(`${auditDateTo}T23:59:59`).toISOString() : undefined
        });
        allItems = allItems.concat(page.items);
        nextOffset += page.items.length;
        setExportProgressText(`已拉取 ${allItems.length} / ${total}`);
        if (page.items.length === 0) {
          break;
        }
      }
      setNotice(`已聚合 ${allItems.length} 条审计日志用于导出`);
      return allItems;
    } catch (err) {
      setError(err instanceof Error ? err.message : "审计日志聚合导出失败");
      return [];
    } finally {
      setExporting(false);
      setExportProgressText(null);
    }
  }

  function changeAuditPage(direction: "prev" | "next") {
    if (direction === "prev") {
      setAuditOffset((prev) => Math.max(0, prev - auditLimit));
      return;
    }
    setAuditOffset((prev) => {
      const next = prev + auditLimit;
      return next >= auditTotal ? prev : next;
    });
  }

  const currentPage = Math.floor(auditOffset / auditLimit) + 1;
  const totalPages = Math.max(1, Math.ceil(auditTotal / auditLimit));

  function safeCsv(value: string): string {
    const escaped = value.replace(/"/g, "\"\"");
    return `"${escaped}"`;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await updateV1AlertRules({
        updatedBy,
        profileName,
        alertAutoEnabled,
        countThreshold,
        repeatEscalationHits,
        categoryWatchlist: categoryWatchlist
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        categoryConfidenceThreshold,
        nearDueHours,
        slaHoursByLevel: {
          low: slaLowHours,
          medium: slaMediumHours,
          high: slaHighHours,
          critical: slaCriticalHours
        }
      });
      setNotice(`告警规则已更新（${response.profile_name}）`);
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "告警规则更新失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-xl lg:text-2xl font-semibold text-white">系统设置</h1>
        <p className="mt-1 text-sm text-white/60">管理 critical finding 模板与告警升级策略（JTG 默认模板）。</p>
      </header>

      {error && <div className="rounded border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
      {notice && (
        <div className="rounded border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</div>
      )}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 text-xs">
        {loading ? (
          <div className="text-white/60">规则加载中...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              <input
                value={updatedBy}
                onChange={(e) => setUpdatedBy(e.target.value)}
                placeholder="updated_by"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="profile_name"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <label className="flex items-center gap-2 rounded border border-white/15 bg-black/30 px-2 py-2 text-white">
                <input type="checkbox" checked={alertAutoEnabled} onChange={(e) => setAlertAutoEnabled(e.target.checked)} />
                自动告警启用
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
              <input
                type="number"
                min={1}
                value={countThreshold}
                onChange={(e) => setCountThreshold(Number(e.target.value))}
                placeholder="count_threshold"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <input
                type="number"
                min={2}
                value={repeatEscalationHits}
                onChange={(e) => setRepeatEscalationHits(Number(e.target.value))}
                placeholder="repeat_escalation_hits"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={categoryConfidenceThreshold}
                onChange={(e) => setCategoryConfidenceThreshold(Number(e.target.value))}
                placeholder="category_confidence_threshold"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <input
                type="number"
                min={1}
                value={nearDueHours}
                onChange={(e) => setNearDueHours(Number(e.target.value))}
                placeholder="near_due_hours"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
            </div>

            <input
              value={categoryWatchlist}
              onChange={(e) => setCategoryWatchlist(e.target.value)}
              placeholder="category_watchlist (comma separated)"
              className="w-full rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                type="number"
                min={1}
                value={slaLowHours}
                onChange={(e) => setSlaLowHours(Number(e.target.value))}
                placeholder="sla low hours"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <input
                type="number"
                min={1}
                value={slaMediumHours}
                onChange={(e) => setSlaMediumHours(Number(e.target.value))}
                placeholder="sla medium hours"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <input
                type="number"
                min={1}
                value={slaHighHours}
                onChange={(e) => setSlaHighHours(Number(e.target.value))}
                placeholder="sla high hours"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
              <input
                type="number"
                min={1}
                value={slaCriticalHours}
                onChange={(e) => setSlaCriticalHours(Number(e.target.value))}
                placeholder="sla critical hours"
                className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-cyan-200 disabled:opacity-40"
              >
                {saving ? "保存中..." : "保存规则模板"}
              </button>
              <button
                onClick={() => void loadRules()}
                disabled={saving}
                className="rounded border border-white/20 px-4 py-2 text-white/80 hover:bg-white/10 disabled:opacity-40"
              >
                重新加载
              </button>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2 text-xs">
        <h2 className="text-sm font-semibold text-white/90">规则更新审计日志</h2>
        <p className="text-white/55">记录规则模板变更前后差异（最近 10 条）。</p>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
          <input
            value={auditActor}
            onChange={(e) => setAuditActor(e.target.value)}
            placeholder="actor"
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          />
          <input
            type="date"
            value={auditDateFrom}
            onChange={(e) => setAuditDateFrom(e.target.value)}
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          />
          <input
            type="date"
            value={auditDateTo}
            onChange={(e) => setAuditDateTo(e.target.value)}
            className="rounded border border-white/15 bg-black/30 px-2 py-2 text-white"
          />
          <button
            onClick={() => {
              setAuditOffset(0);
              void loadRules();
            }}
            className="rounded border border-white/20 px-3 py-2 text-white/80 hover:bg-white/10"
          >
            按筛选刷新
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-white/70">
            每页条数
            <select
              value={auditLimit}
              onChange={(e) => {
                setAuditLimit(Number(e.target.value));
                setAuditOffset(0);
              }}
              className="rounded border border-white/15 bg-black/30 px-2 py-1 text-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <div className="flex items-center gap-2 text-white/60">
            总计 {auditTotal} 条 | 第 {currentPage}/{totalPages} 页
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void exportAuditLogs("json", "current_page")}
            className="rounded border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-cyan-200"
            disabled={exporting}
          >
            导出当前页 JSON
          </button>
          <button
            onClick={() => void exportAuditLogs("csv", "current_page")}
            className="rounded border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-emerald-200"
            disabled={exporting}
          >
            导出当前页 CSV
          </button>
          <button
            onClick={() => void exportAuditLogs("json", "all_filtered")}
            className="rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-amber-200 disabled:opacity-40"
            disabled={exporting}
          >
            {exporting ? "导出聚合中..." : "导出全部筛选 JSON"}
          </button>
          <button
            onClick={() => void exportAuditLogs("csv", "all_filtered")}
            className="rounded border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-2 text-fuchsia-200 disabled:opacity-40"
            disabled={exporting}
          >
            {exporting ? "导出聚合中..." : "导出全部筛选 CSV"}
          </button>
          {exportProgressText ? <span className="text-white/60">{exportProgressText}</span> : null}
          <button
            onClick={() => changeAuditPage("prev")}
            disabled={auditOffset === 0}
            className="rounded border border-white/20 px-3 py-2 text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            上一页
          </button>
          <button
            onClick={() => changeAuditPage("next")}
            disabled={auditOffset + auditLimit >= auditTotal}
            className="rounded border border-white/20 px-3 py-2 text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            下一页
          </button>
          <span className="text-white/50">当前页 {auditLogs.length} 条</span>
        </div>
        <div className="space-y-2 max-h-[260px] overflow-auto">
          {auditLogs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedAuditLog(item)}
              className="w-full text-left rounded border border-white/10 bg-black/20 p-3 text-white/80 hover:bg-white/[0.04]"
            >
              <div>
                actor={item.actor} | {new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}
              </div>
              <div className="text-white/60 mt-1">{item.note ?? item.audit_type}</div>
              <div className="text-white/60 mt-1">diff_keys={Object.keys(item.diff_payload).join(",") || "none"}</div>
            </button>
          ))}
          {auditLogs.length === 0 ? <div className="text-white/50">暂无审计记录</div> : null}
        </div>
      </section>

      {selectedAuditLog ? (
        <section className="rounded-xl border border-cyan-300/25 bg-cyan-400/5 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-cyan-100">审计详情</h2>
            <button
              type="button"
              onClick={() => setSelectedAuditLog(null)}
              className="rounded border border-white/20 px-2 py-1 text-white/80 hover:bg-white/10"
            >
              关闭
            </button>
          </div>
          <div className="text-white/70">
            actor={selectedAuditLog.actor} | {new Date(selectedAuditLog.created_at).toLocaleString("zh-CN", { hour12: false })}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <article className="rounded border border-white/10 bg-black/20 p-3">
              <h3 className="text-white/90 mb-2">before</h3>
              <pre className="overflow-auto max-h-[220px] text-[11px] text-white/70">{JSON.stringify(selectedAuditLog.before_payload, null, 2)}</pre>
            </article>
            <article className="rounded border border-white/10 bg-black/20 p-3">
              <h3 className="text-white/90 mb-2">after</h3>
              <pre className="overflow-auto max-h-[220px] text-[11px] text-white/70">{JSON.stringify(selectedAuditLog.after_payload, null, 2)}</pre>
            </article>
            <article className="rounded border border-white/10 bg-black/20 p-3">
              <h3 className="text-white/90 mb-2">diff</h3>
              <pre className="overflow-auto max-h-[220px] text-[11px] text-white/70">{JSON.stringify(selectedAuditLog.diff_payload, null, 2)}</pre>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}
