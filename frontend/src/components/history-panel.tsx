import { useRef, useEffect, useState } from "react";
import { AdaptiveImage } from "@/components/adaptive-image";
import type { HistorySortMode } from "@/lib/history-utils";
import { formatModelLabel } from "@/lib/model-labels";
import type { PredictionHistoryItem } from "@/lib/types";

interface HistoryPanelProps {
  items: PredictionHistoryItem[];
  loading: boolean;
  errorMessage?: string | null;
  deletingImageId?: string | null;
  deleteSuccessMessage?: string | null;
  filterMode: "recent" | "all";
  searchQuery: string;
  categoryFilter: string;
  sortMode: HistorySortMode;
  availableCategories: string[];
  onRefresh: () => void;
  onSelect: (imageId: string) => void;
  onDeleteRequest: (imageId: string) => void;
  onFilterChange: (mode: "recent" | "all") => void;
  onSearchQueryChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onSortModeChange: (value: HistorySortMode) => void;
  onOpenUploader: () => void;
  getImageUrl: (imageId: string) => string | null;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function HistoryPanel({
  items,
  loading,
  errorMessage,
  deletingImageId,
  deleteSuccessMessage,
  filterMode,
  searchQuery,
  categoryFilter,
  sortMode,
  availableCategories,
  onRefresh,
  onSelect,
  onDeleteRequest,
  onFilterChange,
  onSearchQueryChange,
  onCategoryFilterChange,
  onSortModeChange,
  onOpenUploader,
  getImageUrl
}: HistoryPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [centerImageId, setCenterImageId] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0 || loading) return;

    // Use a small delay to ensure DOM is rendered
    const timer = setTimeout(() => handleScroll(), 100);

