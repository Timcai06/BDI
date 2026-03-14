"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface GlowingCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function GlowingCard({ children, className = "", delay = 0 }: GlowingCardProps) {
  return (
    <motion.div
      className={`relative group overflow-hidden rounded-[24px] bg-black/40 backdrop-blur-2xl border border-white/5 transition-colors duration-500 hover:border-white/20 hover:bg-white/[0.02] ${className}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ 
        duration: 0.5, 
        delay,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      whileHover={{ 
        scale: 1.01,
        transition: { duration: 0.3 }
      }}
      style={{ willChange: "transform, opacity" }}
    >
      {/* Edge Lit Highlight Effect - 使用 GPU 加速 */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 pointer-events-none"
        initial={false}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ willChange: "opacity" }}
      />
      
      {/* 微妙的内部光晕 */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
      </div>
      
      {/* Content wrapper */}
      <div className="relative z-10 p-8 h-full flex flex-col">
        {children}
      </div>
    </motion.div>
  );
}

// 高性能版本 - 用于长列表
interface LightweightCardProps {
  children: ReactNode;
  className?: string;
}

export function LightweightCard({ children, className = "" }: LightweightCardProps) {
  return (
    <div
      className={`relative group overflow-hidden rounded-[24px] bg-black/40 backdrop-blur-2xl border border-white/5 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.02] ${className}`}
      style={{ 
        willChange: "auto",
        transform: "translateZ(0)" // 强制 GPU 层
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="relative z-10 p-8 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}
