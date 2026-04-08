"use client";

import { GlowingCard } from "./ui/GlowingCard";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/lib/animations";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function FeatureMasonry() {
    {
      title: "Console",
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
      title: "Diagnosis",
      icon: (
        <svg className="w-6 h-6 text-[#00d992]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l5.25-5.25 3.75 3.75L19.5 9" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h4.5v4.5" />
        </svg>
      ),
      className: "md:col-span-1 md:row-span-1",
      tone: "secondary",
    },
    {
      title: "Routing",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3.75l7.5 4.125v8.25L12 20.25l-7.5-4.125v-8.25L12 3.75z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8.25l3.75 2.063L12 12.375 8.25 10.313 12 8.25z" />
        </svg>
      ),
      className: "md:col-span-1 md:row-span-1",
      tone: "secondary",
    },
    {
      title: "Output",
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
        <motion.h2
          className="text-xl font-light text-white tracking-[0.4em] uppercase opacity-70"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          Logic.
        </motion.h2>
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
                    <h3 className="mb-1 text-2xl font-light tracking-widest uppercase text-white opacity-80">{feature.title}</h3>
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
