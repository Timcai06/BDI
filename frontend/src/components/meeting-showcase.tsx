"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type ShowcaseSlide = {
  eyebrow: string;
  title: string;
  kicker: string;
  summary: string;
  stats: Array<{ label: string; value: string }>;
  highlights: string[];
  flow: string[];
  architecture: string[];
  scriptTitle: string;
  script: string[];
  accent: string;
};

const slides: ShowcaseSlide[] = [
  {
    eyebrow: "01 / 双模型处理",
    title: "双模型识别逻辑",
    kicker: "按类别分工，各取其长，确保最优性能。",
    summary:
      "一张图同时进入通用模型和专项模型。通用模型负责检测大部分病害，渗水专项模型专门负责渗水检测。后端融合层按照类别规则自动合并并输出结果。",
    stats: [
      { label: "通用模型", value: "全类别覆盖" },
      { label: "专项模型", value: "渗水高精度" },
      { label: "融合逻辑", value: "类别级路由" },
    ],
    highlights: [
      "通用模型确保整体覆盖度，专项模型确保渗水精度。",
      "融合层按病害类别进行结果合并仲裁。",
      "系统自动识别并显示每一项检测的来源模型。",
    ],
    flow: ["图像并行推理", "结果融合处理", "统一标注输出"],
    architecture: ["primary_runner", "specialist_runner", "FusionRunner"],
    scriptTitle: "讲稿",
    script: [
      "核心逻辑是‘类别化分工’。由两个模型并行处理一张图。",
      "通用模型管大局，专项模型只管渗水。后端融合层根据类别做仲裁，确保整体效果最优。",
    ],
    accent: "#00D2FF",
  },
  {
    eyebrow: "02 / 结果展示",
    title: "融合结果展示",
    kicker: "来源透明，标注清晰，结果链路完整。",
    summary:
      "后端返回的 detections 带有模型来源字段。用户可以动态开关图层、查看分阶段推理耗时，并支持一键导出带标注的结果图像。",
    stats: [
      { label: "检测来源", value: "清晰可追溯" },
      { label: "图层控制", value: "按类别开关" },
      { label: "成果导出", value: "标注图一键保存" },
    ],
    highlights: [
      "每一条检测结果都可以清晰追溯到具体模型。",
      "支持推理耗时的精细化拆解（预处理/推理/后处理）。",
      "结果图支持带 Detections 框的高清导出。",
    ],
    flow: ["数据字段注入", "前端分层渲染", "图层动态控制"],
    architecture: ["Overlay Engine", "Source Labeling", "Export Manager"],
    scriptTitle: "讲稿",
    script: [
      "现在的系统不只会画框，还会解释框是怎么来的。我们在所有结果里都加上了来源（Source）标注。",
      "同时，由于支持了结果图导出和耗时拆解，整套系统已经具备了成熟的工程化展示能力。",
    ],
    accent: "#7FFFD4",
  },
  {
    eyebrow: "03 / 系统架构",
    title: "模块化系统架构",
    kicker: "分层设计，低耦合，易于扩展新能力。",
    summary:
      "系统通过 Registry 管理模型版本，Runner 封装推理逻辑。Service 层通过统一协议屏蔽模型差异，实现了算法插件化，支持零改动接入新权重。",
    stats: [
      { label: "模型管理", value: "Registry 注册制" },
      { label: "推理协议", value: "FastAPI 统一接口" },
      { label: "迭代效率", value: "插件式模型接入" },
    ],
    highlights: [
      "多模型并行处理采用独立 Runner 封装，极大降低了维护成本。",
      "统一的 Response Schema 确保了前后端交互的高度一致性。",
      "更换或更新模型版本仅需修改后端配置，无需重启核心服务。",
    ],
    flow: ["API 请求分发", "Runner 权重匹配", "结果并行汇聚"],
    architecture: ["ModelRegistry", "FusionService", "Unified Schema"],
    scriptTitle: "讲稿",
    script: [
      "架构采用了模块化的分层设计。这种‘插件化’的好处是：明天如果有了更好的模型，我们只要在注册层更新一下，整个系统不用重写。",
    ],
    accent: "#FFB54D",
  },
  {
    eyebrow: "04 / 交互看板",
    title: "交互式分析看板",
    kicker: "可视化复核，辅助决策，提升透明度。",
    summary:
      "看板支持即时渲染所有的推理结果。通过图层控制器，用户可以独立复核每个类别的识别效果。这种强交互能力为模型预测提供了极大的直观透明度。",
    stats: [
      { label: "可视化", value: "像素级结果渲染" },
      { label: "分层看板", value: "按类别联动管理" },
      { label: "复核效率", value: "直观对比分析" },
    ],
    highlights: [
      "多病害图层联动管理，支持点击即刻开启或关闭特定类别。",
      "支持对结果进行精细化的人工复审与多模型比对。",
      "自动合成面向最终报告的图像与 JSON 数据包。",
    ],
    flow: ["图层动态加载", "病害分类过滤", "Canvas 渲染预览"],
    architecture: ["LayerController", "CanvasEngine", "MetadataProvider"],
    scriptTitle: "讲稿",
    script: [
      "看板是展示成果的核心。通过交互式的图层控制，我们可以一眼看清算法的识别边界。",
      "它不仅是一个展示工具，更是一个辅助我们进行结果复核的决策台。",
    ],
    accent: "#4D8DFF",
  },
  {
    eyebrow: "05 / 历史持久化",
    title: "历史追溯与数据沉淀",
    kicker: "有史可循，建立算法演进的闭环。",
    summary:
      "所有推理行为均会被持久化记录。用户可以通过历史面板随时找回过往记录并进行回溯分析。这为算法精度的纵向对比提供了重要的数据集支持。",
    stats: [
      { label: "持久化", value: "推理记录零丢失" },
      { label: "回溯力", value: "秒级加载历史快照" },
      { label: "数据集", value: "沉淀原始标注资产" },
    ],
    highlights: [
      "后端自动记录每次推理的模型版本、参数及原始输入输出。",
      "前端侧边栏提供快速检索、搜索和深度详情回溯功能。",
      "为后续模型迭代和精度审计储备了真实的测试场景数据。",
    ],
    flow: ["结果异步存储", "历史索引构建", "快照状态恢复"],
    architecture: ["History Store", "Persistence DB", "State Restorer"],
    scriptTitle: "讲稿",
    script: [
      "我们把系统的‘推理行为’持久化了。现在每一次识别都会作为历史资产保存。",
      "这方便了演示，也为我们后期做数据回测和针对性的算法优化提供了真实依据。",
    ],
    accent: "#BD10E0",
  },
  {
    eyebrow: "06 / 未来演进",
    title: "系统未来演进方向",
    kicker: "从病害识别向自动化测量与评级进化。",
    summary:
      "未来我们将接入分割算法以实现病害面积测量，优化推理性能以支持边缘端现场部署，并利用大模型自动生成规范化的巡检报告。",
    stats: [
      { label: "技术 A", value: "分割算法 (测面积)" },
      { label: "技术 B", value: "边缘盒子实时部署" },
      { label: "技术 C", value: "LLM 自动巡检报告" },
    ],
    highlights: [
      "引入像素级分割模型，精确测量裂缝长度和渗水实时面积。",
      "对模型进行深度量化，支持现场移动端或边缘计算设备。",
      "结合分析大模型，自动生成符合行业标准的病害评估建议。",
    ],
    flow: ["分割网络集成", "边缘盒子适配", "自动报告生成"],
    architecture: ["SegmentRunner", "Edge SDK", "Report Engine"],
    scriptTitle: "讲稿",
    script: [
      "最后展望一下。我们的方向是不止于‘看到’，还要做到‘量化’和‘评估’。",
      "我们会引入分割算法来算面积，并支持实地现场巡检。最终目标是实现巡检报告的自动化生成。",
    ],
    accent: "#39FF14",
  },
];

