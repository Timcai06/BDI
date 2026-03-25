"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HistorySortMode } from "@/lib/history-utils";
import type { PredictionHistoryItem } from "@/lib/types";
import { HistoryStats } from "./history-stats";
import { HistoryToolbar } from "./history-toolbar";
import { HistoryBatchDrawer } from "./history-batch-drawer";
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
  onBatchExportJson: (imageIds: string[]) => Promise<void>;
  onBatchExportOverlay: (imageIds: string[]) => Promise<void>;
  onSearchQueryChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onSortModeChange: (value: HistorySortMode) => void;
  onOpenUploader: () => void;
  getImageUrl: (item: PredictionHistoryItem) => string | null;
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
  onBatchExportJson,
  onBatchExportOverlay,
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
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingOverlay, setIsExportingOverlay] = useState(false);
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "delete" | "export-json" | "export-overlay" | null;
    count: number;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: null,
    count: 0,
    onConfirm: () => {},
  });

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
  const filteredIdSet = useMemo(() => new Set(filteredItems.map((item) => item.image_id)), [filteredItems]);
  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedIds.has(item.image_id)),
    [filteredItems, selectedIds]
  );

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((imageId) => filteredIdSet.has(imageId)));
      const isSameSelection =
        next.size === prev.size && Array.from(prev).every((imageId) => next.has(imageId));
      if (isSameSelection) {
        return prev;
      }
      return next;
    });
  }, [filteredIdSet]);

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
    setSelectedIds(new Set(filteredItems.map(item => item.image_id)));
  }, [filteredItems]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setConfirmModal({
      isOpen: true,
      type: "delete",
      count: selectedIds.size,
      onConfirm: async () => {
        setIsBatchDeleting(true);
        try {
          await onBatchDelete(Array.from(selectedIds));
          setSelectedIds(new Set());
          setIsBatchMode(false);
        } finally {
          setIsBatchDeleting(false);
        }
      }
    });
  }, [selectedIds, onBatchDelete]);

  const handleBatchExportJson = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsExportingJson(true);
    try {
      await onBatchExportJson(Array.from(selectedIds));
    } finally {
      setIsExportingJson(false);
    }
  }, [selectedIds, onBatchExportJson]);

  const handleBatchExportOverlay = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsExportingOverlay(true);
    try {
      await onBatchExportOverlay(Array.from(selectedIds));
    } finally {
      setIsExportingOverlay(false);
    }
  }, [selectedIds, onBatchExportOverlay]);

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
      {/* Stats */}
      <div className="pb-6">
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
          <div className={`flex gap-6 ${isBatchMode ? "xl:items-start" : ""}`}>
            <div className="min-w-0 flex-1 space-y-6">
            {/* Grid */}
            <div className={`grid gap-6 ${isBatchMode ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
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

            <HistoryBatchDrawer
              isBatchMode={isBatchMode}
              selectedItems={selectedItems}
              filteredCount={filteredItems.length}
              totalCount={totalCount}
              currentPageCount={paginatedItems.length}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onCloseBatchMode={handleToggleBatchMode}
              onBatchDelete={handleBatchDelete}
              onBatchExportJson={handleBatchExportJson}
              onBatchExportOverlay={handleBatchExportOverlay}
              isDeleting={isBatchDeleting}
              isExportingJson={isExportingJson}
              isExportingOverlay={isExportingOverlay}
            />
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0B1120]/90 p-8 shadow-[0_32px_128px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
            >
              <div className="relative text-center">
                <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border ${confirmModal.type === 'delete' ? 'border-rose-500/20 bg-rose-500/10 text-rose-500' : 'border-sky-500/20 bg-sky-500/10 text-sky-500'}`}>
                  {confirmModal.type === 'delete' ? (
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  ) : (
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                </div>

                <h3 className="text-2xl font-light tracking-tight text-white mb-2">
                  确认执行操作？
                </h3>
                
                <div className="rounded-2xl bg-white/5 p-4 mb-6">
                  <p className="text-sm text-white/60 leading-relaxed">
                    您已选择 <span className="font-bold text-white uppercase">{confirmModal.count} 项</span> 记录进行{confirmModal.type === 'delete' ? '删除' : '导出'}。
                    {confirmModal.type === 'delete' && " 删除后包含原图、JSON 和结果图在内的所有数据都将无法恢复。"}
                  </p>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 rounded-2xl bg-white/5 py-3.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      confirmModal.onConfirm();
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    className={`flex-1 rounded-2xl py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-all active:scale-95 ${confirmModal.type === 'delete' ? 'bg-rose-500 shadow-[0_8px_20px_rgba(244,63,94,0.3)] hover:bg-rose-600' : 'bg-sky-500 shadow-[0_8px_20px_rgba(14,165,233,0.3)] hover:bg-sky-600'}`}
                  >
                    确认执行
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Re-export components
export { HistoryStats } from "./history-stats";
export { HistoryToolbar } from "./history-toolbar";
export { HistoryBatchDrawer } from "./history-batch-drawer";
export { HistoryCard } from "./history-card";
export { HistoryEmptyState } from "./history-empty-state";
export { HistoryPagination } from "./history-pagination";
