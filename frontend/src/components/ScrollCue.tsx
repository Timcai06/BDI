"use client";

import { motion } from "framer-motion";

export function ScrollCue() {
  return (
    <motion.div 
      className="fixed bottom-8 right-6 sm:right-10 z-[100] flex flex-col items-center gap-3 pointer-events-none"
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: 1 
      }}
      transition={{ delay: 1, duration: 0.6, ease: "easeOut" }}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/40 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        Scroll
      </span>

      <div className="relative flex h-[42px] w-[26px] justify-center rounded-full border border-white/10 bg-black/20 shadow-[0_0_20px_rgba(0,0,0,0.5),inset_0_0_15px_rgba(255,255,255,0.02)] backdrop-blur-xl">
        <div className="absolute top-[4px] h-[34px] w-[1px] bg-gradient-to-b from-white/20 to-transparent" />
        <motion.div
          className="absolute top-[6px] h-[6px] w-[2px] rounded-full bg-[#00d992] shadow-[0_0_8px_rgba(0,217,146,0.8)] animate-pulse"
          animate={{
            y: [0, 20, 0],
            opacity: [1, 0, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
    </motion.div>
  );
}
