"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  getV1AlertRules,
  listV1AlertRulesAudit,
  updateV1AlertRules
} from "@/lib/predict-client";
import type { AlertRulesConfigV1Response, OpsAuditLogV1 } from "@/lib/types";

export function OpsSettingsShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"config" | "audit">(
    (searchParams.get("tab") as "config" | "audit") ?? "config",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Config
  const [config, setConfig] = useState<AlertRulesConfigV1Response | null>(null);
  // Audit list
  const [auditLogs, setAuditLogs] = useState<OpsAuditLogV1[]>([]);
  // Local Audit state
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(searchParams.get("auditId"));
  const [auditDetail, setAuditDetail] = useState<OpsAuditLogV1 | null>(null);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await getV1AlertRules();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取配置失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLogs() {
    setLoading(true);
    try {
      const resp = await listV1AlertRulesAudit({ limit: 50, offset: 0 });
      setAuditLogs(resp.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取审计日志失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "config") {
      void loadConfig();
    } else {
      void loadAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!selectedAuditId) {
      setAuditDetail(null);
      return;
    }
    const matched = auditLogs.find((log) => log.id === selectedAuditId) ?? null;
    setAuditDetail(matched);
  }, [auditLogs, selectedAuditId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== "config") params.set("tab", activeTab);
    if (selectedAuditId) params.set("auditId", selectedAuditId);
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [activeTab, pathname, router, selectedAuditId]);

  async function handleSaveConfig() {
    if (!config) return;
    setLoading(true);
    setNotice(null);
    try {
      await updateV1AlertRules({
        updatedBy: "ops-admin",
        profileName: config.profile_name,
        alertAutoEnabled: config.alert_auto_enabled,
        countThreshold: config.count_threshold,
        categoryWatchlist: config.category_watchlist,
        categoryConfidenceThreshold: config.category_confidence_threshold,
        repeatEscalationHits: config.repeat_escalation_hits,
        slaHoursByLevel: config.sla_hours_by_level,
        nearDueHours: config.near_due_hours
      });
      setNotice("全局巡检配置已持久化");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新配置失败");
    } finally {
      setLoading(false);
    }
  }

  function handleViewAudit(log: OpsAuditLogV1) {
    setSelectedAuditId(log.id);
    setAuditDetail(log);
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden bg-black/40 backdrop-blur-3xl">
      <div className="relative flex-1 overflow-y-auto p-6 lg:p-10 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-6 border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400/60 m-0">SETTINGS</p>
            </div>
            <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-white uppercase">全局配置与审计</h1>
            <p className="text-xs text-white/30 mt-1.5 uppercase tracking-[0.2em]">
              SYSTEM PREFERENCES / <span className="font-mono text-cyan-200/40">RUNTIME ENVIRONMENT</span>
            </p>
          </div>

          <div className="flex rounded-2xl bg-white/[0.03] p-1 border border-white/5 shadow-2xl">
            <button
              onClick={() => {
                setActiveTab("config");
                setSelectedAuditId(null);
                setAuditDetail(null);
              }}
              className={`rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition-all ${
                activeTab === "config" 
                ? "bg-white/10 text-white shadow-xl" 
                : "text-white/30 hover:text-white/60"
              }`}
            >
              配置管理 / CONFIG
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition-all ${
                activeTab === "audit" 
                ? "bg-white/10 text-white shadow-xl" 
                : "text-white/30 hover:text-white/60"
              }`}
            >
              操作审计 / AUDIT
            </button>
          </div>
        </header>

        {notice && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[rgba(16,185,129,0.15)] px-8 py-5 text-emerald-100 backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-6 shadow-[0_30px_70px_rgba(0,0,0,0.6)]">
             <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-black font-black text-xs">✓</div>
             <span className="text-sm font-bold uppercase tracking-tight">{notice}</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.1)]">
            {error}
          </div>
        )}

        {activeTab === "config" && config && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 space-y-8 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2">告警触发逻辑 / ALERT GENERATION</h3>
                <h2 className="text-xl font-bold text-white tracking-tight">告警规则管理</h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between group">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white group-hover:text-cyan-400/80 transition-colors">自动开启告警</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-mono">ALERT_AUTO_ENABLED</p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, alert_auto_enabled: !config.alert_auto_enabled })}
                    className={`h-6 w-12 rounded-full border transition-all relative ${
                      config.alert_auto_enabled ? "border-cyan-500 bg-cyan-500/10" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className={`absolute top-1 h-3.5 w-3.5 rounded-full transition-all ${
                      config.alert_auto_enabled ? "left-7 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "left-1 bg-white/20"
                    }`} />
                  </button>
                </div>

                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">CONFIDENCE THRESHOLD (SCORE)</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={config.category_confidence_threshold}
                        onChange={(e) => setConfig({ ...config, category_confidence_threshold: Number(e.target.value) })}
                        className="flex-1 accent-cyan-500 opacity-50 hover:opacity-100 transition-opacity"
                      />
                      <span className="font-mono text-base font-black text-cyan-400">{config.category_confidence_threshold.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 border-b border-white/5 pb-2">监控类别列表 / WATCHLIST</p>
                  <div className="flex flex-wrap gap-2">
                    {config.category_watchlist.map((cat, idx) => (
                      <div key={`${cat}-${idx}`} className="group relative">
                        <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/60 tracking-tight group-hover:bg-white/10 transition-all uppercase">
                          {cat}
                        </span>
                        <button
                          onClick={() => {
                            const updated = config.category_watchlist.filter((_, i) => i !== idx);
                            setConfig({ ...config, category_watchlist: updated });
                          }}
                          className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-rose-500/80 text-[10px] font-black items-center justify-center hidden group-hover:flex"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const next = prompt("Enter category name");
                        if (next) {
                          setConfig({ ...config, category_watchlist: [...config.category_watchlist, next] });
                        }
                      }}
                      className="rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-[11px] font-bold text-white/20 hover:border-cyan-500/50 hover:text-cyan-400/50 transition-all uppercase"
                    >
                      + ADD CATEGORY
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div className="space-y-8">
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 space-y-8 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2">时效性管理 / SERVICE LEVEL AGREEMENT</h3>
                  <h2 className="text-xl font-bold text-white tracking-tight">SLA 配置中心</h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">NEAR DUE BUFFER (HOURS)</label>
                    <input
                      type="number"
                      value={config.near_due_hours}
                      onChange={(e) => setConfig({ ...config, near_due_hours: Number(e.target.value) })}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-amber-400 focus:border-amber-500/50 outline-none transition-shadow"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/20">COUNT THRESHOLD</label>
                    <input
                      type="number"
                      value={config.count_threshold}
                      onChange={(e) => setConfig({ ...config, count_threshold: Number(e.target.value) })}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-rose-400 focus:border-rose-500/50 outline-none transition-shadow"
                    />
                  </div>
                </div>
              </section>

              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="w-full rounded-2xl border border-cyan-500/30 bg-cyan-500/10 py-5 text-sm font-black text-cyan-200 shadow-[0_15px_30px_rgba(6,182,212,0.1)] transition-all hover:bg-cyan-500/20 active:scale-[0.98] disabled:opacity-30 uppercase tracking-[0.3em]"
              >
                {loading ? "COMMITTING CHANGES..." : "SYNC GLOBAL PREFERENCES"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <section className="xl:col-span-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:p-8 space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 m-0">规则变更审计 / RULE AUDIT STREAM</h3>
              <div className="space-y-3 max-h-[800px] overflow-auto pr-2 custom-scrollbar">
                {auditLogs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => handleViewAudit(log)}
                    className={`w-full rounded-xl border p-4 text-left transition-all group ${
                      selectedAuditId === log.id 
                      ? "border-cyan-500/40 bg-cyan-500/10" 
                      : "border-white/5 bg-white/[0.01] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                         {log.audit_type}
                       </span>
                       <span className="text-[9px] font-mono text-white/20">{new Date(log.created_at).toLocaleTimeString("zh-CN", { hour12: false })}</span>
                    </div>
                    <p className="text-xs font-bold text-white group-hover:text-cyan-50 transition-colors uppercase tracking-tight mb-1">
                      {log.target_key || "GLOBAL_RULE_UPDATE"}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
                      <span>ACTOR:</span>
                      <span className="text-white/60">{log.actor}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="xl:col-span-8 rounded-2xl border border-white/10 bg-white/[0.02] p-8 space-y-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative min-h-[600px]">
              {auditDetail ? (
                <div className="space-y-8 animate-in fade-in transition-all">
                  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/5 pb-6">
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400 mb-2">变更细节 / CHANGE DETAILS</h3>
                      <h2 className="text-xl lg:text-3xl font-black text-white uppercase tracking-tight">{auditDetail.audit_type}</h2>
                      <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">AUDIT_UUID: {auditDetail.id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="p-5 rounded-xl border border-white/5 bg-black/40 space-y-4">
                      <h4 className="text-[10px] font-black text-white/20 uppercase tracking-widest border-b border-white/5 pb-2">变更前 / PREVIOUS</h4>
                      <pre className="font-mono text-xs text-rose-200/40 line-clamp-10 whitespace-pre-wrap overflow-auto max-h-[300px]">
                        {JSON.stringify(auditDetail.before_payload, null, 2)}
                      </pre>
                    </div>
                    <div className="p-5 rounded-xl border border-white/5 bg-black/40 space-y-4">
                      <h4 className="text-[10px] font-black text-white/20 uppercase tracking-widest border-b border-white/5 pb-2">变更后 / CURRENT</h4>
                      <pre className="font-mono text-xs text-emerald-200/40 line-clamp-10 whitespace-pre-wrap overflow-auto max-h-[300px]">
                        {JSON.stringify(auditDetail.after_payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01]">
                    <h4 className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-4">执行上下文 / CONTEXT</h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                       <div className="space-y-1">
                         <p className="text-[10px] font-bold text-white/10 uppercase tracking-tighter">ACTOR</p>
                         <p className="text-sm font-black text-white/60 font-mono tracking-tight">{auditDetail.actor}</p>
                       </div>
                       <div className="space-y-1">
                         <p className="text-[10px] font-bold text-white/10 uppercase tracking-tighter">TIMESTAMP</p>
                         <p className="text-sm font-black text-white/60 font-mono tracking-tight">{new Date(auditDetail.created_at).toLocaleString()}</p>
                       </div>
                       <div className="space-y-1">
                         <p className="text-[10px] font-bold text-white/10 uppercase tracking-tighter">NOTE</p>
                         <p className="text-sm font-black text-white/60 italic tracking-tight">{auditDetail.note || "N/A"}</p>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                   <div className="h-16 w-16 mb-6 rounded-full border-2 border-white/10 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white/20 animate-ping" />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white">SELECT_ARCHIVE_LOG</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
