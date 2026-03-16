"use client";

import { AdaptiveImage } from "@/components/adaptive-image";
import { formatModelLabel } from "@/lib/model-labels";
import type { PredictionHistoryItem } from "@/lib/types";

interface HistoryCardProps {
  item: PredictionHistoryItem;
  isSelected: boolean;
  isBatchMode: boolean;
  deletingImageId: string | null;
  getImageUrl: (imageId: string) => string | null;
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

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    crack: "#ef4444",
    spalling: "#f59e0b", 
    corrosion: "#06b6d4",
    efflorescence: "#8b5cf6",
    default: "#64748b"
  };
  return colors[category.toLowerCase()] || colors.default;
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
  const imageUrl = getImageUrl(item.image_id);

  return (
    <article
      className={`group relative flex w-full flex-col overflow-hidden rounded-2xl bg-[#030303] transition-all duration-300 cursor-pointer border ${
        isSelected
          ? "border-sky-500/50 shadow-[0_0_30px_rgba(56,189,248,0.15)]"
          : "border-white/[0.04] hover:border-white/20 hover:shadow-[0_0_40px_rgba(66,133,244,0.08)]"
      }`}
      onClick={onSelect}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
        {imageUrl ? (
          <AdaptiveImage
            alt={item.image_id}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Selection Checkbox (Batch Mode) */}
        {isBatchMode && (
          <div 
            className="absolute top-3 left-3 z-20"
            onClick={onToggleSelect}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? "bg-sky-500 border-sky-500"
                : "bg-black/40 border-white/30 hover:border-white/50"
            }`}>
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
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
        <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
          {/* Top Metadata */}
          <div className="flex justify-between items-start">
            <span className="rounded-lg bg-black/50 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-sky-400 border border-white/10">
              {formatModelLabel(item)}
            </span>
            <span className="rounded-lg bg-black/50 backdrop-blur-md px-2 py-1 text-[10px] font-mono text-white/60 border border-white/10">
              {item.inference_ms}ms
            </span>
          </div>

          {/* Bottom Content */}
          <div>
            {/* Categories */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {item.categories.slice(0, 3).map((category) => (
                <span
                  key={category}
                  className="rounded-full px-2 py-0.5 text-[9px] font-medium border"
                  style={{
                    backgroundColor: `${getCategoryColor(category)}20`,
                    borderColor: `${getCategoryColor(category)}40`,
                    color: getCategoryColor(category)
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

            {/* Title */}
            <h3 
              className="text-base font-medium text-white mb-1 truncate"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
            >
              {item.image_id.length > 30 
                ? item.image_id.slice(0, 30) + "..." 
                : item.image_id}
            </h3>

            {/* Meta Row */}
            <div className="flex items-center gap-3 text-white/50">
              <div className="flex items-center gap-1">
                <span 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ 
                    backgroundColor: getCategoryColor(item.categories[0] || "default"),
                    boxShadow: `0 0 6px ${getCategoryColor(item.categories[0] || "default")}`
                  }}
                />
                <span className="text-xs">{item.detection_count} 处病害</span>
              </div>
              <span className="text-[10px] opacity-50">·</span>
              <span className="text-[10px]">{formatTime(item.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
