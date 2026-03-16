"use client";

import type { HistorySortMode } from "@/lib/history-utils";

interface HistoryToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  sortMode: HistorySortMode;
  onSortModeChange: (value: HistorySortMode) => void;
  availableCategories: string[];
  isBatchMode: boolean;
  onToggleBatchMode: () => void;
  onRefresh: () => void;
}

export function HistoryToolbar({
  searchQuery,
  onSearchQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  sortMode,
  onSortModeChange,
  availableCategories,
  isBatchMode,
  onToggleBatchMode,
  onRefresh
}: HistoryToolbarProps) {
  return (
    <div className="space-y-4">
      {/* Top Row - Search and Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="搜索图片名、模型版本..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm text-white placeholder:text-white/30 outline-none focus:border-sky-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
              className="appearance-none pl-3 pr-9 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs font-medium text-white/70 outline-none focus:border-sky-500/50 transition-colors cursor-pointer"
            >
              <option value="全部">全部类别</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortMode}
              onChange={(e) => onSortModeChange(e.target.value as HistorySortMode)}
              className="appearance-none pl-3 pr-9 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs font-medium text-white/70 outline-none focus:border-sky-500/50 transition-colors cursor-pointer"
            >
              <option value="newest">最新优先</option>
              <option value="oldest">最早优先</option>
              <option value="detections">病害最多</option>
              <option value="fastest">推理最快</option>
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          </div>

          {/* Batch Mode Toggle */}
          <button
            onClick={onToggleBatchMode}
            className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              isBatchMode
                ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            批量
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-white/50 hover:bg-white/[0.05] hover:text-white transition-colors"
            title="刷新"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
