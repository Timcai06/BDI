"use client";

interface HistoryBatchActionsProps {
  isBatchMode: boolean;
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCloseBatchMode: () => void;
  isBusy?: boolean;
}

export function HistoryBatchActions({
  isBatchMode,
  selectedCount,
  filteredCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onCloseBatchMode,
  isBusy = false
}: HistoryBatchActionsProps) {
  if (!isBatchMode) return null;

  return (
    <div className="sticky top-0 z-30 mb-4 rounded-xl border border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-md p-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded border border-sky-500 bg-sky-500/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-white">
              已选择 <span className="font-semibold text-sky-400">{selectedCount}</span> 项
            </span>
          </div>
          
          <div className="h-4 w-px bg-white/10" />

          <span className="text-xs text-white/45">
            当前筛选结果 {filteredCount} 条 / 历史总量 {totalCount} 条
          </span>
          
          <button
            onClick={selectedCount === filteredCount ? onClearSelection : onSelectAll}
            className="text-xs text-white/50 hover:text-white transition-colors"
            disabled={isBusy || filteredCount === 0}
          >
            {selectedCount === filteredCount ? "取消全选" : `选择全部筛选结果 (${filteredCount})`}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClearSelection}
            disabled={isBusy || selectedCount === 0}
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
          >
            清空已选
          </button>

          <button
            onClick={onCloseBatchMode}
            disabled={isBusy}
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
          >
            退出批量模式
          </button>
        </div>
      </div>
    </div>
  );
}
