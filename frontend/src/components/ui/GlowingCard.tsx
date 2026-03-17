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
      className={`relative group overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(9,14,24,0.9),rgba(4,8,16,0.78))] backdrop-blur-2xl transition-all duration-500 hover:border-[#86c5ff]/20 hover:bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(5,10,18,0.84))] hover:shadow-[0_24px_80px_rgba(5,16,32,0.35)] ${className}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      whileHover={{
        y: -4,
        transition: { duration: 0.3 },
      }}
      style={{ willChange: "transform, opacity" }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(99,230,255,0.12),transparent_32%,transparent_68%,rgba(77,141,255,0.08))] opacity-0"
        initial={false}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ willChange: "opacity" }}
      />

      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(153,213,255,0.7),transparent)] opacity-70" />

      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,230,255,0.08),transparent_52%)]" />
      </div>

      <div className="relative z-10 p-8 h-full flex flex-col">{children}</div>
    </motion.div>
  );
}

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
        transform: "translateZ(0)",
      }}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(153,213,255,0.7),transparent)] opacity-70" />
      <div className="relative z-10 p-8 h-full flex flex-col">{children}</div>
    </div>
  );
}
