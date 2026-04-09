"use client";

import { motion, AnimatePresence } from "framer-motion";

import { HistoryPanel } from "@/components/history";
import { HistoryBatchPanel } from "@/components/history/history-batch-panel";
import { HistoryRecordListPanel } from "@/components/history/history-record-list-panel";
import { OpsPageLayout } from "@/components/ops/ops-page-layout";
import { OpsPageHeader } from "@/components/ops/ops-page-header";
import { useHistoryRouteState } from "@/components/history/use-history-route-state";

export function HistoryRouteShell() {
  const {
    availableHistoryCategories,
    batchError,
    batchLoading,
    batches,
    bridges,
    currentHistoryHref,
    deleteSuccessMessage,
    deletingImageId,
    getHistoryPreviewUrl,
    handleBatchDeleteHistory,
    handleBatchExportHistory,
    handleDeleteHistory,
    handleLoadMoreBatches,
    hasMoreBatches,
    historyCategoryFilter,
    historyError,
    historyItems,
    historyLoading,
    historySearchQuery,
    historySortMode,
    historyTotal,
    loadHistory,
    openHistoryDetail,
    openUploader,
    selectedBatchId,
    selectedBatchItems,
    selectedBridge,
    selectedBridgeId,
    setHistoryCategoryFilter,
    setHistorySearchQuery,
    setHistorySortMode,
    setSelectedBatchId,
    setSelectedBridgeId,
    setShowSingleHistory,
    showSingleHistory,
    status,
  } = useHistoryRouteState();

  return (
    <OpsPageLayout
      containerClassName="min-h-full"
      header={
        <OpsPageHeader
          eyebrow="档案库"
          title="历史记录"
          subtitle="查看已完成的巡检批次与历史识别记录"
          accent="amber"
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSingleHistory(!showSingleHistory)}
                className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-black transition-all ${
                  showSingleHistory 
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-200" 
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                {showSingleHistory ? "隐藏单图库" : "查看单图历史"}
              </button>
            </div>
          }
        />
      }
    >
      <div className="space-y-8">
        <div 
          className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-white/5 bg-white/[0.02] px-6 py-4 text-sm text-white/40 page-enter"
        >
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            <span className="font-medium">{status.message}</span>
          </div>
          <div className="rounded-full border border-white/5 bg-white/5 px-4 py-1 text-[10px] font-black uppercase tracking-widest">
            {batches.length} 个批次
          </div>
        </div>

        {batchError && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{batchError}</div>}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr] lg:items-stretch">
          <HistoryBatchPanel
            batchLoading={batchLoading}
            batches={batches}
            bridges={bridges}
            hasMoreBatches={hasMoreBatches}
            selectedBatchId={selectedBatchId}
            selectedBridgeId={selectedBridgeId}
            onBridgeChange={setSelectedBridgeId}
            onBatchChange={setSelectedBatchId}
            onLoadMore={handleLoadMoreBatches}
          />

          <HistoryRecordListPanel
            batchLoading={batchLoading}
            currentHistoryHref={currentHistoryHref}
            selectedBatchId={selectedBatchId}
            selectedBatchItems={selectedBatchItems}
            selectedBridge={selectedBridge}
          />
        </section>

        <AnimatePresence>
          {showSingleHistory && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.015] p-8 backdrop-blur-3xl shadow-2xl">
                <div className="mb-8 border-b border-white/5 pb-8">
                    <div className="mb-2 flex items-center gap-2 opacity-30">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">视觉轨迹库</p>
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-white uppercase">单图历史全局回顾</h3>
                    <p className="mt-1 text-xs font-medium text-white/40">追溯历史识别轨迹，进行批量导出与深度检索</p>
                </div>

                <div className="min-h-[960px] max-h-[960px] overflow-hidden">
                  <HistoryPanel
                    items={historyItems}
                    totalCount={historyTotal}
                    loading={historyLoading}
                    errorMessage={historyError}
                    deletingImageId={deletingImageId}
                    deleteSuccessMessage={deleteSuccessMessage}
                    searchQuery={historySearchQuery}
                    categoryFilter={historyCategoryFilter}
                    sortMode={historySortMode}
                    availableCategories={availableHistoryCategories}
                    getImageUrl={getHistoryPreviewUrl}
                    onDeleteRequest={(imageId) => void handleDeleteHistory(imageId)}
                    onBatchDelete={handleBatchDeleteHistory}
                    onBatchExportJson={(imageIds) => handleBatchExportHistory(imageIds, "json")}
                    onBatchExportOverlay={(imageIds) => handleBatchExportHistory(imageIds, "overlay")}
                    onSearchQueryChange={setHistorySearchQuery}
                    onCategoryFilterChange={setHistoryCategoryFilter}
                    onSortModeChange={setHistorySortMode}
                    onOpenUploader={openUploader}
                    onRefresh={() => void loadHistory()}
                    onSelect={openHistoryDetail}
                  />
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </OpsPageLayout>
  );
}
