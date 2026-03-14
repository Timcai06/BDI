"use client";

import { GlowingCard } from "./ui/GlowingCard";
import { ScrollReveal, StaggerContainer, StaggerItem, fadeInUp } from "@/lib/animations";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function FeatureMasonry() {
  const features = [
    {
      title: "实时监控",
      subtitle: "Real-time Monitoring",
      description: "全天候毫秒级数据同步。捕捉每一次细微变动，确保基础设施状态完全可视。",
      icon: (
        <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      className: "md:col-span-2 md:row-span-2",
      delay: 0
    },
    {
      title: "智能分析",
      subtitle: "Intelligent Analysis",
      description: "基于 AI 的深度预测建模。自动识别潜在隐患，从海量数据中提炼关键洞察。",
      icon: (
        <svg className="w-6 h-6 text-[#00D2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      className: "md:col-span-1 md:row-span-1",
      delay: 0.1
    },
    {
      title: "安全防护",
      subtitle: "Security Shield",
      description: "军用级端到端加密体系。数据中心级边界防护，保障核心资产万无一失。",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4h8a8 8 0 008 8c0 1.538-.279 3.023-.787 4.417" />
        </svg>
      ),
      className: "md:col-span-1 md:row-span-2",
      delay: 0.2
    },
    {
      title: "极简集成",
      subtitle: "Seamless Integration",
      description: "一键接入现有工作流。提供标准化 API 与 Webhook，打通数据孤岛。",
      icon: (
        <svg className="w-6 h-6 text-accent-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      className: "md:col-span-2 md:row-span-1",
      delay: 0.3
    },
  ];

  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

  return (
    <section ref={sectionRef} className="py-24 relative">
      {/* 背景光晕效果 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[500px] bg-white/[0.02] blur-[100px] rounded-full pointer-events-none" />
      
      {/* Section Title with Animation */}
      <ScrollReveal className="text-center mb-16" delay={0}>
        <motion.span 
          className="section-title inline-block mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5 }}
        >
          Core Features
        </motion.span>
        <motion.h2 
          className="text-3xl md:text-4xl font-light text-white mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          核心能力
        </motion.h2>
        <motion.p 
          className="text-white/50 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          为桥梁基础设施巡检打造的智能化解决方案
        </motion.p>
      </ScrollReveal>

      {/* Masonry Grid with Stagger Animation */}
      <StaggerContainer 
        className="grid grid-cols-1 md:grid-cols-3 auto-rows-[250px] gap-6 relative z-10"
        staggerDelay={0.1}
      >
        {features.map((feature, idx) => (
          <StaggerItem key={idx} className={feature.className}>
            <motion.div
              className="h-full"
              whileHover={{ 
                scale: 1.02,
                transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
              }}
              style={{ willChange: "transform" }}
            >
              <GlowingCard className="h-full">
                <div className="flex flex-col h-full justify-between">
                  <motion.div 
                    className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6"
                    whileHover={{ 
                      rotate: 5,
                      scale: 1.1,
                      transition: { duration: 0.2 }
                    }}
                  >
                    {feature.icon}
                  </motion.div>
                  
                  <div className="mt-auto">
                    <h3 className="text-2xl font-light text-white mb-1 tracking-wide">
                      {feature.title}
                    </h3>
                    <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4">
                      {feature.subtitle}
                    </p>
                    <p className="text-sm text-slate-400 font-light leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </GlowingCard>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