function DualModelDiagram() {
  const nodes = [
    { label: "原始图像", tone: "border-black/10 bg-[#fafafa] text-[#18181B]" },
    { label: "通用模型", tone: "border-[#00D2FF]/20 bg-[#00D2FF]/8 text-[#18181B]" },
    { label: "渗水专项模型", tone: "border-[#7FFFD4]/30 bg-[#7FFFD4]/12 text-[#18181B]" },
    { label: "FusionRunner", tone: "border-[#18181B]/15 bg-[#18181B] text-white" },
    { label: "统一结果输出", tone: "border-[#FFB54D]/30 bg-[#FFB54D]/12 text-[#18181B]" },
  ];

  return (
    <div className="rounded-[2rem] border border-black/[0.03] bg-white/40 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.3em] text-black/30">TECHNICAL WORKFLOW</p>
        <div className="h-1 w-12 rounded-full bg-black/[0.05]" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.5fr_1fr]">
        <div className={`flex flex-col justify-center rounded-[1.5rem] border p-5 transition-all ${nodes[0].tone}`}>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">Input Source</p>
          <p className="mt-2 text-[1.125rem] font-bold tracking-tight">{nodes[0].label}</p>
        </div>

        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className={`rounded-[1.5rem] border p-5 transition-all hover:scale-[1.02] ${nodes[1].tone}`}>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">Branch Alpha</p>
              <p className="mt-2 text-[1.05rem] font-bold">{nodes[1].label}</p>
              <p className="mt-2 text-[0.8125rem] leading-relaxed opacity-60">全类别覆盖，保障基础病害识别。</p>
            </div>
            <div className={`rounded-[1.5rem] border p-5 transition-all hover:scale-[1.02] ${nodes[2].tone}`}>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">Branch Beta</p>
              <p className="mt-2 text-[1.05rem] font-bold">{nodes[2].label}</p>
              <p className="mt-2 text-[0.8125rem] leading-relaxed opacity-60">专项接管，提升渗水识别精度。</p>
            </div>
          </div>
          <div className="relative flex items-center justify-center py-1">
            <div className="absolute inset-x-0 top-1/2 h-px bg-black/[0.05]" />
            <span className="relative bg-white/40 px-4 py-1 text-[9px] font-bold uppercase tracking-[0.3em] text-black/25 backdrop-blur-sm">
              Arbitrate & Label
            </span>
          </div>
          <div className={`rounded-[1.5rem] border p-5 shadow-inner ${nodes[3].tone}`}>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">Fusion Engine</p>
            <p className="mt-2 text-[1.125rem] font-bold">{nodes[3].label}</p>
            <p className="mt-2 text-[0.8125rem] leading-relaxed opacity-70">按类别动态调配，输出唯一确定性 JSON 响应。</p>
          </div>
        </div>

        <div className={`flex flex-col justify-center rounded-[1.5rem] border p-5 ${nodes[4].tone}`}>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-40">Endpoint Result</p>
          <p className="mt-2 text-[1.125rem] font-bold tracking-tight">{nodes[4].label}</p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed opacity-60">全口径数据回传，支持耗时拆解与图层导出。</p>
        </div>
      </div>
    </div>
  );
}

