"use client";
import React from "react";
import { motion } from "framer-motion";

export function OpsWorkbenchSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* 顶部仪表盘概览骨架 */}
      <section className="overflow-hidden rounded-[2.5rem] border border-white/5 bg-white/[0.02] shadow-xl">
        <div className="flex w-full items-center justify-between px-8 py-6">
          <div className="grid flex-1 gap-8 md:grid-cols-4 lg:grid-cols-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-2 w-12 rounded-full bg-white/5" />
                <div className="h-4 w-24 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
          <div className="h-6 w-6 rounded-full bg-white/5" />
        </div>

        <div className="grid gap-6 border-t border-white/5 px-8 py-8 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-[2rem] border border-white/5 bg-white/[0.03] p-6 shadow-inner"
            >
              <div className="mb-6 h-2 w-16 rounded-full bg-white/5" />
              <div className="space-y-4">
                <div className="h-8 w-full rounded-xl bg-white/[0.03]" />
                <div className="h-8 w-2/3 rounded-xl bg-white/[0.03]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 列表区域骨架 */}
      <section className="rounded-[2.5rem] border border-white/5 bg-white/[0.02] shadow-2xl overflow-hidden">
        <div className="px-8 py-8 border-b border-white/5 flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-4 w-32 rounded-full bg-white/10" />
            <div className="h-2 w-48 rounded-full bg-white/5" />
          </div>
          <div className="flex gap-3">
             <div className="h-10 w-48 rounded-xl bg-white/5" />
             <div className="h-10 w-32 rounded-xl bg-white/5" />
          </div>
        </div>
        <div className="p-8 space-y-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4 border-b border-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/5" />
                <div className="space-y-2">
                   <div className="h-3 w-40 rounded-full bg-white/10" />
                   <div className="h-2 w-24 rounded-full bg-white/5" />
                </div>
              </div>
              <div className="h-4 w-20 rounded-full bg-white/5" />
              <div className="h-8 w-24 rounded-xl bg-white/5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
