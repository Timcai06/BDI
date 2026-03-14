import { LandingHero } from "@/components/LandingHero";
import { FeatureMasonry } from "@/components/FeatureMasonry";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SpotlightEffect } from "@/lib/animations";
import { ScrollReveal, CountUp } from "@/lib/animations";
import { CompareSlider } from "@/components/ui/OptimizedImage";
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
  { name: "裂缝", nameEn: "Crack", color: "#FF4D4D" },
  { name: "剥落", nameEn: "Spalling", color: "#FFC107" },
  { name: "锈蚀", nameEn: "Corrosion", color: "#00D2FF" },
  { name: "渗水", nameEn: "Efflorescence", color: "#9C27B0" }
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
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#4285F4] opacity-[0.08] blur-[150px] pointer-events-none rounded-full animate-pulse-slow" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-[#A06EE1] opacity-[0.08] blur-[150px] pointer-events-none rounded-full animate-pulse-slow" />
      
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

      {/* Constrained Masonry Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {diseaseTypes.map((disease, index) => (
              <ScrollReveal key={disease.name} delay={index * 0.1}>
                <div className="relative group overflow-hidden rounded-2xl bg-white/5 border border-white/10 p-6 text-center transition-all duration-300 hover:bg-white/10 hover:border-white/20">
                  <div 
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: `${disease.color}20`, border: `2px solid ${disease.color}40` }}
                  >
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: disease.color }}
                    />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-1">
                    {disease.name}
                  </h3>
                  <p className="text-xs text-white/40 uppercase tracking-wider">
                    {disease.nameEn}
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
              开启智能化桥梁巡检
            </h2>
            <p className="text-lg text-white/50 mb-10 max-w-2xl mx-auto">
              立即体验 AI 驱动的桥梁病害判读系统，提升检测效率与准确性
            </p>
            <a
              href="/dashboard"
              className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-white text-black px-12 text-sm font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] hover:scale-105"
            >
              免费开始试用
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
