"use client";

/**
 * PageSkeleton — 通用页面骨架屏组件
 * 确保页面在数据加载完成前就有与最终布局一致的视觉占位，
 * 消除"空白帧 → 内容弹入"的闪烁。
 */

interface PageSkeletonProps {
  /**
   * 骨架变体：
   * - overview: 4 指标卡 + 大面板
   * - table: 表头 + 6 行列表
   * - grid: 左右双列卡片
   * - detail: 全宽详情面板
   */
  variant?: "overview" | "table" | "grid" | "detail";
}

function SkeletonBar({ width = "w-24", height = "h-3" }: { width?: string; height?: string }) {
  return <div className={`skeleton-bar ${width} ${height}`} />;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton-pulse ${className}`} />;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      {/* Metric cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
            <SkeletonBar width="w-20" height="h-2" />
            <SkeletonBar width="w-16" height="h-6" />
            <SkeletonBar width="w-full" height="h-1" />
            <SkeletonBar width="w-32" height="h-2" />
          </div>
        ))}
      </div>
      {/* Large panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <SkeletonBlock className="lg:col-span-8 h-[320px]" />
        <SkeletonBlock className="lg:col-span-4 h-[320px]" />
      </div>
      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {[...Array(3)].map((_, i) => (
          <SkeletonBlock key={i} className="h-[200px]" />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-8 px-6 py-4 border-b border-white/5">
          <SkeletonBar width="w-8" height="h-3" />
          <SkeletonBar width="w-40" height="h-3" />
          <SkeletonBar width="w-20" height="h-3" />
          <SkeletonBar width="w-16" height="h-3" />
        </div>
        {/* Table rows */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-8 px-6 py-5 border-b border-white/[0.03]">
            <SkeletonBar width="w-6" height="h-3" />
            <div className="flex items-center gap-3 flex-1">
              <SkeletonBlock className="h-10 w-10 !rounded-xl shrink-0" />
              <div className="space-y-2 flex-1">
                <SkeletonBar width="w-40" height="h-3" />
                <SkeletonBar width="w-24" height="h-2" />
              </div>
            </div>
            <SkeletonBar width="w-16" height="h-5" />
            <SkeletonBar width="w-8" height="h-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <SkeletonBlock className="min-h-[480px]" />
      <SkeletonBlock className="min-h-[480px]" />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-[120px]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonBlock className="h-[300px]" />
        <SkeletonBlock className="h-[300px]" />
      </div>
    </div>
  );
}

export function PageSkeleton({ variant = "overview" }: PageSkeletonProps) {
  const content = (() => {
    switch (variant) {
      case "overview":
        return <OverviewSkeleton />;
      case "table":
        return <TableSkeleton />;
      case "grid":
        return <GridSkeleton />;
      case "detail":
        return <DetailSkeleton />;
    }
  })();

  return (
    <div className="page-enter">
      {content}
    </div>
  );
}
