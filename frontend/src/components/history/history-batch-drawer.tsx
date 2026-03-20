"use client";

import type { PredictionHistoryItem } from "@/lib/types";

interface HistoryBatchDrawerProps {
  isBatchMode: boolean;
  selectedItems: PredictionHistoryItem[];
  filteredCount: number;
  totalCount: number;
  currentPageCount: number;
  onClearSelection: () => void;
  onCloseBatchMode: () => void;
  onBatchDelete: () => void;
  onBatchExportJson: () => void;
  onBatchExportOverlay: () => void;
  isDeleting?: boolean;
  isExportingJson?: boolean;
  isExportingOverlay?: boolean;
}

export function HistoryBatchDrawer({
  isBatchMode,
  selectedItems,
  filteredCount,
  totalCount,
  currentPageCount,
  onClearSelection,
  onCloseBatchMode,
  onBatchDelete,
  onBatchExportJson,
  onBatchExportOverlay,
  isDeleting = false,
  isExportingJson = false,
  isExportingOverlay = false
}: HistoryBatchDrawerProps) {
  if (!isBatchMode) {
    return null;
  }

  const selectedCount = selectedItems.length;
  const overlayExportableCount = selectedItems.filter((item) => item.artifacts.overlay_path).length;
  const selectedPreview = selectedItems.slice(0, 6);

  return (
    <aside className="w-full shrink-0 xl:w-[360px]">
      <div className="sticky top-6 overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(8,12,24,0.96),rgba(3,3,3,0.95))] shadow-[0_0_40px_rgba(0,0,0,0.32)]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-400/70">Batch Manager</p>
              <h3 className="mt-1 text-lg font-medium text-white">历史记录批量管理</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                操作范围基于当前筛选结果，不受当前分页限制。
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseBatchMode}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              退出
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.08] p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-sky-200/70">已选记录</p>
            <p className="mt-2 text-2xl font-light text-white">{selectedCount}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">筛选结果</p>
            <p className="mt-2 text-2xl font-light text-white">{filteredCount}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">当前页</p>
            <p className="mt-2 text-2xl font-light text-white">{currentPageCount}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">历史总量</p>
            <p className="mt-2 text-2xl font-light text-white">{totalCount}</p>
          </div>
        </div>

        <div className="space-y-3 border-b border-white/[0.06] px-5 py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button
              type="button"
              onClick={onBatchDelete}
              disabled={selectedCount === 0 || isDeleting || isExportingJson || isExportingOverlay}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-left text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? "正在删除选中记录..." : "批量删除已选记录"}
            </button>
            <button
              type="button"
              onClick={onBatchExportJson}
              disabled={selectedCount === 0 || isDeleting || isExportingJson || isExportingOverlay}
              className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-left text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isExportingJson ? "正在打包 JSON..." : "导出 JSON 压缩包"}
            </button>
            <button
              type="button"
              onClick={onBatchExportOverlay}
              disabled={
                selectedCount === 0 ||
                overlayExportableCount === 0 ||
                isDeleting ||
                isExportingJson ||
                isExportingOverlay
              }
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isExportingOverlay
                ? "正在打包叠加图..."
                : overlayExportableCount > 0
                  ? `导出叠加图压缩包 (${overlayExportableCount})`
                  : "所选记录没有可导出的叠加图"}
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={selectedCount === 0 || isDeleting || isExportingJson || isExportingOverlay}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              清空已选
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Selected Records</p>
            <span className="text-[11px] text-white/35">
              {selectedCount === 0 ? "未选择记录" : `已选 ${selectedCount} 条`}
            </span>
          </div>

          {selectedPreview.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-sm text-white/35">
              先在列表中选择记录，再执行批量删除或导出。
            </div>
          ) : (
            <div className="space-y-2">
              {selectedPreview.map((item) => (
                <div
                  key={item.image_id}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3"
                >
                  <p className="truncate text-sm text-white">{item.image_id}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
                    <span>{item.detection_count} 处病害</span>
                    <span>·</span>
                    <span>{item.inference_ms}ms</span>
                  </div>
                </div>
              ))}
              {selectedCount > selectedPreview.length && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/35">
                  还有 {selectedCount - selectedPreview.length} 条记录未展开显示。
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
