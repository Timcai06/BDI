import { LandingHero } from "@/components/LandingHero";
import { FeatureMasonry } from "@/components/FeatureMasonry";
import { ScrollCue } from "@/components/ScrollCue";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SpotlightEffect } from "@/lib/animations";
import { ScrollReveal, CountUp } from "@/lib/animations";
import { LazyLoad } from "@/components/ui/LazyLoad";
import { GlowingCard } from "@/components/ui/GlowingCard";
import { ParticleWave } from "@/components/animations/ParticleWave";
import { UploadIcon, AiIcon, VerifyIcon, ReportIcon } from "@/components/icons/WorkflowIcons";

// 统计数据
const stats = [
  { value: 98.5, suffix: "%", label: "识别准确率" },
  { value: 10, suffix: "x+", label: "效率提升" },
  { value: 50000, suffix: "+", label: "已检测桥梁" },
  { value: 24, suffix: "/7", label: "全天候服务" }
];

// 病害类型示例数据
const diseaseTypes = [
  {
    name: "裂缝",
    nameEn: "Crack",
    color: "#63E6FF",
    desc: "主梁与边缘高发",
    pattern: "linear"
  },
  {
    name: "剥落",
    nameEn: "Spalling",
    color: "#FFB54D",
    desc: "表层结构脱落",
    pattern: "fragment"
  },
  {
    name: "锈蚀",
    nameEn: "Corrosion",
    color: "#FF7A59",
    desc: "金属构件衰变",
    pattern: "particle"
  },
  {
    name: "渗水",
    nameEn: "Efflorescence",
    color: "#4D8DFF",
    desc: "形态破裂特征",
    pattern: "flow"
  }
];

// 工作流程步骤
const workflowSteps = [
  { step: "01", title: "上传图像", desc: "批量上传桥梁检测图像", Icon: UploadIcon },
  { step: "02", title: "AI 识别", desc: "智能算法自动标记病害", Icon: AiIcon },
  { step: "03", title: "人工复核", desc: "专家确认与修正结果", Icon: VerifyIcon },
  { step: "04", title: "导出报告", desc: "生成结构化检测报告", Icon: ReportIcon }
];

export const metadata = {
  title: "BDI Nexus | 桥梁病害智能判读系统",
  description: "AI驱动的桥梁基础设施巡检解决方案，从图像上传到报告导出的一站式智能判读工作台",
  keywords: ["桥梁检测", "AI识别", "基础设施", "智能巡检", "病害判读"],
  openGraph: {
    title: "BDI Nexus | 桥梁病害智能判读系统",
    description: "AI驱动的桥梁基础设施巡检解决方案",
    type: "website"
  }
};

