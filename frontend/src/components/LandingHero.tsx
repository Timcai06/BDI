"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// 动画配置
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number]
    }
  }
};

// 背景流体形状动画
const floatAnimation = {
  y: [0, -15, 0],
  rotate: [-8, -6, -8],
  transition: {
    duration: 8,
    repeat: Infinity,
    ease: "easeInOut" as const
  }
};

const floatAnimation2 = {
  y: [0, -12, 0],
  rotate: [12, 14, 12],
  transition: {
    duration: 10,
    repeat: Infinity,
    ease: "easeInOut" as const,
    delay: 1
  }
};

const floatAnimation3 = {
  y: [0, -18, 0],
  rotate: [-4, -2, -4],
  transition: {
    duration: 12,
    repeat: Infinity,
    ease: "easeInOut" as const,
    delay: 2
  }
};

export function LandingHero() {
  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden py-20">
      {/* Floating Background Shapes */}
      <motion.div 
        className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
      >
        {/* Left fluid shape */}
        <motion.div 
          className="absolute top-[5%] left-[-10%] w-[50vw] max-w-[700px] h-[45%] rounded-[80px] overflow-hidden rotate-[-8deg] opacity-70 mix-blend-screen filter blur-[10px]"
          style={{ willChange: "transform" }}
          animate={floatAnimation}
        >
          <div className="w-full h-full bg-gradient-to-br from-[#101528] via-[#1a233a] to-[#0A0D15] border border-white/5" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_20%,rgba(66,133,244,0.4),transparent_60%)]" />
        </motion.div>
        
        {/* Right fluid shape */}
        <motion.div 
          className="absolute top-[15%] right-[-10%] w-[55vw] max-w-[800px] h-[40%] rounded-[100px] overflow-hidden rotate-[12deg] opacity-60 mix-blend-screen filter blur-[14px]"
          style={{ willChange: "transform" }}
          animate={floatAnimation2}
        >
          <div className="w-full h-full bg-gradient-to-tl from-[#120e1e] via-[#1e1533] to-[#0A0D15] border border-white/5" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(160,110,225,0.4),transparent_60%)]" />
        </motion.div>
        
        {/* Bottom grounding shape */}
        <motion.div 
          className="absolute bottom-[10%] left-[5%] w-[60vw] max-w-[900px] h-[35%] rounded-[120px] overflow-hidden rotate-[-4deg] opacity-50 mix-blend-screen filter blur-[18px]"
          style={{ willChange: "transform" }}
          animate={floatAnimation3}
        >
          <div className="w-full h-full bg-gradient-to-t from-[#0b1f28] via-[#113142] to-[#0A0D15] border border-white/5" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,210,255,0.3),transparent_70%)]" />
        </motion.div>
      </motion.div>

      {/* Background glow */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <div className="w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-[120px]" />
      </motion.div>

      {/* Main Content - 增加垂直padding确保空间充足 */}
      <motion.div 
        className="relative z-10 flex flex-col items-center text-center px-4 max-w-5xl mx-auto py-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Badge */}
        <motion.div variants={itemVariants} className="mb-5">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] sm:text-xs font-medium tracking-wider uppercase text-white/50">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            AI-Powered Bridge Inspection
          </span>
        </motion.div>

        {/* BDI Title */}
        <motion.div 
          className="relative"
          variants={itemVariants}
        >
          <h1 
            className="text-[10rem] sm:text-[14rem] md:text-[18rem] lg:text-[20rem] font-bold tracking-tighter leading-[0.9] select-none"
            style={{
              backgroundImage: "linear-gradient(110deg, #FFFFFF 0%, #A06EE1 25%, #4285F4 50%, #FFFFFF 75%, #A06EE1 100%)",
              backgroundSize: "200% auto",
              color: "transparent",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              animation: "text-flow 8s ease infinite"
            }}
          >
            BDI
          </h1>
        </motion.div>
        
        {/* Subtitle - 与BDI保持适当距离 */}
        <motion.p 
          className="text-xs sm:text-sm tracking-[0.4em] text-white/30 uppercase mt-4 mb-8"
          variants={itemVariants}
        >
          Infrastructure Scan Intelligence
        </motion.p>

        {/* Description - 独立区块，间距充足 */}
        <motion.div 
          className="mb-10"
          variants={itemVariants}
        >
          <p className="text-xl sm:text-2xl md:text-3xl text-white/80 font-light mb-3">
            桥梁病害智能判读系统
          </p>
          <p className="text-sm sm:text-base text-white/40 max-w-lg mx-auto">
            从图像上传到报告导出的一站式 AI 巡检解决方案
          </p>
        </motion.div>

        {/* CTA Buttons - 与描述保持间距 */}
        <motion.div 
          className="flex flex-col sm:flex-row items-center gap-4"
          variants={itemVariants}
        >
          <Link
            href="/dashboard"
            className="group relative inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-8 text-sm font-semibold tracking-wide text-white transition-all duration-300 hover:shadow-[0_0_40px_rgba(66,133,244,0.4)] hover:scale-105 hover:from-blue-500 hover:to-purple-500"
          >
            开始免费试用
            <svg
              className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>

          <Link
            href="#features"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/5 border border-white/20 px-8 text-sm font-semibold tracking-wide text-white/80 transition-all duration-300 hover:bg-white/10 hover:border-white/40 hover:text-white"
          >
            了解更多
          </Link>
        </motion.div>
      </motion.div>

      {/* Scroll Indicator - 固定在底部，与内容区完全分离 */}
      <motion.div 
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <span className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-medium">
          Scroll
        </span>
        
        <div className="relative w-5 h-8">
          <motion.svg
            className="w-5 h-5 text-white/50 absolute"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            animate={{ 
              y: [0, 6, 0],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ 
              duration: 1.6, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </motion.svg>
          
          <motion.svg
            className="w-5 h-5 text-white/25 absolute top-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            animate={{ 
              y: [0, 6, 0],
              opacity: [0.25, 0.6, 0.25]
            }}
            transition={{ 
              duration: 1.6, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 0.25
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </motion.svg>
        </div>
      </motion.div>
    </section>
  );
}
