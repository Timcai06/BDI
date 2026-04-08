'use client';

import React from 'react';
import Link from "next/link";
import { motion } from "framer-motion";
import { LandingHero } from "@/components/LandingHero";
import { FeatureMasonry } from "@/components/FeatureMasonry";
import { ScrollCue } from "@/components/ScrollCue";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SpotlightEffect } from "@/lib/animations";
import { ScrollReveal, CountUp, BlurReveal } from "@/lib/animations";
import { LazyLoad } from "@/components/ui/LazyLoad";
import { GlowingCard } from "@/components/ui/GlowingCard";
import { ParticleWave } from "@/components/animations/ParticleWave";
import { UploadIcon, AiIcon, VerifyIcon, ReportIcon } from "@/components/icons/WorkflowIcons";
import { PathologyDetail } from "@/components/ui/PathologyDetail";

// 统计数据
const stats = [
  { value: 98.5, suffix: "%", label: "ACCURACY" },
  { value: 10, suffix: "x", label: "SCALE" },
  { value: 50, suffix: "k+", label: "ASSETS" },
  { value: 24, suffix: "/7", label: "UPTIME" }
];

const diseaseTypes = [
  { 
    name: "Crack", 
    color: "#00d992", 
    pattern: "linear",
    image: "/assets/pathology-crack.png",
    specs: { orientation: "VERTICAL", confidence: "99%", risk: "GUARDED" },
    details: "Structural separation detected via yolov9-tensor. Expansion rate: 0.02mm/yr."
  },
  { 
    name: "Spalling", 
    color: "#FFB54D", 
    pattern: "fragment",
    image: "/assets/pathology-spalling.png",
    specs: { area: "45cm²", severity: "MODERATE", risk: "STABLE" },
    details: "Concrete loss identified. Surface exposure at 12mm depth. Rebar not visible."
  },
  { 
    name: "Corrosion", 
    color: "#FF7A59", 
    pattern: "particle",
    image: "/assets/pathology-corrosion.png",
    specs: { depth: "12mm", risk_score: "HIGH", state: "ACTIVE" },
    details: "Corrosive oxidation detected on rebar [C-01]. High polarization detected."
  },
  { 
    name: "Seepage", 
    color: "#4D8DFF", 
    pattern: "flow",
    image: "/assets/pathology-seepage.png",
    specs: { moisture: "82%", state: "DRIP", risk: "NOMINAL" },
    details: "Moisture gradient tracing active. Localized permeation in secondary soffit."
  }
];

// 工作流程步骤
const workflowSteps = [
  { step: "01", title: "Upload", Icon: UploadIcon },
  { step: "02", title: "Infer", Icon: AiIcon },
  { step: "03", title: "Verify", Icon: VerifyIcon },
  { step: "04", title: "Export", Icon: ReportIcon }
];