    function handleScroll() {
      if (!scrollContainerRef.current) return;

      // Calculate the vertical center of the scrollable area relative to the viewport
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;

      let closestId = null;
      let minDistance = Infinity;

      const cardElements = scrollContainerRef.current.querySelectorAll('[data-image-id]');

      cardElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // Calculate the center of the card
        const cardCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(centerY - cardCenterY);

        if (distance < minDistance) {
          minDistance = distance;
          closestId = el.getAttribute('data-image-id');
        }
      });

      if (closestId !== centerImageId) {
        setCenterImageId(closestId);
      }
    }

    const scrollNode = scrollContainerRef.current;
    if (scrollNode) {
      scrollNode.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll, { passive: true });
    }

    return () => {
      clearTimeout(timer);
      if (scrollNode) {
        scrollNode.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
      }
    };
  }, [items, loading, centerImageId]);

  // Divide items into 3 columns for masonry layout
  const cols = [[], [], []] as PredictionHistoryItem[][];
  items.forEach((item, i) => {
    cols[i % 3].push(item);
  });
  return (
    <div className="h-full rounded-[2rem] border border-white/5 bg-black/40 p-6 shadow-2xl backdrop-blur-2xl flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-5 shrink-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">历史记录</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-white uppercase" style={{ letterSpacing: '0.05em' }}>
            历史识别结果
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            复用本地结果文件回看最近的检测记录。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-wider font-semibold text-slate-200 transition-colors hover:bg-white/10"
            type="button"
            onClick={onRefresh}
          >
            刷新列表
          </button>
          <button
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 transition-colors hover:bg-sky-500/20"
            type="button"
            onClick={onOpenUploader}
          >
            新建分析
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="mt-6 flex-1 overflow-y-auto pr-2 space-y-3"
        style={{ scrollbarGutter: 'stable' }}
      >
        {!loading && deleteSuccessMessage ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-100">
            <p className="font-medium">删除完成</p>
            <p className="mt-2 text-emerald-100/80">{deleteSuccessMessage}</p>
          </div>
        ) : null}

        {!loading && errorMessage ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-200">
            <p className="font-medium">历史结果读取失败</p>
            <p className="mt-2 text-rose-100/80">{errorMessage}</p>
            <div className="mt-4 flex gap-3">
              <button
                className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/20"
                type="button"
                onClick={onRefresh}
              >
                重试
              </button>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
                type="button"
                onClick={onOpenUploader}
              >
                返回上传
              </button>
            </div>
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  搜索
                </span>
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-sky-500"
                  placeholder="搜索图片名、模型版本或后端类型"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  病害类别
                </span>
                <select
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-sky-500"
                  value={categoryFilter}
                  onChange={(event) => onCategoryFilterChange(event.target.value)}
                >
                  <option value="全部">全部病害</option>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  排序方式
                </span>
                <select
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-sky-500"
                  value={sortMode}
                  onChange={(event) => onSortModeChange(event.target.value as HistorySortMode)}
                >
                  <option value="newest">最新优先</option>
                  <option value="detections">病害最多</option>
                  <option value="fastest">推理最快</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  记录范围
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {filterMode === "recent"
                    ? "当前只显示最近 5 条分析记录。"
                    : "当前显示全部分析记录。"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${filterMode === "recent"
                    ? "border border-sky-500/40 bg-sky-500/10 text-sky-300"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  type="button"
                  onClick={() => onFilterChange("recent")}
                >
                  最近 5 条
                </button>
                <button
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${filterMode === "all"
                    ? "border border-sky-500/40 bg-sky-500/10 text-sky-300"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  type="button"
                  onClick={() => onFilterChange("all")}
                >
                  全部
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-slate-400">
            正在读取历史结果...
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-slate-400">
            暂无历史结果，可先上传一张巡检图像生成记录。
            <div className="mt-4">
              <button
                className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/20"
                type="button"
                onClick={onOpenUploader}
              >
                去上传第一张图片
              </button>
            </div>
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 mt-8">
            {cols.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-6">
                {col.map((item) => {
                  const isCenter = centerImageId === null || centerImageId === item.image_id;

                    return (
                      <article
                        key={item.image_id}
                        data-image-id={item.image_id}
                        className={`group relative flex w-full flex-col overflow-hidden rounded-2xl bg-[#030303] transition-all duration-700 ease-out cursor-pointer border border-white/[0.04] hover:border-white/20 hover:shadow-[0_0_40px_rgba(66,133,244,0.05)]
                          ${isCenter ? "scale-100 opacity-100 saturate-100 z-10" : "scale-[0.98] opacity-35 saturate-[0.2] hover:opacity-70 hover:saturate-[0.6]"}
                        `}
                        onClick={() => onSelect(item.image_id)}
                      >
                      {/* Image Thumbnail */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
                        {getImageUrl(item.image_id) ? (
                          <AdaptiveImage
                            alt={item.image_id}
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            src={getImageUrl(item.image_id) ?? ""}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            暂无预览
                          </div>
                        )}

                        {/* Gradient Overlay for Text Readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />

                        {/* Status Overlay */}
                        {deletingImageId === item.image_id && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                            <span className="text-xs uppercase tracking-widest text-white/70 animate-pulse">删除中...</span>
                          </div>
                        )}
                      </div>

                      {/* Content Overlay */}
                      <div className="absolute inset-0 flex flex-col justify-between p-5 pointer-events-none">
                        {/* Top Metadata */}
                        <div className="flex justify-between items-start">
                          <span className="rounded bg-black/40 backdrop-blur-md px-2 py-1 text-[10px] font-mono tracking-[0.08em] text-sky-400 border border-white/10 max-w-[75%] truncate">
                            {formatModelLabel(item)}
                          </span>
                          <span className="rounded bg-black/40 backdrop-blur-md px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-white/60 border border-white/10">
                            {item.backend}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <span className="text-[10px] font-mono text-white/50 bg-black/40 px-2 py-1 rounded backdrop-blur-md">
                            {item.inference_ms}ms
                          </span>
                        </div>

                        {/* Bottom Content */}
                        <div>
                          <h3 className="text-xl font-medium text-white uppercase tracking-wider truncate mb-1" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                            {item.image_id}
                          </h3>

                          <div className="flex items-center gap-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-mono text-sky-400">{item.detection_count}</span>
                              <span className="text-[9px] uppercase tracking-widest text-slate-400">处病害</span>
                            </div>
                            <div className="h-3 w-[1px] bg-white/20" />
                            <span className="text-[10px] text-slate-400 truncate">
                              {formatTime(item.created_at)}
                            </span>
                          </div>

                          {/* Hover Reveal Details */}
                          <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-500 ease-out">
                            <div className="overflow-hidden">
                              <div className="pt-4 mt-4 border-t border-white/10 flex flex-wrap gap-2 pointer-events-auto">
                                {item.categories.map((category) => (
                                  <span
                                    key={category}
                                    className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[9px] font-mono text-slate-300 backdrop-blur-sm"
                                  >
                                    {category}
                                  </span>
                                ))}
                                <div className="w-full flex justify-end mt-2">
                                  <button
                                    className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-rose-300 transition-colors hover:bg-rose-500/30"
                                    disabled={deletingImageId === item.image_id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteRequest(item.image_id);
                                    }}
                                  >
                                    删除
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