export default function LandingPage() {
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

      {/* Stats Section */}
      <section className="relative z-10 py-20 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <ScrollReveal
                key={stat.label}
                delay={index * 0.1}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  <CountUp
                    end={stat.value}
                    suffix={stat.suffix}
                    duration={2}
                  />
                </div>
                <div className="text-sm text-white/40 uppercase tracking-wider">
                  {stat.label}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="technology" className="relative z-10 py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-24">
          <ScrollReveal className="rounded-[32px] border border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-3xl md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <span className="section-title inline-block">System Preview</span>
                <h2 className="mt-2 text-2xl font-light text-white tracking-wide">
                  Unified Diagnosis Console.
                </h2>
              </div>
              <span className="rounded-full border border-[#63e6ff]/20 bg-[#0b1723] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#c9f8ff]/70">
                Model Active
              </span>
            </div>

            <div className="mt-8 overflow-hidden rounded-[28px] border border-white/10 bg-[#050912]">
              <div className="border-b border-white/10 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#63e6ff]" />
                      <span className="text-xs uppercase tracking-[0.24em] text-white/35">Inference Summary</span>
                    </div>
                    <h3 className="mt-3 text-2xl font-light text-white">
                      检测到 2 处裂缝，主梁区域风险较高，建议优先复核
                    </h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/45">
                    seg-optimized / best-v1
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    ["主要病害", "裂缝"],
                    ["推理耗时", "0.28s"],
                    ["建议动作", "查看叠加结果"]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/30">{label}</p>
                      <p className="mt-2 text-sm text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
                <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,28,48,0.92),rgba(8,12,20,0.85))] p-4 md:p-5">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(77,141,255,0.25),transparent_42%),radial-gradient(circle_at_75%_65%,rgba(99,230,255,0.16),transparent_38%)]" />
                  <div className="relative">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.24em] text-white/35">
                      <span>Overlay Preview</span>
                      <span>highest risk / Main Beam</span>
                    </div>

                    <div className="mt-5 rounded-[20px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,14,24,0.84),rgba(11,31,51,0.75))] p-3 md:p-4">
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)] xl:gap-4">
                        <div className="relative min-w-0 overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(160deg,rgba(15,22,34,0.95),rgba(29,39,53,0.92) 42%,rgba(12,19,30,0.96))] aspect-[16/10]">
                          <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.04),transparent_30%,rgba(255,255,255,0.02)_60%,transparent)]" />
                          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:28px_28px]" />
                          <div className="absolute left-[12%] top-[18%] h-[2px] w-[40%] rotate-[12deg] rounded-full bg-[#9ceeff] shadow-[0_0_14px_rgba(99,230,255,0.55)]" />
                          <div className="absolute left-[18%] top-[24%] h-[2px] w-[22%] rotate-[7deg] rounded-full bg-[#9ceeff]/80" />
                          <div className="absolute left-[10%] top-[14%] h-[28%] w-[33%] rounded-[42%_58%_56%_44%/54%_38%_62%_46%] border border-[#63e6ff]/45 bg-[#63e6ff]/10 shadow-[0_0_36px_rgba(99,230,255,0.12)]" />
                          <div className="absolute right-[14%] top-[48%] h-[24%] w-[18%] rounded-[52%_48%_60%_40%/44%_58%_42%_56%] border border-[#ffb54d]/45 bg-[#ffb54d]/10" />
                          <div className="absolute left-[48%] top-[24%] h-px w-[14%] bg-[#63e6ff]/55" />
                          <div className="absolute right-[24%] top-[58%] h-px w-[10%] bg-[#ffb54d]/50" />
                          <div className="absolute left-[60%] top-[18%] max-w-[34%] rounded-full border border-[#63e6ff]/25 bg-[#07111a]/90 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#d7f7ff] sm:text-[10px]">
                            Crack / 0.93
                          </div>
                          <div className="absolute right-[6%] top-[60%] max-w-[28%] rounded-full border border-[#ffb54d]/25 bg-[#120d07]/90 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#ffe1b5] sm:text-[10px]">
                            Spall / 0.71
                          </div>
                        </div>

                        <div className="flex min-w-0 flex-col gap-3">
                          {[
                            ["Crack", "Main Beam", "最高风险区域，建议优先复核"],
                            ["Spalling", "Edge Zone", "次级风险，适合结合原图对照"],
                            ["Trace", "History Ready", "结果已进入结构化输出链路"]
                          ].map(([title, badge, desc]) => (
                            <div key={title} className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm text-white">{title}</p>
                                <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">{badge}</span>
                              </div>
                              <p className="mt-2 text-sm text-white/45">{desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">Output Layer</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {[
                      ["叠加图", "可直接用于巡检复核"],
                      ["JSON", "结构化结果进入系统接口"],
                      ["历史记录", "保存本次模型版本与诊断结果"],
                      ["模型对比", "继续评估不同权重表现"]
                    ].map(([title, desc]) => (
                      <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="text-sm text-white">{title}</p>
                        <p className="mt-2 text-sm text-white/42">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-3">
              {[
                {
                  title: "高冷科技主调",
                  subtitle: "Color Palette",
                  desc: "用深黑蓝、电光蓝和冰青色确立现代智能判读工作台的未来质感。",
                  icon: (
                    <svg className="w-5 h-5 text-[#63e6ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )
                },
                {
                  title: "系统化数据结构",
                  subtitle: "System Interface",
                  desc: "结论、证据与诊断可视化叠加构成真实工作流，摒弃无意义的同权展示。",
                  icon: (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  )
                },
                {
                  title: "克制的动效密度",
                  subtitle: "Motion Design",
                  desc: "保障首屏氛围感，数据交互层则坚持轻量无感的出现，拒绝视觉拖沓。",
                  icon: (
                    <svg className="w-5 h-5 text-[#8fc5ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                  )
                }
              ].map((item) => (
                <div key={item.title} className="h-full">
                  <GlowingCard className="h-full relative overflow-hidden group">
                    <div className="flex flex-col h-full justify-between px-2 py-1">
                      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] transition-colors group-hover:border-white/20">
                        {item.icon}
                      </div>
                      <div className="mt-auto">
                        <h3 className="mb-1 text-[17px] font-light tracking-wide text-white">{item.title}</h3>
                        <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[#63e6ff]/50">{item.subtitle}</p>
                        <p className="text-[13px] font-light leading-relaxed text-slate-400">{item.desc}</p>
                      </div>
                    </div>
                  </GlowingCard>
                </div>
              ))}
            </div>


          </ScrollReveal>
        </div>
      </section>

      {/* Constrained Masonry Section */}
      <div id="features" className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
        <FeatureMasonry />
      </div>

      {/* Disease Types Section - 懒加载 */}
      <LazyLoad
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 py-24"
        placeholder={<div className="h-96 bg-white/5 rounded-3xl animate-pulse" />}
      >
        <section id="disease-types">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block mb-3 text-[10px] uppercase tracking-[0.3em] text-white/40">Pathology Models</span>
            <h2 className="text-2xl font-light text-white tracking-wide">
              精准定位
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {diseaseTypes.map((disease, index) => (
              <ScrollReveal key={disease.name} delay={index * 0.1}>
                <div className="group relative overflow-hidden rounded-[28px] border border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 backdrop-blur-2xl transition-all duration-300 hover:border-white/10 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
                  <div className="mb-5 overflow-hidden rounded-[22px] border border-white/5 bg-[linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4">
                    <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-white/30">
                      <span>{disease.nameEn}</span>
                      <span style={{ color: disease.color }}>Detected</span>
                    </div>
                    <div className="relative h-36 rounded-[18px] border border-white/5 bg-[linear-gradient(145deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]">
                      {disease.pattern === "linear" ? (
                        <>
                          <div className="absolute left-[14%] top-[34%] h-[2px] w-[58%] rotate-[13deg] rounded-full" style={{ backgroundColor: disease.color, boxShadow: `0 0 18px ${disease.color}55` }} />
                          <div className="absolute left-[28%] top-[52%] h-[2px] w-[30%] rotate-[7deg] rounded-full" style={{ backgroundColor: `${disease.color}cc` }} />
                          <div className="absolute left-[10%] top-[24%] h-16 w-36 rounded-[42%_58%_56%_44%/54%_38%_62%_46%] border" style={{ borderColor: `${disease.color}66`, backgroundColor: `${disease.color}14` }} />
                        </>
                      ) : null}
                      {disease.pattern === "fragment" ? (
                        <>
                          <div className="absolute left-[14%] top-[22%] h-16 w-20 rounded-[58%_42%_60%_40%/46%_58%_42%_54%] border" style={{ borderColor: `${disease.color}66`, backgroundColor: `${disease.color}16` }} />
                          <div className="absolute left-[48%] top-[34%] h-12 w-16 rounded-[44%_56%_38%_62%/56%_44%_58%_42%] border" style={{ borderColor: `${disease.color}55`, backgroundColor: `${disease.color}10` }} />
                          <div className="absolute left-[22%] top-[64%] h-px w-16" style={{ backgroundColor: `${disease.color}aa` }} />
                        </>
                      ) : null}
                      {disease.pattern === "particle" ? (
                        <>
                          {[
                            ["16%", "28%", 10],
                            ["34%", "52%", 14],
                            ["54%", "36%", 8],
                            ["66%", "62%", 12],
                            ["42%", "72%", 6]
                          ].map(([left, top, size], particleIndex) => (
                            <div
                              key={particleIndex}
                              className="absolute rounded-full"
                              style={{
                                left,
                                top,
                                width: `${size}px`,
                                height: `${size}px`,
                                backgroundColor: `${disease.color}55`,
                                boxShadow: `0 0 16px ${disease.color}35`
                              }}
                            />
                          ))}
                          <div className="absolute inset-[18%] rounded-[22px] border border-dashed" style={{ borderColor: `${disease.color}35` }} />
                        </>
                      ) : null}
                      {disease.pattern === "flow" ? (
                        <>
                          <div className="absolute left-[28%] top-[18%] h-20 w-8 rounded-full blur-[1px]" style={{ background: `linear-gradient(180deg, ${disease.color}66, transparent)` }} />
                          <div className="absolute left-[46%] top-[22%] h-24 w-6 rounded-full blur-[1px]" style={{ background: `linear-gradient(180deg, ${disease.color}55, transparent)` }} />
                          <div className="absolute left-[58%] top-[28%] h-20 w-5 rounded-full blur-[1px]" style={{ background: `linear-gradient(180deg, ${disease.color}40, transparent)` }} />
                          <div className="absolute inset-x-[18%] top-[18%] h-px" style={{ backgroundColor: `${disease.color}55` }} />
                        </>
                      ) : null}
                    </div>
                  </div>
                  <h3 className="mb-1 text-lg font-light text-white">
                    {disease.name}
                  </h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                    {disease.nameEn}
                  </p>
                  <div className="mt-3 inline-block rounded-full border border-white/5 bg-white/[0.015] px-2.5 py-1 text-[10px] text-white/40">
                    {disease.desc}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>
      </LazyLoad>

      {/* Workflow Section - 懒加载 */}
      <LazyLoad
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 py-24"
        placeholder={<div className="h-96 bg-white/5 rounded-3xl animate-pulse" />}
      >
        <section id="workflow">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block mb-3 text-[10px] uppercase tracking-[0.3em] text-white/40">Workflow Stream</span>
            <h2 className="text-2xl font-light text-white tracking-wide">
              极简回路
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {workflowSteps.map((item, index) => (
              <ScrollReveal key={item.step} delay={index * 0.15}>
                <div className="relative text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6 transition-all duration-300 group-hover:bg-white/10 group-hover:border-white/20 group-hover:scale-105 text-white/60 group-hover:text-white">
                    <item.Icon className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-mono text-white/30 mb-2 block">
                    STEP {item.step}
                  </span>
                  <h3 className="text-xl font-medium text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-white/40">
                    {item.desc}
                  </p>

                  {/* 连接线 */}
                  {index < 3 && (
                    <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/20 to-transparent" />
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>


        </section>
      </LazyLoad>

      {/* CTA Section */}
      <section id="launch" className="relative z-10 py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-light text-white mb-8 tracking-wide">
              部署你的未来感巡检控制台。
            </h2>
            <a
              href="/dashboard"
              className="inline-flex h-14 items-center justify-center gap-3 rounded-full border border-[#7bb8ff]/30 bg-[linear-gradient(135deg,rgba(77,141,255,0.22),rgba(99,230,255,0.16))] px-12 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:border-[#9dd6ff]/50 hover:shadow-[0_0_50px_rgba(77,141,255,0.18)]"
            >
              打开 BDI Console
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </ScrollReveal>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
