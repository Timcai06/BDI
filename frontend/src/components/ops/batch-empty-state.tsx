"use client";

import { motion } from "framer-motion";

interface BatchEmptyStateProps {
  onCreateClick: () => void;
}

export function BatchEmptyState({ onCreateClick }: BatchEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[500px] flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] p-12 text-center backdrop-blur-xl"
    >
      <div className="relative mb-8">
        {/* Animated background glow */}
        <div className="absolute inset-0 -z-10 animate-pulse-slow bg-cyan-500/20 blur-[60px]" />
        
        {/* Central Icon Illustration */}
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-transparent shadow-2xl">
          <svg className="h-10 w-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      </div>

      <h2 className="mb-3 text-2xl font-light tracking-tight text-white">暂未选择扫描批次</h2>
      <p className="mb-8 max-w-md text-sm leading-relaxed text-white/40">
        巡检工作台需要先选择一个已有的批次进行分析。您可以从下方列表选择，
        或者通过点击右侧按钮新建一个批次并导入无人机巡检素材。
      </p>

      <div className="flex gap-4">
        <button
          onClick={onCreateClick}
          className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-cyan-500 px-8 py-3.5 text-sm font-bold tracking-widest uppercase text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_32px_rgba(6,182,212,0.4)]"
        >
          <span className="relative z-10">新建巡检批次</span>
          <svg className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Quick context info */}
      <div className="mt-12 grid grid-cols-3 gap-8 border-t border-white/5 pt-12">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/60">Step 1</p>
          <p className="mt-1 text-xs text-white/35">选择/创建桥梁</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/60">Step 2</p>
          <p className="mt-1 text-xs text-white/35">定义批次细节</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/60">Step 3</p>
          <p className="mt-1 text-xs text-white/35">批量导入扫描素材</p>
        </div>
      </div>
    </motion.div>
  );
}
