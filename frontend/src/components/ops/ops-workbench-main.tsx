"use client";

import { AnimatePresence, motion } from "framer-motion";

import { BatchEmptyState } from "./batch-empty-state";
import { ItemGrid } from "./item-grid";
import { OpsWorkbenchSkeleton } from "./ops-workbench-skeleton";
import { OpsWorkbenchSummaryPanel } from "./ops-workbench-summary-panel";
import type { BatchItemV1, BatchStatsV1Response, BatchV1, BridgeV1, DetectionRecordV1 } from "@/lib/types";

interface OpsWorkbenchMainProps {
  batchItemLimit: number;
  batchItemOffset: number;
  batchItemTotal: number;
  batchTotal: number;
  createdBy: string;
  detections: DetectionRecordV1[];
  error: string | null;
  items: BatchItemV1[];
  lastRefreshedAt: string | null;
  loading: boolean;
  minConfidence: string;
  modelPolicy: string;
  notice: string | null;
  onBatchItemPageChange: (offset: number) => void;
  onClearSelection: () => void;
  onCreateClick: () => void;
  onMinConfidenceChange: (value: string) => void;
  onOpenBridgeAssets: () => void;
  onPathFilterChange: (value: string) => void;
  onRetrySelectedFailed: () => void;
  onRetryTask: (taskId: string) => void;
  onSelectVisibleItems: () => void;
  onShowFailedOnlyToggle: () => void;
  onToggleSelectItem: (itemId: string) => void;
  onToggleSummaryExpanded: () => void;
  pathFilter: string;
  retryingTaskId: string | null;
  selectedBatch: BatchV1 | null;
  selectedBatchId: string;
  selectedBridge: BridgeV1 | null;
  selectedBridgeId: string;
  selectedItemIds: string[];
  showFailedItemsOnly: boolean;
  sourceDevice: string;
  stats: BatchStatsV1Response | null;
  summaryExpanded: boolean;
}

export function OpsWorkbenchMain({
  batchItemLimit,
  batchItemOffset,
  batchItemTotal,
  batchTotal,
  createdBy,
  detections,
  error,
  items,
  lastRefreshedAt,
  loading,
  minConfidence,
  modelPolicy,
  notice,
  onBatchItemPageChange,
  onClearSelection,
  onCreateClick,
  onMinConfidenceChange,
  onOpenBridgeAssets,
  onPathFilterChange,
  onRetrySelectedFailed,
  onRetryTask,
  onSelectVisibleItems,
  onShowFailedOnlyToggle,
  onToggleSelectItem,
  onToggleSummaryExpanded,
  pathFilter,
  retryingTaskId,
  selectedBatch,
  selectedBatchId,
  selectedBridge,
  selectedBridgeId,
  selectedItemIds,
  showFailedItemsOnly,
  sourceDevice,
  stats,
  summaryExpanded,
}: OpsWorkbenchMainProps) {
  return (
    <>
      {error ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </motion.div>
      ) : null}
      {notice ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {notice}
        </motion.div>
      ) : null}

      <AnimatePresence mode="wait">
        {loading && !lastRefreshedAt ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <OpsWorkbenchSkeleton />
          </motion.div>
        ) : !selectedBatchId ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            <BatchEmptyState onCreateClick={onCreateClick} hasSelectedBridge={Boolean(selectedBridgeId)} onOpenBridgeAssets={onOpenBridgeAssets} />
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-8">
            <OpsWorkbenchSummaryPanel
              batchItemTotal={batchItemTotal}
              createdBy={createdBy}
              detectionsLength={detections.length}
              minConfidence={minConfidence}
              modelPolicy={modelPolicy}
              onMinConfidenceChange={onMinConfidenceChange}
              selectedBatch={selectedBatch}
              selectedBridge={selectedBridge}
              selectedItemIdsCount={selectedItemIds.length}
              showFailedItemsOnly={showFailedItemsOnly}
              sourceDevice={sourceDevice}
              stats={stats}
              summaryExpanded={summaryExpanded}
              onToggleSummaryExpanded={onToggleSummaryExpanded}
            />

            <ItemGrid
              items={items}
              pathFilter={pathFilter}
              onPathFilterChange={onPathFilterChange}
              showFailedOnly={showFailedItemsOnly}
              onShowFailedOnlyToggle={onShowFailedOnlyToggle}
              onRetryTask={onRetryTask}
              retryingTaskId={retryingTaskId}
              selectedItemIds={selectedItemIds}
              onToggleSelectItem={onToggleSelectItem}
              onSelectVisibleItems={onSelectVisibleItems}
              onClearSelection={onClearSelection}
              onRetrySelectedFailed={onRetrySelectedFailed}
              batchItemOffset={batchItemOffset}
              batchItemLimit={batchItemLimit}
              batchItemTotal={batchItemTotal}
              onBatchItemPageChange={onBatchItemPageChange}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="border-t border-white/5 bg-white/[0.01] px-4 py-4 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/40">
            系统存证批次总览 / Count: {batchTotal}
          </div>
        </div>
      </footer>
    </>
  );
}
