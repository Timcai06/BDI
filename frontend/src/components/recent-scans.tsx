"use client";

import { useMemo } from "react";
import { getDefectColorHex, getDefectLabel } from "@/lib/defect-visuals";
import type { PredictionHistoryItem } from "@/lib/types";
import { formatModelLabel } from "@/lib/model-labels";

interface RecentScansProps {
  items: PredictionHistoryItem[];
  maxItems?: number;
  onSelect: (imageId: string) => void;
  onViewAll: () => void;
}

export function RecentScans({ items, maxItems = 5, onSelect, onViewAll }: RecentScansProps) {
  const recentItems = useMemo(() => {
    return items.slice(0, maxItems);
  }, [items, maxItems]);

  if (recentItems.length === 0) {
    return (
      <div className="rounded-[20px] border border-white/[0.04] bg-[#030303] p-6 shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            最近记录
          </p>
        </div>
        <div className="py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-white/40">暂无分析记录</p>
          <p className="text-xs text-white/25 mt-1">上传图片开始首次分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-white/[0.04] bg-[#030303] p-5 shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          最近记录
        </p>
        <button
          onClick={onViewAll}
          className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
        >
          查看全部
        </button>
      </div>

      <div className="space-y-2">
        {recentItems.map((item) => (
          <button
            key={item.image_id}
            onClick={() => onSelect(item.image_id)}
            className="w-full group flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-white/[0.08] bg-transparent hover:bg-white/[0.03] transition-all duration-200 text-left"
          >
            {/* Thumbnail placeholder */}
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center overflow-hidden">
              <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-white/30">
                  {formatModelLabel({ 
                    model_name: item.model_name, 
                    model_version: item.model_version 
                  })}
                </span>
                <span className="w-1 h-1 rounded-full bg-white/10" />
                <span className="text-[10px] font-mono text-white/30">
                  {item.inference_ms}ms
                </span>
              </div>
            </div>

            {/* Detection count badge */}
            {item.detection_count > 0 && (
              <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/[0.05] border border-white/[0.06]">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: getDefectColorHex(item.categories[0] || "default"),
                    boxShadow: `0 0 6px ${getDefectColorHex(item.categories[0] || "default")}`
                  }}
                />
                <span className="text-[10px] font-medium text-white/70">
                  {getDefectLabel(item.categories[0] || "default")} · {item.detection_count} 处
                </span>
              </div>
            )}

            {/* Arrow */}
            <svg 
              className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
