"use client";

interface HistoryBatchActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchDelete: () => void;
  isDeleting?: boolean;
}

export function HistoryBatchActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  isDeleting = false
}: HistoryBatchActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-30 mb-4 rounded-xl border border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-md p-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
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
          
          <button
            onClick={selectedCount === totalCount ? onClearSelection : onSelectAll}
            className="text-xs text-white/50 hover:text-white transition-colors"
            disabled={isDeleting}
          >
            {selectedCount === totalCount ? "取消全选" : `选择全部 (${totalCount})`}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClearSelection}
            disabled={isDeleting}
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
          >
            取消
          </button>
          
          <button
            onClick={onBatchDelete}
            disabled={isDeleting}
            className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                删除中...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                批量删除
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
