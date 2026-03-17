"use client";

import { motion } from "framer-motion";

interface ScrollCueProps {
  href: string;
  label: string;
  caption?: string;
  align?: "right" | "center";
  className?: string;
}

export function ScrollCue({
  href,
  label,
  caption = "Scroll",
  align = "right",
  className = ""
}: ScrollCueProps) {
  return (
    <a
      href={href}
      className={`fixed right-6 top-[60%] z-40 hidden flex-col items-center gap-6 md:flex transition-all duration-300 hover:opacity-100 opacity-60 ${className}`}
    >
      {/* Vertical Label */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-[10px] whitespace-nowrap uppercase tracking-[0.5em] text-white/40 [writing-mode:vertical-lr] rotate-180">
          {caption} — {label}
        </span>
      </div>

      {/* Vertical Line Indicator */}
      <div className="relative h-24 w-[1px] bg-gradient-to-b from-white/20 via-white/10 to-transparent">
        <motion.div
          className="absolute top-0 left-1/2 h-8 w-[2px] -translate-x-1/2 bg-[#63e6ff] shadow-[0_0_8px_rgba(99,230,255,0.6)]"
          animate={{
            y: [0, 64, 0],
            opacity: [0.4, 1, 0.4]
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
    </a>
  );
}
