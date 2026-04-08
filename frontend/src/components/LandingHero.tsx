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
          <span className="inline-flex items-center gap-2 rounded-full border border-[#3d3a39] bg-[#101010]/80 px-3 py-1.5 text-[10px] font-mono font-medium uppercase tracking-[0.28em] text-[#b8b3b0] sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d992] shadow-[0_0_8px_rgba(0,217,146,0.8)] animate-pulse" />
            Live Inference System
          </span>
        </motion.div>

        <motion.div className="relative mb-4" variants={itemVariants}>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <h1
              className="select-none text-[5.5rem] font-semibold leading-none tracking-[-0.08em] text-white/[0.05] sm:text-[7.5rem] md:text-[9rem] lg:text-[11rem]"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, rgba(255,255,255,0.05), rgba(0,217,146,0.15), rgba(0,217,146,0.05))",
                color: "transparent",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              BDI
            </h1>
          </div>

          <div className="relative mx-auto max-w-4xl px-6 py-7 sm:px-10">
            <div className="mb-5 flex flex-wrap items-center justify-center gap-4 text-[10px] uppercase tracking-[0.3em] text-white/30">
              <span>Vision AI</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Diagnostics</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Export</span>
            </div>

            <h2 className="mx-auto max-w-5xl text-7xl md:text-8xl lg:text-[7.5rem] font-black leading-[1.0] text-[#f2f2f2] mb-2 flex flex-col items-center tracking-[-0.65px] drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
              从 见 到 知
              <div className="h-[3rem] md:h-[5rem] relative overflow-hidden flex items-center justify-center mt-6">
                <GenerativeText 
                    text="EVOLVED." 
                    delay={1.5} 
                    gradient={false}
                    className="block font-black text-5xl md:text-7xl tracking-[0.4em] text-[#00d992] uppercase opacity-100 filter drop-shadow-[0_0_8px_rgba(0,217,146,0.8)]"
                />
              </div>
            </h2>
          </div>
        </motion.div>

        <motion.div className="flex flex-col items-center gap-6 sm:flex-row mt-14" variants={itemVariants}>
          <Link
            href="/dashboard"
            className="group relative inline-flex h-16 items-center justify-center gap-4 rounded-full border border-[#3d3a39] bg-[#101010] px-14 text-[15px] font-bold tracking-[0.2em] uppercase text-[#2fd6a1] transition-all duration-300 hover:border-[#00d992] hover:shadow-[0_0_30px_rgba(0,217,146,0.3)] hover:-translate-y-1"
          >
            Launch Console
            <svg
              className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </motion.div>

        <motion.div className="mt-24 flex flex-wrap justify-center w-full max-w-5xl gap-x-20 gap-y-10 text-left" variants={itemVariants}>
          {[
            { label: "Inference", value: "Sub-second" },
            { label: "Review", value: "Human In Loop" },
            { label: "Output", value: "JSON Ready" },
          ].map((item, index) => (
            <div key={item.label} className="relative flex flex-col pt-5 w-48">
              <div className="absolute top-0 left-0 w-12 h-[2px] bg-gradient-to-r from-[#00d992]/80 to-transparent" />
              <p className="mb-4 text-[10px] uppercase tracking-[0.5em] text-[#8b949e] font-mono font-bold">{item.label}</p>
              <p className="text-3xl font-light text-[#f2f2f2] tracking-widest whitespace-nowrap drop-shadow-lg">
                <GenerativeText text={item.value} delay={index * 0.2 + 2} />
              </p>
            </div>
          ))}
        </motion.div>

        {/* Terminal & HUD Montage Presentation */}
        <motion.div 
          className="mt-32 w-full max-w-5xl relative z-20 hidden md:block group mx-auto h-[600px]"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Deep Ambient Glow */}
          <div className="absolute inset-20 bg-gradient-to-t from-[#00d992]/5 to-transparent blur-[120px] rounded-[100%] transition-opacity duration-1000 group-hover:from-[#00d992]/15 pointer-events-none" />
          
          {/* Live Code Terminal Base Layer */}
          <div className="absolute left-[8%] top-[20px] w-[540px] h-[480px] rounded-xl border border-[#3d3a39] bg-[#050507] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.9)] transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-4 group-hover:-translate-x-4 z-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-3 h-3 rounded-full bg-[#3d3a39]" />
              <div className="w-3 h-3 rounded-full bg-[#3d3a39]" />
              <div className="w-3 h-3 rounded-full bg-[#3d3a39]" />
              <span className="ml-4 text-[10px] uppercase tracking-[0.2em] font-mono text-[#8b949e]">inference_engine.js</span>
            </div>
            <pre className="font-mono text-[13px] leading-loose overflow-hidden text-[#8b949e]">
              <code className="block">
                <span className="text-[#818cf8]">await</span> {"System.initialize({"}<br/>
                {"  "}model: <span className="text-[#00d992]">'bdi-yolo-v9-pro'</span>,<br/>
                {"  "}precision: <span className="text-[#00d992]">'fp16_tensor'</span>,<br/>
                {"  "}focus: <span className="text-[#00d992]">'crack_detection'</span><br/>
                {"});"}<br/><br/>
                <span className="text-[#818cf8]">const</span> result = <span className="text-[#818cf8]">await</span> {"Vision.analyze(feed);"}<br/><br/>
                {"console.log("}<br/>
                {"  "}<span className="text-[#00d992]">`[INF] Anomaly Score: </span>{"${result.score}"}<span className="text-[#00d992]">`</span><br/>
                {");"}<br/>
                <span className="text-[#00d992] block mt-6 opacity-90 drop-shadow-[0_0_8px_rgba(0,217,146,0.6)]">
                  {">"} Scanning structures...<br/>
                  {">"} Anomaly [C-12] matches risk profile [99.8%]<br/>
                  {">"} Alert dispatched to queue.<span className="animate-pulse inline-block w-2.5 h-[1.1em] bg-[#00d992] ml-1.5 align-middle translate-y-[2px]" />
                </span>
              </code>
            </pre>
          </div>

          {/* Authentic Core UI HUD Layer */}
          <div className="absolute right-[8%] top-[120px] w-[500px] rounded-xl border border-[#3d3a39] bg-[#101010] shadow-[0_40px_100px_rgba(0,0,0,0.95)] transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-4 group-hover:translate-x-4 group-hover:shadow-[0_40px_120px_rgba(0,217,146,0.15)] group-hover:border-[#00d992]/40 z-20 overflow-hidden">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-[#00d992]/10 via-transparent to-transparent pointer-events-none mix-blend-overlay" />
            <img 
              src="/assets/bdi-defect-hud.png" 
              alt="Authentic AI HUD" 
              className="relative w-full h-auto object-cover opacity-90"
            />
          </div>
        </motion.div>
      </motion.div>

    </section>
  );
}