export default function LandingPage() {
  const [selectedDisease, setSelectedDisease] = React.useState<null | typeof diseaseTypes[0]>(null);

  return (
    <main className="min-h-screen w-full relative overflow-x-hidden selection:bg-accent/30 selection:text-white">
      {/* 全局鼠标跟随聚光灯效果 */}
      <SpotlightEffect />

      <SiteHeader />
      <ScrollCue />

      {/* 全局大视差粒子引擎背景 */}
      <ParticleWave />
      
      {/* 极简发光叠加层 */}
      <div className="pointer-events-none absolute left-[10%] top-[-10%] h-[60%] w-[60%] rounded-full bg-[radial-gradient(ellipse,rgba(77,141,255,0.06)_0%,rgba(0,0,0,0)_70%)] blur-[150px] mix-blend-screen" />
      <div className="pointer-events-none absolute bottom-[10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-[radial-gradient(ellipse,rgba(99,230,255,0.04)_0%,rgba(0,0,0,0)_70%)] blur-[150px] mix-blend-screen" />

      {/* Full bleed Hero Section */}
      <div className="relative z-10 w-full">
        <LandingHero />
      </div>

      {/* Stats Section - High-Energy Terminal Diagnostics (Atmospheric Variant) */}
      <section className="relative z-10 py-24 border-y border-[#00d992]/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
            {stats.map((stat, index) => (
              <ScrollReveal
                key={stat.label}
                delay={index * 0.15}
                className="relative group"
              >
                {/* Technical Bracket Background */}
                <div className="absolute -inset-4 border border-[#3d3a39]/20 bg-[#101010]/20 opacity-0 group-hover:opacity-100 transition-all duration-700 rounded-lg pointer-events-none" />
                
                <div className="relative flex flex-col items-center">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-2 mb-4 opacity-50 group-hover:opacity-100 transition-opacity">
                     <div className="h-1 w-1 rounded-full bg-[#00d992] animate-pulse" />
                     <span className="font-mono text-[8px] text-[#00d992] tracking-[0.2em] font-bold">STATE: ACTIVE</span>
                  </div>

                  {/* Main Value */}
                  <div className="text-5xl md:text-6xl font-black text-[#f2f2f2] mb-3 tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:text-[#00d992] transition-colors duration-500">
                    <CountUp
                      end={stat.value}
                      suffix={stat.suffix}
                      duration={3}
                      decimals={stat.value % 1 !== 0 ? 1 : 0}
                    />
                  </div>

                  <div className="w-24 h-[1px] bg-[#3d3a39] mb-6 relative overflow-hidden">
                     <motion.div 
                        initial={{ x: "-100%" }}
                        whileInView={{ x: "100%" }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00d992]/60 to-transparent"
                     />
                  </div>

                  <div className="text-[9px] font-mono font-bold text-[#8b949e] uppercase tracking-[0.6em] mb-2">
                    {stat.label}
                  </div>
                  
                  {/* Subtle Sub-label */}
                  <div className="text-[7px] font-mono text-[#00d992]/30 uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-opacity">
                    {">"} Diagnostic_Stream_Verified
                  </div>
                </div>

                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#3d3a39] group-hover:border-[#00d992]/50 transition-colors" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#3d3a39] group-hover:border-[#00d992]/50 transition-colors" />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Disease Types Section - 懒加载 */}
      <LazyLoad
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 py-24"
        placeholder={<div className="h-96 bg-white/5 rounded-3xl animate-pulse" />}
      >
        <section id="features">
          <ScrollReveal className="text-center mb-16 px-4">
             <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#3d3a39] to-[#3d3a39]" />
                <h2 className="text-sm font-mono tracking-[0.6em] uppercase text-[#00d992] font-bold">
                  Pathology_Library
                </h2>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#3d3a39] to-[#3d3a39]" />
             </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {diseaseTypes.map((disease, index) => (
              <ScrollReveal key={disease.name} delay={index * 0.1}>
                  <div 
                    className="group relative flex flex-col items-center cursor-pointer"
                    onClick={() => setSelectedDisease(disease)}
                  >
                    {/* Expansion Background Glow */}
                    <div className="absolute inset-0 bg-[#00d992]/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-all duration-1000 scale-50 group-hover:scale-150 pointer-events-none" />

                    {/* ID Indicator */}
                    <div className="absolute -top-10 left-0 font-mono text-[9px] text-[#8b949e] opacity-40 uppercase tracking-widest">
                      MEM_BLOCK: 0xFD_{index + 101}
                    </div>

                    {/* Technical HUD Graphic: REAL IMAGERY */}
                    <motion.div 
                      className="relative w-full h-56 mb-8 flex items-center justify-center overflow-hidden rounded-xl border border-[#3d3a39]/30 bg-[#050507] group-hover:border-[#00d992]/60 transition-all duration-500 shadow-2xl"
                      whileHover={{ scale: 1.15, rotateY: 5, rotateX: -5 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      {/* Real HD Image Bloom */}
                      <img 
                        src={disease.image} 
                        alt={disease.name} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
                      />
                      
                      {/* Animated Scanner Layer */}
                      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#00d992]/50 to-transparent animate-[shimmer_3s_infinite] opacity-0 group-hover:opacity-100" />
                      
                      {/* HUD Overlays (Labels) */}
                      <div className="absolute bottom-4 left-4 font-mono text-[8px] text-[#00d992] bg-black/80 px-2 py-0.5 border border-[#00d992]/20 opacity-0 group-hover:opacity-100 transition-opacity">
                         LIVE_FEED: ACTIVE
                      </div>

                      {/* Scanning Reticle (Hover Reveal) */}
                      <div className="absolute inset-4 border-[0.5px] border-[#00d992]/0 group-hover:border-[#00d992]/40 transition-all duration-500">
                         <div className="absolute top-0 left-0 w-6 h-6 border-t-[1.5px] border-l-[1.5px] border-[#00d992]" />
                         <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[1.5px] border-r-[1.5px] border-[#00d992]" />
                      </div>
                    </motion.div>
                    
                    <h3 className="text-2xl font-black text-[#f2f2f2] tracking-[-0.05em] uppercase mb-4 transition-colors group-hover:text-[#00d992]">
                      {disease.name}
                    </h3>
                    
                    <div className="flex flex-col gap-1 w-full border-t border-[#3d3a39] pt-4 items-center">
                      <div className="flex justify-between w-full px-2">
                        <span className="font-mono text-[9px] text-[#8b949e] uppercase">Target</span>
                        <span className="font-mono text-[9px] text-[#00d992] uppercase font-bold">{disease.specs.confidence || disease.specs.risk}</span>
                      </div>
                      <div className="flex justify-between w-full px-2">
                        <span className="font-mono text-[9px] text-[#8b949e] uppercase">Scan</span>
                        <span className="font-mono text-[9px] text-[#b8b3b0] uppercase">Analysis_Ready</span>
                      </div>
                    </div>
                  </div>
              </ScrollReveal>
            ))}
          </div>
        </section>
      </LazyLoad>

      {/* Workflow Section - High-End Minimalist Redesign */}
      <LazyLoad>
        <section id="workflow" className="relative z-10 py-64 px-6 max-w-7xl mx-auto">
          <ScrollReveal className="flex flex-col items-center mb-36">
            <div className="inline-block px-4 py-1 border-l-2 border-[#00d992] mb-12">
               <span className="font-mono text-[10px] text-[#8b949e] tracking-[0.6em] uppercase">Pipeline_Orchestration</span>
            </div>
            <h2 className="text-6xl md:text-7xl font-black text-[#f2f2f2] mb-12 tracking-[0.25em] uppercase leading-relaxed text-center">
             <BlurReveal delay={0.1}>从 输 入</BlurReveal>
             <BlurReveal delay={0.4} className="font-thin text-[#8b949e]">到 智 能 输 出</BlurReveal>
          </h2>
            <p className="text-[#8b949e] font-mono text-[9px] tracking-[0.4em] uppercase opacity-40">
               Autonomous diagnostic pipeline trace_02
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-20">
            {workflowSteps.map((item, index) => (
              <ScrollReveal key={item.step} delay={index * 0.15}>
                <div className="relative text-center group cursor-pointer">
                  {/* Step Chip */}
                  <div className="mb-8 inline-flex items-center gap-2 border border-[#3d3a39] bg-[#101010] px-3 py-1 rounded transition-colors group-hover:border-[#00d992]/40">
                    <span className="font-mono text-[9px] text-[#00d992] font-bold">S_{item.step}</span>
                    <div className="w-[1px] h-2 bg-[#3d3a39]" />
                    <span className="font-mono text-[9px] text-[#8b949e] uppercase">L_EXEC</span>
                  </div>

                  <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 transition-all duration-500 text-[#b8b3b0] group-hover:text-[#00d992] relative">
                    <div className="absolute inset-0 rounded-full border border-dashed border-[#3d3a39] group-hover:border-[#00d992]/60 group-hover:scale-125 group-hover:rotate-90 transition-all duration-1000" />
                    <item.Icon className="w-12 h-12 relative z-10" />
                  </div>

                  <h3 className="text-xl font-black uppercase tracking-[-0.02em] text-[#f2f2f2] mb-3 transition-colors group-hover:text-[#00d992]">
                    {item.title}
                  </h3>
                  
                  <div className="font-mono text-[9px] text-[#00d992]/50 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    {">"} SYNCED_OK
                  </div>

                  {index < 3 && (
                    <div className="hidden md:block absolute top-[5.5rem] left-[65%] w-[85%] h-px bg-gradient-to-r from-[#00d992]/20 via-[#3d3a39] to-transparent dashed opacity-30" />
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>
      </LazyLoad>

      {/* CTA Section - Minimalist High-Contrast Finale */}
      <section id="launch" className="relative z-10 py-64 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#00d992]/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <ScrollReveal>
            <div className="mb-14 flex flex-col items-center">
               <div className="font-mono text-[9px] text-[#00d992]/60 tracking-[0.5em] uppercase mb-4">
                  [ PROTOCOL_TRANSITION: ASCENDING ]
               </div>
               <div className="h-px w-12 bg-gradient-to-r from-transparent via-[#00d992]/40 to-transparent" />
            </div>

            <h2 className="mb-20 flex flex-col items-center">
              <BlurReveal delay={0.2} blur={15} duration={1.2} className="text-6xl md:text-[6.5rem] font-black text-[#f2f2f2] tracking-[0.25em] uppercase leading-[1.6] drop-shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                从见到知
              </BlurReveal>
              <BlurReveal delay={0.5} blur={10} className="font-thin xl:text-[5rem] text-[#00d992] tracking-[0.6em] opacity-80 block mt-4">
                是为进化
              </BlurReveal>
            </h2>
            <Link 
              href="/dashboard"
              className="group relative inline-flex items-center gap-10 py-6 px-16 border border-[#00d992] hover:bg-[#00d992] transition-all duration-500 overflow-hidden"
            >
              <div className="absolute inset-0 bg-[#00d992] opacity-0 group-hover:opacity-10 transition-opacity" />
              <span className="relative z-10 font-mono text-[13px] tracking-[0.4em] text-[#00d992] group-hover:text-black font-bold uppercase">
                Launch_Console
              </span>
              <svg className="relative z-10 w-5 h-5 text-[#00d992] group-hover:text-black transition-all duration-500 group-hover:translate-x-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <div className="mt-16 font-mono text-[8px] text-[#8b949e] uppercase tracking-[0.2em] opacity-40">
              Session_End: 0x00_Terminal_Ready
            </div>
          </ScrollReveal>
        </div>
      </section>

      <SiteFooter />

      {/* Full-screen Command HUD Overlay */}
      <PathologyDetail 
        disease={selectedDisease} 
        onClose={() => setSelectedDisease(null)} 
      />
    </main>
  );
}
