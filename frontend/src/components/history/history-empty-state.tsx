"use client";

interface HistoryEmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  onUpload: () => void;
}

export function HistoryEmptyState({ hasFilters, onClearFilters, onUpload }: HistoryEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="rounded-2xl border border-white/[0.04] bg-[#030303] p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-lg font-light text-white/70 mb-2">未找到匹配的记录</p>
        <p className="text-sm text-white/40 mb-6">尝试调整搜索条件或筛选器</p>
        <button
          onClick={onClearFilters}
          className="px-4 py-2 rounded-lg border border-white/20 bg-white/10 text-xs font-medium text-white hover:bg-white/20 transition-colors"
        >
          清除筛选
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.04] bg-[#030303] p-12 text-center">
      <div className="relative w-20 h-20 mx-auto mb-6">
        {/* Animated rings */}
        <div className="absolute inset-0 rounded-full border border-sky-500/20 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="absolute inset-2 rounded-full border border-sky-500/10 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
        
        {/* Icon */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center">
          <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      
      <p className="text-xl font-light text-white mb-3">暂无分析记录</p>
      <p className="text-sm text-white/40 mb-8 max-w-sm mx-auto">
        上传桥梁巡检图像，AI 将自动识别裂缝、破损、梳齿缺陷、孔洞、钢筋外露与渗水并生成检测报告
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onUpload}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sm font-medium text-sky-300 hover:bg-sky-500/30 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          开始首次分析
        </button>
        
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span className="w-6 h-px bg-white/10" />
          或
          <span className="w-6 h-px bg-white/10" />
        </div>
        
        <span className="text-xs text-white/30">
          拖拽图片到上传区域
        </span>
      </div>
      
      {/* Feature hints */}
      <div className="mt-10 grid grid-cols-3 gap-4 max-w-md mx-auto">
        {[
          { icon: "⚡", label: "快速识别", desc: "118ms 平均耗时" },
          { icon: "🎯", label: "精准检测", desc: "AI 自动标注" },
          { icon: "📊", label: "导出报告", desc: "一键生成结果" }
        ].map((feature) => (
          <div key={feature.label} className="text-center">
            <div className="text-lg mb-1">{feature.icon}</div>
            <div className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{feature.label}</div>
            <div className="text-[10px] text-white/30">{feature.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
