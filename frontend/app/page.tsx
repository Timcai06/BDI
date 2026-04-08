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
  { value: 98.5, suffix: "%", label: "ACCURACY" },
  { value: 10, suffix: "x", label: "SCALE" },
  { value: 50, suffix: "k+", label: "ASSETS" },
  { value: 24, suffix: "/7", label: "UPTIME" }
];

const diseaseTypes = [
  { name: "Crack", color: "#00d992", pattern: "linear" },
  { name: "Spalling", color: "#FFB54D", pattern: "fragment" },
  { name: "Corrosion", color: "#FF7A59", pattern: "particle" },
  { name: "Seepage", color: "#4D8DFF", pattern: "flow" }
];

// 工作流程步骤
const workflowSteps = [
  { step: "01", title: "Upload", Icon: UploadIcon },
  { step: "02", title: "Infer", Icon: AiIcon },
  { step: "03", title: "Verify", Icon: VerifyIcon },
  { step: "04", title: "Export", Icon: ReportIcon }
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

      {/* Disease Types Section - 懒加载 */}
      <LazyLoad
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 py-24"
        placeholder={<div className="h-96 bg-white/5 rounded-3xl animate-pulse" />}
      >
        <section id="disease-types">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-xl font-light text-white tracking-[0.4em] uppercase opacity-70">
              Pathology.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {diseaseTypes.map((disease, index) => (
              <ScrollReveal key={disease.name} delay={index * 0.1}>
                <div className="group relative flex flex-col px-2 py-6 transition-all duration-300">
                  <div className="absolute top-0 left-0 w-12 h-[1px]" style={{ background: `linear-gradient(90deg, ${disease.color}88, transparent)` }} />
                  <div className="absolute left-0 top-3 text-[8px] font-mono tracking-widest uppercase opacity-40">
                    SCAN / {disease.name}
                  </div>
                  <div className="relative h-44 w-full mt-6 mb-6">
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
                  <h3 className="text-2xl font-light text-white tracking-[0.25em] uppercase opacity-90 drop-shadow-lg">
                    {disease.name}
                  </h3>
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
            <h2 className="text-xl font-light text-white tracking-[0.4em] uppercase opacity-70">
              Flow.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {workflowSteps.map((item, index) => (
              <ScrollReveal key={item.step} delay={index * 0.15}>
                <div className="relative text-center group pt-4">
                  <div className="absolute top-0 left-[40%] w-[20%] h-[1px] bg-gradient-to-r from-transparent via-[#00d992]/40 to-transparent" />
                  <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4 transition-all duration-300 text-white/30 group-hover:text-[#00d992] drop-shadow-md group-hover:drop-shadow-[0_0_15px_rgba(0,217,146,0.5)]">
                    <item.Icon className="w-12 h-12" />
                  </div>
                  <span className="text-xs font-mono text-[#00d992]/60 mb-2 block font-bold">
                    STEP / {item.step}
                  </span>
                  <h3 className="text-xl font-light uppercase tracking-[0.4em] text-[#f2f2f2] opacity-80 pt-2">
                    {item.title}
                  </h3>

                  {/* 连接线 */}
                  {index < 3 && (
                    <div className="hidden md:block absolute top-14 left-[60%] w-[80%] h-px bg-gradient-to-r from-[#3d3a39] to-transparent dashed opacity-50" />
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
            <h2 className="text-2xl font-light text-white mb-10 tracking-widest opacity-80 uppercase">
              Ready to deploy.
            </h2>
            <a
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-12 text-[13px] font-medium uppercase tracking-[0.2em] text-white transition-all duration-300 hover:bg-white/10 hover:border-white/20"
            >
              Launch Console
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
