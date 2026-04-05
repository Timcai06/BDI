"use client";

import { OpsPageHeader } from "@/components/ops/ops-page-header";
import type { BatchV1 } from "@/lib/types";

interface BatchHeaderProps {
  batch: BatchV1 | null;
  lastRefreshedAt?: string | null;
}

export function BatchHeader({
  batch,
  lastRefreshedAt
}: BatchHeaderProps) {
  const statusColors: Record<string, string> = {
    completed: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    running: "bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]",
    failed: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]",
    partial_failed: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
  };

  const statusColor = statusColors[batch?.status ?? ""] ?? "bg-white/20";

  return (
    <div className="px-6 pt-6 lg:px-8">
      <OpsPageHeader
        eyebrow="WORKBENCH"
        title={batch ? batch.batch_code : "巡检批次中心"}
        subtitle={
          batch ? (
            <span className="inline-flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">
                  {batch.status}
                </span>
              </span>
              <span className="opacity-50">{batch.source_type}</span>
              <span className="opacity-50">CREATED {new Date(batch.created_at).toLocaleDateString()}</span>
              {lastRefreshedAt ? (
                <span className="text-cyan-400/60">SYNCED {new Date(lastRefreshedAt).toLocaleTimeString()}</span>
              ) : null}
            </span>
          ) : (
            "ENTERPRISE INFRASTRUCTURE SCAN WORKBENCH"
          )
        }
      />
    </div>
  );
}
