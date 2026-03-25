import { motion, AnimatePresence } from "framer-motion";
import type { PredictionHistoryItem } from "@/lib/types";

interface HistoryBatchDrawerProps {
  isBatchMode: boolean;
  selectedItems: PredictionHistoryItem[];
  filteredCount: number;
  totalCount: number;
  currentPageCount: number;
  onSelectAll: () => void;
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
  onSelectAll,
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
  const selectedPreview = selectedItems.slice(0, 8);

  return (
    <aside className="w-full shrink-0 xl:w-[380px] animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="sticky top-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[#05080A]/90 shadow-[0_32px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sky-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 border-b border-white/5 bg-white/[0.02] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] animate-pulse" />
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-sky-400/80">Batch Manager</p>
              </div>
              <h3 className="mt-1.5 text-xl font-light tracking-tight text-white">批量管理控制台</h3>
            </div>
            <button
              type="button"
              onClick={onCloseBatchMode}
              className="group flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4.5 w-4.5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/30">
            操作范围基于当前筛选结果，不受分页限制，请谨慎执行删除操作。
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3 border-b border-white/5 bg-black/20 p-5">
          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.05] p-4 group transition-colors hover:bg-sky-400/[0.08]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-sky-300/60">已选记录</p>
            <p className="mt-2 text-3xl font-light text-white drop-shadow-sm">{selectedCount}</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">当前筛选</p>
            <p className="mt-2 text-3xl font-light text-white/80">{filteredCount}</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">当前页数</p>
            <p className="mt-2 text-2xl font-light text-white/60">{currentPageCount}</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">库内总量</p>
            <p className="mt-2 text-2xl font-light text-white/60">{totalCount}</p>
          </div>
        </div>

        <div className="relative z-10 space-y-3 border-b border-white/5 p-5">
          <div className="grid grid-cols-1 gap-2.5">
            <button
              type="button"
              onClick={onBatchDelete}
              disabled={selectedCount === 0 || isDeleting || isExportingJson || isExportingOverlay}
              className="group flex w-full items-center gap-3 rounded-[1.25rem] border border-rose-500/20 bg-rose-500/[0.08] px-5 py-4 text-left transition-all hover:bg-rose-500/[0.15] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 group-hover:scale-110 transition-transform">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-200 group-hover:text-white transition-colors">
                  {isDeleting ? "正在处理删除..." : "删除已选记录"}
                </p>
                <p className="mt-0.5 text-[10px] text-rose-300/40">注意：删除操作不可撤回</p>
              </div>
            </button>

            <button
              type="button"
              onClick={onBatchExportJson}
              disabled={selectedCount === 0 || isDeleting || isExportingJson || isExportingOverlay}
              className="group flex w-full items-center gap-3 rounded-[1.25rem] border border-sky-500/20 bg-sky-500/[0.08] px-5 py-4 text-left transition-all hover:bg-sky-500/[0.15] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 group-hover:scale-110 transition-transform">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-sky-200 group-hover:text-white transition-colors">
                  {isExportingJson ? "正在准备数据..." : "导出 JSON 压缩包"}
                </p>
                <p className="mt-0.5 text-[10px] text-sky-300/40">包含所有检测元数据</p>
              </div>
            </button>

            <button
              type="button"
              onClick={onBatchExportOverlay}
              disabled={selectedCount === 0 || overlayExportableCount === 0 || isDeleting || isExportingJson || isExportingOverlay}
              className="group flex w-full items-center gap-3 rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/[0.08] px-5 py-4 text-left transition-all hover:bg-emerald-500/[0.15] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-200 group-hover:text-white transition-colors">
                  {isExportingOverlay ? "正在生成图像..." : `导出结果图 (${overlayExportableCount})`}
                </p>
                <p className="mt-0.5 text-[10px] text-emerald-300/40">可视化病害标记合成图</p>
              </div>
            </button>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={selectedCount === filteredCount ? onClearSelection : onSelectAll}
                disabled={filteredCount === 0 || isDeleting || isExportingJson || isExportingOverlay}
                className="flex-1 rounded-xl bg-white/5 py-3 text-[11px] font-medium text-sky-400 transition-all hover:bg-white/10 hover:text-sky-300 disabled:opacity-10"
              >
                {selectedCount === filteredCount ? "取消全选" : "全选筛选结果"}
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                disabled={selectedCount === 0 || isDeleting || isExportingJson || isExportingOverlay}
                className="flex-1 rounded-xl bg-white/5 py-3 text-[11px] font-medium text-white/40 transition-all hover:bg-white/10 hover:text-white disabled:opacity-10"
              >
                清空已选项目
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-5 py-6">
          <div className="mb-4 flex items-center justify-between px-1">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">已选择记录预览</h4>
            {selectedCount > 0 && <span className="h-4 w-px bg-white/10" />}
            <span className="text-[10px] font-mono text-white/20">
              {selectedCount > 0 ? `LIMIT: ${selectedPreview.length} / ${selectedCount}` : "NULL"}
            </span>
          </div>

          <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {selectedItems.slice(0, 15).map((item) => (
                <motion.div
                  layout
                  key={item.image_id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.05] hover:border-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[13px] font-medium text-white/70 group-hover:text-white transition-colors">
                      {item.image_id}
                    </p>
                    <div className="h-1.5 w-1.5 rounded-full bg-white/10 group-hover:bg-sky-500/50 transition-colors" />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-white/20 group-hover:text-white/40 transition-colors">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {item.detection_count} ERRORS
                    </span>
                    <span>·</span>
                    <span>{item.inference_ms} MS</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {selectedCount === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-20">
                <svg className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                <p className="text-xs font-light">等待选择记录...</p>
              </div>
            )}

            {selectedCount > 15 && (
              <div className="py-2 text-center">
                <p className="text-[10px] text-white/15 uppercase tracking-widest">
                  及其他 {selectedCount - 15} 条记录...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