function ArchitectureDiagram() {
  const layers = [
    {
      title: "展示层",
      items: ["HomeShell", "ResultDashboard", "成果展示页"],
      tone: "border-[#4D8DFF]/20 bg-[#4D8DFF]/8",
    },
    {
      title: "服务层",
      items: ["API Routes", "PredictService", "统一 Schema"],
      tone: "border-[#00D2FF]/20 bg-[#00D2FF]/8",
    },
    {
      title: "模型管理层",
      items: ["Registry", "Manager", "Weights"],
      tone: "border-[#7FFFD4]/25 bg-[#7FFFD4]/10",
    },
    {
      title: "推理执行层",
      items: ["UltralyticsRunner", "FusionRunner"],
      tone: "border-[#18181B]/15 bg-[#18181B] text-white",
    },
  ];

  return (
    <div className="rounded-[2.25rem] border border-black/[0.03] bg-white/40 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.3em] text-black/30">ARCHITECTURE LAYERS</p>
        <div className="flex gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-black/[0.1]" />
          <div className="h-1.5 w-1.5 rounded-full bg-black/[0.05]" />
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {layers.map((layer, layerIndex) => (
          <div key={layer.title} className="group relative">
            {layerIndex < layers.length - 1 ? (
              <div className="absolute left-8 top-full h-4 w-px bg-black/[0.08]" />
            ) : null}
            <div className={`overflow-hidden rounded-[1.5rem] border p-5 transition-all duration-300 hover:shadow-lg ${layer.tone} ${layer.tone.includes("bg-[#18181B]") ? "border-white/5" : "border-black/[0.03]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ${layer.tone.includes("text-white") ? "bg-white/10 text-white/40" : "bg-black/5 text-black/30"}`}>
                    0{layerIndex + 1}
                  </span>
                  <p className="text-[1.125rem] font-bold tracking-tight">{layer.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {layer.items.map((item) => (
                    <span
                      key={item}
                      className={`rounded-xl px-3 py-1.5 text-[0.75rem] font-medium backdrop-blur-sm transition-all hover:scale-105 ${layer.tone.includes("text-white") ? "bg-white/5 text-white/70 hover:bg-white/10" : "bg-white/60 text-black/60 hover:bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)]"}`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MeetingShowcase() {
  const [index, setIndex] = useState(0);
  const wheelLockRef = useRef(false);
  const activeSlide = slides[index];

  const progress = useMemo(() => ((index + 1) / slides.length) * 100, [index]);

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= slides.length) {
      return;
    }
    setIndex(nextIndex);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goTo(Math.min(index + 1, slides.length - 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goTo(Math.max(index - 1, 0));
      }
      if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        goTo(slides.length - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index]);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 36;
      if (!horizontalIntent) {
        return;
      }
      if (wheelLockRef.current) {
        return;
      }

      const direction = event.deltaX;
      if (direction > 0) {
        goTo(Math.min(index + 1, slides.length - 1));
      } else {
        goTo(Math.max(index - 1, 0));
      }

      wheelLockRef.current = true;
      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 650);
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [index]);

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#fafafa] text-[#09090B]">
      {/* 动态渐变背景 */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute -right-[10%] bottom-[10%] h-[55%] w-[55%] rounded-full bg-indigo-500/8 blur-[100px]" />
        <div className="absolute left-[20%] top-[40%] h-[40%] w-[40%] rounded-full bg-teal-400/5 blur-[80px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.025] contrast-125" />
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-0 w-px -translate-x-1/2 bg-[linear-gradient(180deg,transparent,rgba(9,9,11,0.06),transparent)]" />

      {/* Header 与 进度条 */}
      <header className="relative z-40 w-full px-4 pt-4 sm:px-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="group relative h-1 w-full overflow-hidden rounded-full bg-black/[0.04] backdrop-blur-sm">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ 
                backgroundColor: activeSlide.accent,
                boxShadow: `0 0 10px ${activeSlide.accent}30`
              }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </header>

      {/* 主展示区 */}
      <section className="relative z-10 flex flex-1 w-full items-stretch overflow-hidden">
        <motion.div
          className="flex w-full"
          animate={{ x: `-${index * 100}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {slides.map((slide, slideIndex) => (
            <section
              key={slide.title}
              className="flex h-full w-full shrink-0 basis-full items-center justify-center overflow-hidden px-4 pb-6 pt-4 sm:px-6 lg:pb-12"
              aria-hidden={slideIndex !== index}
            >
              <div className="mx-auto grid w-full max-w-[1500px] gap-6 h-full lg:grid-cols-[1.1fr_0.9fr]">
                {/* 左侧主要内容卡片 */}
                <div className="group relative flex flex-1 flex-col overflow-hidden rounded-[2.5rem] border border-black/[0.04] bg-white/75 shadow-[0_32px_100px_-12px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all duration-500 hover:shadow-[0_45px_120px_-15px_rgba(0,0,0,0.12)] p-5 sm:p-8 lg:p-10">
                  <div
                    className="absolute inset-x-0 top-0 h-1 transition-all duration-500 group-hover:h-1.5"
                    style={{ backgroundColor: slide.accent }}
                  />
                  
                  <motion.div
                    animate={{
                      opacity: slideIndex === index ? 1 : 0.42,
                      scale: slideIndex === index ? 1 : 0.98,
                      y: slideIndex === index ? 0 : 20,
                    }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="flex flex-1 flex-col space-y-6 overflow-y-auto scrollbar-hide"
                  >
                    <div className="space-y-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-black/40">
                        {slide.eyebrow}
                      </p>
                      <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-[#18181B] sm:text-4xl lg:text-5xl">
                        {slide.title}
                      </h1>
                      <p className="max-w-3xl text-base font-medium leading-[1.6] text-black/80 sm:text-lg lg:text-xl">
                        {slide.kicker}
                      </p>
                      <p className="max-w-3xl text-sm leading-relaxed text-black/50 sm:text-base">
                        {slide.summary}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {slide.stats.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[1.75rem] border border-black/[0.03] bg-black/[0.02] p-4 transition-all hover:bg-black/[0.04] hover:shadow-sm"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-black/30">
                            {item.label}
                          </p>
                          <p className="mt-2 text-xl font-bold tracking-tight text-[#18181B]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {slide.highlights.map((item, itemIndex) => (
                        <div
                          key={item}
                          className="rounded-[1.75rem] border border-black/[0.04] bg-[#18181b] p-4 shadow-lg shadow-black/5 transition-transform hover:-translate-y-1"
                        >
                          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-white/30">
                            KEY POINT 0{itemIndex + 1}
                          </p>
                          <p className="mt-2 text-[0.875rem] font-medium leading-relaxed text-white/90">{item}</p>
                        </div>
                      ))}
                    </div>

                    {slideIndex === 0 ? <DualModelDiagram /> : null}
                    {slideIndex === 2 ? <ArchitectureDiagram /> : null}
                  </motion.div>
                </div>

                {/* 右侧边栏：讲稿与辅助流程 */}
                <div className="flex flex-col gap-6 overflow-hidden">
                  {/* 讲稿区域 - 模拟提词器 */}
                  <div className="relative flex-1 overflow-hidden rounded-[2.5rem] border border-white/[0.04] bg-[#0c0c0e] shadow-[0_45px_120px_-20px_rgba(0,0,0,0.3)]">
                    <div
                      className="absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[100px]"
                      style={{ backgroundColor: slide.accent, opacity: 0.12 }}
                    />
                    <div className="relative flex h-full flex-col p-6 lg:p-8">
                      <div className="mb-4 flex items-center justify-between border-b border-white/[0.05] pb-3">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/25">
                          PROMPT / SCRIPT
                        </p>
                        <div className="flex gap-1.5">
                          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
                          <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-hide">
                        {slide.script.map((paragraph, paragraphIndex) => (
                          <div
                            key={paragraph}
                            className="group/item relative rounded-2xl border border-white/[0.03] bg-white/[0.02] px-5 py-4 transition-all duration-300 hover:bg-white/[0.05] hover:shadow-xl"
                          >
                            <span className="mb-2 block font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-white/20 group-hover/item:text-white/40">
                              SEQUENCE 0{paragraphIndex + 1}
                            </span>
                            <p className="text-[0.9375rem] leading-relaxed text-white/75 transition-colors group-hover/item:text-white">
                              {paragraph}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 辅助流程卡片 */}
                  <div className="grid h-fit gap-4 sm:grid-cols-2">
                    <div className="group/link rounded-[2rem] border border-black/[0.03] bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-md">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-black/30">
                        PROCESS FLOW
                      </p>
                      <div className="mt-4 space-y-2.5 text-[0.8125rem] font-medium leading-relaxed text-black/55">
                        {slide.flow.map((item, i) => (
                          <div key={item} className="flex items-start gap-3">
                            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-black/5 text-[9px] group-hover/link:bg-black group-hover/link:text-white transition-colors">
                              {i + 1}
                            </span>
                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="group/link rounded-[2rem] border border-black/[0.03] bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-md">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-black/30">
                        INFRA STACK
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {slide.architecture.map((item) => (
                          <span 
                            key={item} 
                            className="rounded-lg border border-black/[0.04] bg-white/40 px-3 py-1.5 text-[0.75rem] font-bold text-black/50 transition-all group-hover/link:border-black/10 group-hover/link:bg-white"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </motion.div>
      </section>

      {/* 底部固定导航栏 */}
      <footer className="relative z-40 border-t border-black/[0.04] bg-white/60 px-4 pb-6 pt-5 backdrop-blur-3xl transition-all duration-300 sm:px-6">
        <div className="mx-auto max-w-[1500px]">
          {/* 使用 Grid 3 Columns 确保中心指示器绝对居中 */}
          <div className="grid grid-cols-3 items-center gap-4">
            {/* 左侧：翻页控制与信息 */}
            <div className="flex items-center gap-5 justify-self-start">
              <button
                type="button"
                onClick={() => goTo(Math.max(index - 1, 0))}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/[0.03] bg-white/80 text-black/30 shadow-sm transition-all hover:bg-black hover:text-white hover:shadow-xl hover:-translate-y-0.5 active:scale-95 disabled:opacity-20"
                disabled={index === 0}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div className="hidden min-w-0 flex-1 sm:block">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-black/25">
                  PAGE {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                </p>
                <p className="truncate text-[0.9375rem] font-bold tracking-tight text-black/80">
                  {activeSlide.title}
                </p>
              </div>
            </div>

            {/* 中间：分点进度指示器 - 真正的水平居中 */}
            <div className="justify-self-center">
              <div className="flex items-center gap-2 rounded-2xl border border-black/[0.03] bg-black/[0.02] p-2 px-3.5 shadow-inner backdrop-blur-sm sm:gap-3 sm:px-4">
                {slides.map((slide, dotIndex) => {
                  const isActive = dotIndex === index;
                  return (
                    <button
                      key={slide.title}
                      type="button"
                      onClick={() => goTo(dotIndex)}
                      className="group relative h-4 w-4 sm:h-5 sm:w-5"
                      aria-label={`Go to slide ${dotIndex + 1}`}
                    >
                      <span
                        className={`absolute inset-1 rounded-full transition-all duration-700 ease-out ${isActive ? "scale-100 opacity-100 shadow-[0_0_12px_rgba(0,0,0,0.15)]" : "scale-[0.4] opacity-20 group-hover:scale-60 group-hover:opacity-40"}`}
                        style={{ backgroundColor: slide.accent }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 右侧：动作控制 */}
            <div className="flex items-center gap-4 justify-self-end">
              <Link
                href="/dashboard"
                className="hidden rounded-2xl border border-black/[0.03] bg-white/80 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-black/40 shadow-sm transition-all hover:bg-black hover:text-white hover:shadow-xl hover:-translate-y-0.5 lg:inline-flex"
              >
                WORKSPACE
              </Link>
              <button
                type="button"
                onClick={() => goTo(Math.min(index + 1, slides.length - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/[0.03] bg-white/80 text-black/30 shadow-sm transition-all hover:bg-black hover:text-white hover:shadow-xl hover:-translate-y-0.5 active:scale-95 disabled:opacity-20"
                disabled={index === slides.length - 1}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
