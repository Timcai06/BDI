"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export function RecognitionSimulator() {
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative w-full max-w-lg aspect-video rounded-3xl overflow-hidden border border-white/10 bg-[#05070a] shadow-2xl">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
      
      {/* Image Simulation */}
      <div className="absolute inset-0 flex items-center justify-center">
         <div className="w-[80%] h-[70%] border border-white/5 bg-[#0a111b] relative overflow-hidden rounded-lg">
            {/* Mock Bridge SVG */}
            <svg viewBox="0 0 400 200" className="w-full h-full opacity-40">
               <path d="M50 150 L350 150 M100 150 L100 100 L300 100 L300 150" stroke="white" strokeWidth="2" fill="none" />
               <path d="M100 100 Q200 50 300 100" stroke="white" strokeWidth="1" fill="none" strokeDasharray="4 4" />
            </svg>

            {/* Scanning Line */}
            <motion.div 
               className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#63e6ff] to-transparent shadow-[0_0_15px_rgba(99,230,255,0.8)] z-10"
               animate={{ top: ["0%", "100%", "0%"] }}
               transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />

            {/* Detections */}
            <AnimatePresence>
              {step >= 1 && (
                <motion.div 
                  key="detection-crack"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-[110px] left-[180px] w-12 h-8 border border-red-500/50 bg-red-500/10 rounded flex items-center justify-center"
                >
                  <span className="text-[8px] text-red-400 font-mono">CRACK</span>
                </motion.div>
              )}
              {step >= 2 && (
                <motion.div 
                  key="detection-spalling"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-[80px] left-[120px] w-16 h-10 border border-[#63e6ff]/50 bg-[#63e6ff]/10 rounded flex items-center justify-center"
                >
                  <span className="text-[8px] text-[#63e6ff] font-mono">SPALLING</span>
                </motion.div>
              )}
            </AnimatePresence>
         </div>
      </div>

      {/* Floating UI Elements */}
      <div className="absolute top-4 left-6 flex items-center gap-2">
         <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
         <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Live Recognition</span>
      </div>

      <div className="absolute bottom-4 right-6 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full">
         <span className="text-[10px] text-[#63e6ff] font-mono tracking-tighter">Confidence: 0.982</span>
      </div>
    </div>
  );
}
