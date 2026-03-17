"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface GlowingCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "standard" | "premium";
}

export function GlowingCard({ children, className = "", delay = 0, variant = "standard" }: GlowingCardProps) {
  return (
    <motion.div
      className={`relative group overflow-hidden rounded-[24px] border border-white/[0.08] transition-all duration-500 ${
        variant === "premium" 
          ? "bg-[linear-gradient(180deg,rgba(10,18,34,0.7),rgba(5,10,20,0.5))] backdrop-blur-[24px] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.5)]" 
          : "bg-[linear-gradient(180deg,rgba(9,14,24,0.9),rgba(4,8,16,0.78))] backdrop-blur-2xl"
      } hover:border-[#86c5ff]/40 hover:shadow-[0_40px_100px_-10px_rgba(5,16,32,0.45)] ${className}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ 
        duration: 0.7, 
        delay,
        ease: [0.22, 1, 0.36, 1]
      }}
      whileHover={{ 
        y: -6,
        transition: { duration: 0.4, ease: "easeOut" }
      }}
      style={{ willChange: "transform, opacity" }}
    >
      {/* Premium Inner Glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,0%),rgba(99,230,255,0.1),transparent_60%)]" />
      </div>

      {/* Top Edge Highlight */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(163,223,255,0.8),transparent)] opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Border Gradient Overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-[24px] border border-transparent [mask-image:linear-gradient(white,white)] before:absolute before:inset-0 before:rounded-[24px] before:border before:border-white/10 before:content-[''] group-hover:before:border-white/20 transition-all duration-500" />

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
      className={`relative group overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(9,14,24,0.9),rgba(4,8,16,0.78))] backdrop-blur-2xl transition-all duration-300 hover:border-[#86c5ff]/20 hover:shadow-[0_24px_80px_rgba(5,16,32,0.35)] ${className}`}
      style={{ 
        willChange: "auto",
        transform: "translateZ(0)" // 强制 GPU 层
      }}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(153,213,255,0.7),transparent)] opacity-70" />
      <div className="relative z-10 p-8 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}
