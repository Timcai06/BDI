"use client";

import { useState, useMemo, useCallback } from "react";
import type { HistorySortMode } from "@/lib/history-utils";
import type { PredictionHistoryItem } from "@/lib/types";
import { HistoryStats } from "./history-stats";
import { HistoryToolbar } from "./history-toolbar";
import { HistoryBatchActions } from "./history-batch-actions";
import { HistoryCard } from "./history-card";
import { HistoryEmptyState } from "./history-empty-state";
import { HistoryPagination } from "./history-pagination";

interface HistoryPanelProps {
  items: PredictionHistoryItem[];
  totalCount: number;
  loading: boolean;
  errorMessage?: string | null;
  deletingImageId?: string | null;
  deleteSuccessMessage?: string | null;
  searchQuery: string;
  categoryFilter: string;
  sortMode: HistorySortMode;
  availableCategories: string[];
  onRefresh: () => void;
  onSelect: (imageId: string) => void;
  onDeleteRequest: (imageId: string) => void;
  onBatchDelete: (imageIds: string[]) => Promise<void>;
  onSearchQueryChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onSortModeChange: (value: HistorySortMode) => void;
  onOpenUploader: () => void;
  getImageUrl: (imageId: string) => string | null;
}

export function HistoryPanel({
  items,
  totalCount,
  loading,
  errorMessage,
  deletingImageId,
  deleteSuccessMessage,
  searchQuery,
  categoryFilter,
  sortMode,
  availableCategories,
  onRefresh,
  onSelect,
  onDeleteRequest,
  onBatchDelete,
  onSearchQueryChange,
  onCategoryFilterChange,
  onSortModeChange,
  onOpenUploader,
  getImageUrl
}: HistoryPanelProps) {
  // Batch mode state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.image_id.toLowerCase().includes(query) ||
        item.model_name.toLowerCase().includes(query) ||
        item.backend.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== "全部") {
      result = result.filter(item => 
        item.categories.includes(categoryFilter)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortMode) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "detections":
          return b.detection_count - a.detection_count;
        case "fastest":
          return a.inference_ms - b.inference_ms;
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, categoryFilter, sortMode]);

  // Paginate items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);

  // Batch selection handlers
  const handleToggleBatchMode = useCallback(() => {
    setIsBatchMode(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelect = useCallback((imageId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(paginatedItems.map(item => item.image_id)));
  }, [paginatedItems]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    const confirmed = window.confirm(`确认批量删除 ${ids.length} 条记录吗？该操作无法恢复。`);
    if (!confirmed) {
      return;
    }

    setIsBatchDeleting(true);
    try {
      await onBatchDelete(ids);
      setSelectedIds(new Set());
      setIsBatchMode(false);
    } finally {
      setIsBatchDeleting(false);
    }
  }, [selectedIds, onBatchDelete]);

  const handleSearchChange = useCallback((value: string) => {
    setCurrentPage(1);
    onSearchQueryChange(value);
  }, [onSearchQueryChange]);

  const handleCategoryChange = useCallback((value: string) => {
    setCurrentPage(1);
    onCategoryFilterChange(value);
  }, [onCategoryFilterChange]);

  const handleSortChange = useCallback((value: HistorySortMode) => {
    setCurrentPage(1);
    onSortModeChange(value);
  }, [onSortModeChange]);

  const hasFilters = !!searchQuery || categoryFilter !== "全部";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/[0.04]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-500">历史记录</p>
          <h2 className="mt-1 text-2xl font-light tracking-tight text-white">
            历史识别结果
          </h2>
        </div>
        <button
          onClick={onOpenUploader}
          className="px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-xs font-medium text-sky-300 hover:bg-sky-500/30 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          新建分析
        </button>
      </div>

      {/* Stats */}
      <div className="py-6">
        <HistoryStats items={items} totalCount={totalCount} filteredCount={filteredItems.length} />
      </div>

      {/* Toolbar */}
      <div className="pb-6">
        <HistoryToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={handleSearchChange}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={handleCategoryChange}
          sortMode={sortMode}
          onSortModeChange={handleSortChange}
          availableCategories={availableCategories}
          isBatchMode={isBatchMode}
          onToggleBatchMode={handleToggleBatchMode}
          onRefresh={onRefresh}
        />
      </div>

      {/* Success/Error Messages */}
      <div className="space-y-3 mb-6">
        {deleteSuccessMessage && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {deleteSuccessMessage}
          </div>
        )}
        
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <p className="font-medium">历史结果读取失败</p>
            <p className="text-rose-100/80 mt-1">{errorMessage}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onRefresh}
                className="px-3 py-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs font-medium text-rose-100 hover:bg-rose-500/20 transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-white/40">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">正在读取历史结果...</span>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <HistoryEmptyState
            hasFilters={hasFilters}
            onClearFilters={() => {
              onSearchQueryChange("");
              onCategoryFilterChange("全部");
            }}
            onUpload={onOpenUploader}
          />
        ) : (
          <div className="space-y-6">
            {/* Batch Actions */}
            <HistoryBatchActions
              selectedCount={selectedIds.size}
              totalCount={paginatedItems.length}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onBatchDelete={handleBatchDelete}
              isDeleting={isBatchDeleting}
            />

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedItems.map((item) => (
                <HistoryCard
                  key={item.image_id}
                  item={item}
                  isSelected={selectedIds.has(item.image_id)}
                  isBatchMode={isBatchMode}
                  deletingImageId={deletingImageId || null}
                  getImageUrl={getImageUrl}
                  onSelect={() => onSelect(item.image_id)}
                  onDeleteRequest={(e) => {
                    e.stopPropagation();
                    onDeleteRequest(item.image_id);
                  }}
                  onToggleSelect={(e) => {
                    e.stopPropagation();
                    handleToggleSelect(item.image_id);
                  }}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <HistoryPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredItems.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export components
export { HistoryStats } from "./history-stats";
export { HistoryToolbar } from "./history-toolbar";
export { HistoryBatchActions } from "./history-batch-actions";
export { HistoryCard } from "./history-card";
export { HistoryEmptyState } from "./history-empty-state";
export { HistoryPagination } from "./history-pagination";
