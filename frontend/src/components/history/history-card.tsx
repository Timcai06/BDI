"use client";

import { AdaptiveImage } from "@/components/adaptive-image";
import { getDefectColorHex } from "@/lib/defect-visuals";
import { formatModelLabel } from "@/lib/model-labels";
import type { PredictionHistoryItem } from "@/lib/types";

interface HistoryCardProps {
  item: PredictionHistoryItem;
  isSelected: boolean;
  isBatchMode: boolean;
  deletingImageId: string | null;
  getImageUrl: (item: PredictionHistoryItem) => string | null;
  onSelect: () => void;
  onDeleteRequest: (e: React.MouseEvent) => void;
  onToggleSelect: (e: React.MouseEvent) => void;
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

export function HistoryCard({
  item,
  isSelected,
  isBatchMode,
  deletingImageId,
  getImageUrl,
  onSelect,
  onDeleteRequest,
  onToggleSelect
}: HistoryCardProps) {
  const isDeleting = deletingImageId === item.image_id;
  const imageUrl = getImageUrl(item);
  const primaryCategory = item.categories[0] ?? "default";
  const remainingCategoryCount = Math.max(item.categories.length - 1, 0);

  return (
    <article
      className={`group relative flex w-full flex-col overflow-hidden rounded-[20px] bg-[#030303] transition-all duration-300 cursor-pointer border ${
        isSelected
          ? "border-sky-500/60 shadow-[0_0_36px_rgba(56,189,248,0.16)] -translate-y-0.5"
          : "border-white/[0.04] hover:border-white/20 hover:shadow-[0_0_40px_rgba(66,133,244,0.08)]"
      }`}
      onClick={isBatchMode ? onToggleSelect : onSelect}
    >
      {/* Image Container */}
      <div className={`relative w-full overflow-hidden bg-black/40 ${isBatchMode ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
        {imageUrl ? (
          <AdaptiveImage
            alt={item.image_id}
            className={`object-cover transition-transform duration-500 ${isBatchMode ? "group-hover:scale-[1.02]" : "group-hover:scale-105"}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            src={imageUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg className="w-12 h-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Gradient Overlay */}
        <div
          className={`absolute inset-0 ${
            isBatchMode
              ? "bg-gradient-to-t from-black/95 via-black/55 to-black/15"
              : "bg-gradient-to-t from-black/90 via-black/30 to-transparent"
          }`}
        />
        {isBatchMode && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_36%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        )}
        {isBatchMode && isSelected && (
          <div className="absolute inset-0 bg-sky-500/10 ring-1 ring-inset ring-sky-400/40" />
        )}

        {/* Deleting Overlay */}
        {isDeleting && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <span className="text-xs uppercase tracking-widest text-white/70 animate-pulse">删除中...</span>
          </div>
        )}

        {/* Top Right Actions */}
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Delete Button */}
          {!isBatchMode && (
            <button
              onClick={onDeleteRequest}
              disabled={isDeleting}
              className="w-8 h-8 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
              title="删除"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {/* Content Overlay */}
        <div className={`absolute inset-0 flex flex-col justify-between pointer-events-none ${isBatchMode ? "p-2.5" : "p-4"}`}>
          {/* Top Metadata */}
          {isBatchMode ? (
            <div className="flex justify-end">
              <span className="rounded-full border border-white/10 bg-black/55 px-1.5 py-0.5 text-[8px] font-mono text-white/65 backdrop-blur-md leading-none">
                {item.inference_ms}ms
              </span>
            </div>
          ) : (
            <div className="flex justify-between items-start">
              <span className="rounded-lg bg-black/50 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-sky-400 border border-white/10">
                {formatModelLabel(item)}
              </span>
              <span className="rounded-lg bg-black/50 backdrop-blur-md px-2 py-1 text-[10px] font-mono text-white/60 border border-white/10">
                {item.inference_ms}ms
              </span>
            </div>
          )}

          {/* Bottom Content */}
          <div>
            {isBatchMode ? (
              <div className="space-y-1">
                <h3
                  className="truncate text-[11px] font-medium leading-tight text-white"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}
                >
                  {item.image_id}
                </h3>

                <div className="flex items-center gap-1 text-[8px] leading-none">
                  <span
                    className="rounded-full border px-1.5 py-0.5 font-medium"
                    style={{
                      backgroundColor: `${getDefectColorHex(primaryCategory)}18`,
                      borderColor: `${getDefectColorHex(primaryCategory)}40`,
                      color: getDefectColorHex(primaryCategory)
                    }}
                  >
                    {primaryCategory}
                  </span>
                  {remainingCategoryCount > 0 && (
                    <span className="rounded-full border border-white/10 bg-black/45 px-1.5 py-0.5 text-white/45">
                      +{remainingCategoryCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 text-[8px] text-white/55 leading-none">
                  <div className="flex items-center gap-1">
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{
                        backgroundColor: getDefectColorHex(primaryCategory),
                        boxShadow: `0 0 6px ${getDefectColorHex(primaryCategory)}`
                      }}
                    />
                    <span>{item.detection_count} 处病害</span>
                  </div>
                  <span className="truncate text-white/40">{formatTime(item.created_at)}</span>
                </div>
              </div>
            ) : (
              <>
                {/* Categories */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {item.categories.slice(0, 3).map((category) => (
                    <span
                      key={category}
                      className="rounded-full px-2 py-0.5 text-[9px] font-medium border"
                      style={{
                        backgroundColor: `${getDefectColorHex(category)}20`,
                        borderColor: `${getDefectColorHex(category)}40`,
                        color: getDefectColorHex(category)
                      }}
                    >
                      {category}
                    </span>
                  ))}
                  {item.categories.length > 3 && (
                    <span className="rounded-full px-2 py-0.5 text-[9px] text-white/40 bg-white/5 border border-white/10">
                      +{item.categories.length - 3}
                    </span>
                  )}
                </div>

                <h3 
                  className="text-base font-medium text-white mb-1 truncate"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
                >
                  {item.image_id.length > 30 
                    ? item.image_id.slice(0, 30) + "..." 
                    : item.image_id}
                </h3>

                <div className="flex items-center gap-3 text-white/50">
                  <div className="flex items-center gap-1">
                    <span 
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ 
                        backgroundColor: getDefectColorHex(primaryCategory),
                        boxShadow: `0 0 6px ${getDefectColorHex(primaryCategory)}`
                      }}
                    />
                    <span className="text-xs">{item.detection_count} 处病害</span>
                  </div>
                  <span className="text-[10px] opacity-50">·</span>
                  <span className="text-[10px]">{formatTime(item.created_at)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
