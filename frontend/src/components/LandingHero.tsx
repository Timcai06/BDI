"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GenerativeText } from "@/components/ui/GenerativeText";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  },
};

const floatAnimation = {
  y: [0, -15, 0],
  rotate: [-8, -6, -8],
  transition: {
    duration: 8,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

const floatAnimation2 = {
  y: [0, -12, 0],
  rotate: [12, 14, 12],
  transition: {
    duration: 10,
    repeat: Infinity,
    ease: "easeInOut" as const,
    delay: 1,
  },
};

const floatAnimation3 = {
  y: [0, -18, 0],
  rotate: [-4, -2, -4],
  transition: {
    duration: 12,
    repeat: Infinity,
    ease: "easeInOut" as const,
    delay: 2,
  },
};

export function LandingHero() {
  return (
    <section className="relative flex min-h-[84vh] w-full flex-col items-center justify-center overflow-hidden py-16">
      <motion.div
        className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
      >
        <motion.div
          className="absolute top-[5%] left-[-10%] h-[45%] w-[50vw] max-w-[700px] rotate-[-8deg] overflow-hidden rounded-[80px] opacity-[0.15] mix-blend-screen blur-[20px]"
          style={{ willChange: "transform" }}
          animate={floatAnimation}
        >
          <div className="h-full w-full border border-white/5 bg-gradient-to-br from-[#0a1122] via-[#13203d] to-[#05070d]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_20%,rgba(77,141,255,0.45),transparent_58%)]" />
        </motion.div>

        <motion.div
          className="absolute top-[14%] right-[-10%] h-[40%] w-[55vw] max-w-[800px] rotate-[12deg] overflow-hidden rounded-[100px] opacity-[0.12] mix-blend-screen blur-[24px]"
          style={{ willChange: "transform" }}
          animate={floatAnimation2}
        >
          <div className="h-full w-full border border-white/5 bg-gradient-to-tl from-[#091321] via-[#12263a] to-[#05070d]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(99,230,255,0.28),transparent_60%)]" />
        </motion.div>

        <motion.div
          className="absolute bottom-[10%] left-[5%] h-[35%] w-[60vw] max-w-[900px] rotate-[-4deg] overflow-hidden rounded-[120px] opacity-10 mix-blend-screen blur-[30px]"
          style={{ willChange: "transform" }}
          animate={floatAnimation3}
        >
          <div className="h-full w-full border border-white/5 bg-gradient-to-t from-[#081520] via-[#0f2b3f] to-[#05070d]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(77,141,255,0.18),transparent_68%)]" />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <div className="h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(99,230,255,0.08),transparent_70%)] blur-[120px]" />
      </motion.div>

      <motion.div
        className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-4 py-6 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="mb-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#63e6ff]/20 bg-[#08111b]/80 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.28em] text-[#d7f7ff]/70 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#63e6ff] shadow-[0_0_12px_rgba(99,230,255,0.8)]" />
            Live Inference System
          </span>
        </motion.div>

        <motion.div className="relative mb-4" variants={itemVariants}>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <h1
              className="select-none text-[5.5rem] font-semibold leading-none tracking-[-0.08em] text-white/[0.05] sm:text-[7.5rem] md:text-[9rem] lg:text-[11rem]"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, rgba(255,255,255,0.08), rgba(77,141,255,0.28), rgba(99,230,255,0.12))",
                color: "transparent",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              BDI
            </h1>
          </div>

          <div className="relative mx-auto max-w-4xl rounded-[32px] border border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-6 py-7 shadow-[0_40px_120px_rgba(0,0,0,0.8)] backdrop-blur-3xl sm:px-10">
            <div className="mb-5 flex flex-wrap items-center justify-center gap-3 text-[11px] uppercase tracking-[0.24em] text-white/45">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Vision AI</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Bridge Diagnostics</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Structured Export</span>
            </div>

            <h2 className="mx-auto max-w-4xl text-4xl font-medium leading-tight text-white sm:text-5xl md:text-[3.2rem] flex flex-col items-center">
              智能判读，从图像到结论
              <div className="h-[1.2em] relative overflow-hidden flex items-center justify-center mt-2">
                <GenerativeText 
                    text="瞬息生成的基建巡检报告" 
                    delay={1.5} 
                    gradient={true}
                    className="block font-medium"
                />
              </div>
            </h2>
          </div>
        </motion.div>

        <motion.p className="mb-6 mt-2 text-xs uppercase tracking-[0.4em] text-white/28 sm:text-sm" variants={itemVariants}>
          Infrastructure Scan Intelligence
        </motion.p>

        <motion.div className="mb-10 text-center" variants={itemVariants}>
          <p className="mx-auto max-w-lg text-[13px] leading-relaxed text-white/40 sm:text-sm">
            搭载自研视觉大模型引擎，彻底抛弃传统的繁杂操作，<br className="hidden sm:block" />只需上传，即刻输出结构化识别结果。
          </p>
        </motion.div>

        <motion.div className="flex flex-col items-center gap-4 sm:flex-row" variants={itemVariants}>
          <Link
            href="/dashboard"
            className="group relative inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#7bb8ff]/30 bg-[linear-gradient(135deg,rgba(77,141,255,0.28),rgba(99,230,255,0.16))] px-8 text-sm font-semibold tracking-[0.14em] text-white transition-all duration-300 hover:border-[#9dd6ff]/50 hover:shadow-[0_0_40px_rgba(77,141,255,0.25)]"
          >
            进入智能工作台
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
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-8 text-sm font-semibold tracking-[0.14em] text-white/78 transition-all duration-300 hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
          >
            查看系统能力
          </Link>
        </motion.div>

        <motion.div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-4 text-center sm:grid-cols-3" variants={itemVariants}>
          {[
            { label: "Inference", value: "Sub-second" },
            { label: "Review", value: "Human In Loop" },
            { label: "Output", value: "JSON Ready" },
          ].map((item, index) => (
            <div
              key={item.label}
              className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] px-4 py-5 backdrop-blur-3xl transition-all hover:bg-white/[0.03]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#63e6ff]/0 via-[#63e6ff]/0 to-[#63e6ff]/[0.05] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/30">{item.label}</p>
              <p className="text-lg font-light text-white">
                <GenerativeText text={item.value} delay={index * 0.2 + 2} />
              </p>
            </div>
          ))}
        </motion.div>
      </motion.div>


    </section>
  );
}
