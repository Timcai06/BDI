import { LandingHero } from "@/components/LandingHero";
import { FeatureMasonry } from "@/components/FeatureMasonry";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SpotlightEffect } from "@/lib/animations";
import { ScrollReveal, CountUp } from "@/lib/animations";
import { LazyLoad } from "@/components/ui/LazyLoad";
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
    desc: "细长裂纹延展，优先关注主梁与边缘连续破损。",
    pattern: "linear"
  },
  {
    name: "剥落",
    nameEn: "Spalling",
    color: "#FFB54D",
    desc: "块状缺失与边缘破碎，常伴随表层结构脱落。",
    pattern: "fragment"
  },
  {
    name: "锈蚀",
    nameEn: "Corrosion",
    color: "#FF7A59",
    desc: "颗粒扩散与斑点渗透，提示钢筋或金属构件腐蚀。",
    pattern: "particle"
  },
  {
    name: "渗水",
    nameEn: "Efflorescence",
    color: "#4D8DFF",
    desc: "下渗流痕与潮湿纹理，容易出现在接缝与立面区域。",
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
      
      {/* Background glow effects */}
      <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-[#4285F4] opacity-[0.08] blur-[150px] animate-pulse-slow" />
      <div className="pointer-events-none absolute bottom-[20%] right-[-10%] h-[40%] w-[40%] rounded-full bg-[#63E6FF] opacity-[0.06] blur-[150px] animate-pulse-slow" />
      
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
          <ScrollReveal className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.94),rgba(4,8,16,0.8))] p-6 shadow-[0_30px_100px_rgba(5,10,18,0.45)] backdrop-blur-2xl md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <span className="section-title inline-block">System Preview</span>
                <h2 className="mt-4 text-3xl font-light text-white md:text-4xl">
                  像 AI 工作台，而不是普通官网
                </h2>
              </div>
              <span className="rounded-full border border-[#63e6ff]/20 bg-[#0b1723] px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-[#c9f8ff]/70">
                Model Active
              </span>
            </div>

            <p className="max-w-2xl text-white/52">
              结果预览、风险摘要与结构化输出在同一视图里展开，让用户一眼看到这套系统到底如何把图片变成判断。
            </p>

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

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {[
                {
                  title: "更冷的色彩主线",
                  desc: "用深黑蓝、电光蓝和冰青建立未来感，把紫色降成远景气氛。"
                },
                {
                  title: "更系统化的面板结构",
                  desc: "让结论、证据和输出排成真实工作流，而不是同权宣传卡片。"
                },
                {
                  title: "更克制的动效密度",
                  desc: "Hero 保持氛围感，内容层只做轻量进入动画，减少大面积留白和拖沓感。"
                }
              ].map((item) => (
                <div key={item.title} className="rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4">
                  <p className="text-base text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-white/44">{item.desc}</p>
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
          <ScrollReveal className="text-center mb-16">
            <span className="section-title inline-block mb-4">Disease Gallery</span>
            <h2 className="text-3xl md:text-4xl font-light text-white mb-4">
              病害类型识别
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto">
              支持多种常见桥梁病害类型的智能识别与分类
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {diseaseTypes.map((disease, index) => (
              <ScrollReveal key={disease.name} delay={index * 0.1}>
                <div className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.9),rgba(4,8,16,0.78))] p-5 transition-all duration-300 hover:border-white/20 hover:bg-[linear-gradient(180deg,rgba(11,17,28,0.95),rgba(5,10,18,0.84))]">
                  <div className="mb-5 overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4">
                    <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-white/30">
                      <span>{disease.nameEn}</span>
                      <span style={{ color: disease.color }}>Detected</span>
                    </div>
                    <div className="relative h-36 rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(13,20,31,0.95),rgba(24,35,47,0.92))]">
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
                  <h3 className="mb-1 text-xl font-medium text-white">
                    {disease.name}
                  </h3>
                  <p className="text-xs uppercase tracking-wider text-white/40">
                    {disease.nameEn}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-white/46">
                    {disease.desc}
                  </p>
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
          <ScrollReveal className="text-center mb-16">
            <span className="section-title inline-block mb-4">Workflow</span>
            <h2 className="text-3xl md:text-4xl font-light text-white mb-4">
              智能判读工作流
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto">
              从图像上传到报告导出，一站式完成桥梁病害检测
            </p>
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
      <section className="relative z-10 py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-light text-white mb-6">
              进入未来感巡检控制台
            </h2>
            <p className="text-lg text-white/50 mb-10 max-w-2xl mx-auto">
              用更明确的任务流、更强的结果表达和更完整的结构化输出，把桥梁判读做成真正可交付的 AI 工作流。
            </p>
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
