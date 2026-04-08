"use client";

import { GlowingCard } from "./ui/GlowingCard";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/lib/animations";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function FeatureMasonry() {
  const features = [
    {
      title: "判读主控台",
      subtitle: "Mission Console",
      description: "把上传、识别、复核、导出收进同一条任务流里，让巡检从一次判断变成可追踪的系统流程。",
      icon: (
        <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 5.25h16.5v13.5H3.75z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 9h3m3 0h3M7.5 13.5h9" />
        </svg>
      ),
      className: "md:col-span-2 md:row-span-2",
      tone: "primary",
    },
    {
      title: "结果解读",
      subtitle: "Risk Prioritization",
      description: "自动收敛出病害结论、最高风险区域与建议下一步，减少用户自己解释结果的负担。",
      icon: (
        <svg className="w-6 h-6 text-[#63E6FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l5.25-5.25 3.75 3.75L19.5 9" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h4.5v4.5" />
        </svg>
      ),
      className: "md:col-span-1 md:row-span-1",
      tone: "secondary",
    },
    {
      title: "模型切换",
      subtitle: "Model Routing",
      description: "支持多模型并行切换与结果对比，把优化版权重真正变成可决策的前端能力。",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3.75l7.5 4.125v8.25L12 20.25l-7.5-4.125v-8.25L12 3.75z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8.25l3.75 2.063L12 12.375 8.25 10.313 12 8.25z" />
        </svg>
      ),
      className: "md:col-span-1 md:row-span-2",
      tone: "secondary",
    },
    {
      title: "交付接口",
      subtitle: "Structured Output",
      description: "输出结果图、JSON 与历史记录，让识别结果自然进入报告、复核与业务系统。",
      icon: (
        <svg className="w-6 h-6 text-accent-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 6.75h9m-9 5.25h9m-9 5.25h6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 3.75h13.5v16.5H5.25z" />
        </svg>
      ),
      className: "md:col-span-2 md:row-span-1",
      tone: "secondary",
    },
  ];

  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

  return (
    <section ref={sectionRef} className="py-24 relative">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(77,141,255,0.08),transparent_70%)] blur-[100px]" />

      <ScrollReveal className="text-center mb-16" delay={0}>
        <motion.span
          className="section-title inline-block mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5 }}
        >
          System Modules
        </motion.span>
        <motion.h2
          className="text-3xl md:text-4xl font-light text-white mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          更像系统，而不是宣传卡片
        </motion.h2>
        <motion.p
          className="text-white/50 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          以任务流、结果解读与结构化输出为中心，构建真正可落地的桥梁判读工作台。
        </motion.p>
      </ScrollReveal>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 auto-rows-[250px] gap-6 relative z-10" staggerDelay={0.1}>
        {features.map((feature, idx) => (
          <StaggerItem key={idx} className={feature.className}>
            <motion.div className="h-full" style={{ willChange: "transform" }}>
              <GlowingCard className="h-full">
                <div className="flex flex-col h-full justify-between">
                  <motion.div
                    className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border ${feature.tone === "primary"
                        ? "border-[#7bb8ff]/25 bg-[linear-gradient(180deg,rgba(77,141,255,0.16),rgba(99,230,255,0.08))]"
                        : "border-white/10 bg-white/5"
                      }`}
                  >
                    {feature.icon}
                  </motion.div>

                  <div className="mt-auto">
                    <h3 className="mb-1 text-2xl font-light tracking-wide text-white">{feature.title}</h3>
                    <p className="mb-4 text-xs font-mono uppercase tracking-widest text-white/40">{feature.subtitle}</p>
                    <p className="text-sm font-light leading-relaxed text-slate-400">{feature.description}</p>
                    {feature.tone === "primary" ? (
                      <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-white/55">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                          <p className="uppercase tracking-[0.24em] text-white/30">Input</p>
                          <p className="mt-2 text-sm text-white">Image Upload</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                          <p className="uppercase tracking-[0.24em] text-white/30">Output</p>
                          <p className="mt-2 text-sm text-white">Result + JSON</p>
                        </div>
                      </div>
                    ) : null}
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
