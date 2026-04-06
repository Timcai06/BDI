"use client";

import { motion } from "framer-motion";

import { BatchStatusBar } from "./batch-status-bar";
import type { BatchStatsV1Response, BatchV1, BridgeV1 } from "@/lib/types";

interface OpsWorkbenchSummaryPanelProps {
  batchItemTotal: number;
  createdBy: string;
  detectionsLength: number;
  minConfidence: string;
  modelPolicy: string;
  onMinConfidenceChange: (value: string) => void;
  selectedBatch: BatchV1 | null;
  selectedBridge: BridgeV1 | null;
  selectedItemIdsCount: number;
  showFailedItemsOnly: boolean;
  sourceDevice: string;
  stats: BatchStatsV1Response | null;
  summaryExpanded: boolean;
  onToggleSummaryExpanded: () => void;
}

export function OpsWorkbenchSummaryPanel({
  batchItemTotal,
  createdBy,
  detectionsLength,
  minConfidence,
  modelPolicy,
  onMinConfidenceChange,
  selectedBatch,
  selectedBridge,
  selectedItemIdsCount,
  showFailedItemsOnly,
  sourceDevice,
  stats,
  summaryExpanded,
  onToggleSummaryExpanded,
}: OpsWorkbenchSummaryPanelProps) {
  return (
    <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
      <BatchStatusBar
        stats={stats}
        selectedBridge={selectedBridge}
        selectedBatch={selectedBatch}
        batchItemTotal={batchItemTotal}
        expanded={summaryExpanded}
        onToggleExpand={onToggleSummaryExpanded}
      />

      <motion.div
        initial={false}
        animate={{ height: summaryExpanded ? "auto" : 0 }}
        className="overflow-hidden"
      >
        <div className="grid gap-6 border-t border-white/5 bg-black/20 px-8 py-8 lg:grid-cols-3">
          <div className="relative rounded-[2rem] border border-white/5 bg-white/[0.03] p-6 shadow-inner transition-all hover:bg-white/[0.04]">
            <p className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">桥梁摘要</p>
            <div className="grid grid-cols-2 gap-y-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">活跃批次</p>
                <p className="mt-1 text-xl font-black text-white tabular-nums">
                  {selectedBridge?.active_batch_count ?? 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">异常批次</p>
                <p className="mt-1 text-xl font-black text-rose-500/80 tabular-nums">
                  {selectedBridge?.abnormal_batch_count ?? 0}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">智能增强策略</p>
                <div className="mt-2 flex items-center gap-3">
                  <div
                    className={`rounded-xl border px-3 py-1.5 text-xs font-black ${
                      selectedBatch?.enhancement_mode === "off"
                        ? "border-white/10 text-white/40"
                        : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                    }`}
                  >
                    {selectedBatch?.enhancement_mode === "always"
                      ? "全量增强"
                      : selectedBatch?.enhancement_mode === "off"
                        ? "关闭增强"
                        : "低照度自适应增强"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 shadow-inner transition-all hover:bg-white/[0.03]">
            <p className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">检索与过滤</p>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                  检测项总数
                </span>
                <span className="text-sm font-black text-white tabular-nums">{detectionsLength}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                  置信度过滤 (Confidence)
                </span>
                <div className="mt-3 flex gap-2">
                  {["0.0", "0.6", "0.8", "0.9"].map((value) => (
                    <button
                      key={value}
                      onClick={() => onMinConfidenceChange(value)}
                      className={`flex-1 rounded-xl border py-2 text-[10px] font-bold transition-all ${
                        minConfidence === value
                          ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                          : "border-white/5 bg-white/5 text-white/30 hover:border-white/10 hover:text-white"
                      }`}
                    >
                      {value === "0.0" ? "ALL" : `>${value}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 shadow-inner transition-all hover:bg-white/[0.03]">
            <p className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
              基础元数据 / 批次详情
            </p>
            <div className="space-y-3">
              {[
                { label: "已选对比素材", value: selectedItemIdsCount, color: "text-amber-400" },
                { label: "素材过滤状态", value: showFailedItemsOnly ? "仅失败项" : "全部素材", color: "text-white" },
                { label: "模型推理策略", value: modelPolicy, color: "text-white/60", truncate: true },
                { label: "数据采集终端", value: sourceDevice, color: "text-white/60" },
                { label: "当前操作员", value: createdBy, color: "text-white/60" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between text-[11px] font-medium leading-relaxed"
                >
                  <span className="text-white/20">{item.label}</span>
                  <span className={`${item.color} ${item.truncate ? "max-w-[120px] truncate pl-4" : ""}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
