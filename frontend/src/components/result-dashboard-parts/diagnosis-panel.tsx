import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";

interface DiagnosisPanelProps {
  diagnosis: string;
  diagnosisMode: "auto" | "cached";
  hasStoredDiagnosis: boolean | null;
  isDiagnosisLoading: boolean;
  thinkingIndex: number;
  thinkingSteps: string[];
  onGenerateDiagnosis: () => void;
}

export function DiagnosisPanel({
  diagnosis,
  diagnosisMode,
  hasStoredDiagnosis,
  isDiagnosisLoading,
  thinkingIndex,
  thinkingSteps,
  onGenerateDiagnosis,
}: DiagnosisPanelProps) {
  return (
    <div className="group relative flex h-[440px] flex-col overflow-hidden rounded-2xl border border-[#7FFFD4]/30 bg-[linear-gradient(180deg,rgba(127,255,212,0.08),rgba(5,8,10,0.6))] p-4 shadow-2xl transition-all hover:bg-[#7FFFD4]/8 hover:border-[#7FFFD4]/30">
      <div className="absolute right-0 top-0 p-8 opacity-10 transition-opacity group-hover:opacity-20">
        <svg className="h-10 w-10 text-[#7FFFD4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} />
        </svg>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="h-1.5 w-8 rounded-full bg-gradient-to-r from-[#7FFFD4] to-transparent" />
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7FFFD4]">
          核心诊断建议
        </p>
        <div className="ml-2 flex items-center gap-1.5">
          <span className="rounded border border-[#7FFFD4]/20 bg-[#7FFFD4]/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-[#7FFFD4]">OpenCode AI</span>
          <span className="rounded border border-[#00D2FF]/20 bg-[#00D2FF]/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-[#00D2FF]">Kimi K2.5</span>
        </div>
        {isDiagnosisLoading ? (
          <div className="ml-auto flex items-center gap-2 rounded-full border border-[#7FFFD4]/20 bg-[#7FFFD4]/10 px-2.5 py-1">
            <span className="animate-pulse text-[9px] font-medium uppercase text-[#7FFFD4]">Analyzing</span>
            <span className="flex gap-1">
              <span className="h-1 w-1 animate-bounce rounded-full bg-[#7FFFD4]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-[#7FFFD4] [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-[#7FFFD4] [animation-delay:-0.3s]" />
            </span>
          </div>
        ) : null}
      </div>

      <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-[#7FFFD4]/35">
        <span>固定诊断面板</span>
        <span>滚动查看完整内容</span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[#7FFFD4]/10 bg-black/10">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-[#071014] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[#071014] to-transparent" />

        <div className="custom-scrollbar prose prose-emerald prose-invert h-full max-w-none overflow-y-auto scroll-smooth px-1 pr-3 text-[13px] font-light leading-[1.75] text-[#7FFFD4]/90">
          {diagnosis ? (
            <ReactMarkdown
              components={{
                h3: ({ ...props }) => <h3 className="mt-6 mb-2 rounded-r border-l-4 border-[#7FFFD4] bg-[#7FFFD4]/5 py-1.5 pl-3 text-sm font-bold text-[#7FFFD4]" {...props} />,
                p: ({ ...props }) => <p className="mb-3 last:mb-0 leading-relaxed opacity-90" {...props} />,
                strong: ({ ...props }) => <strong className="font-semibold text-[#00D2FF]" {...props} />,
                li: ({ ...props }) => <li className="relative mb-2 list-none pl-5 before:absolute before:left-0 before:text-[#7FFFD4] before:content-['▹']" {...props} />,
              }}
            >
              {diagnosis}
            </ReactMarkdown>
          ) : diagnosisMode === "cached" && hasStoredDiagnosis === false && !isDiagnosisLoading ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-5 px-6 text-center">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#7FFFD4]/15 bg-[#7FFFD4]/5" />
                <div className="absolute inset-0 flex items-center justify-center text-[#7FFFD4]">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#7FFFD4]/65">
                  尚未生成专家报告
                </p>
                <p className="text-[12px] leading-relaxed text-[#7FFFD4]/40">
                  当前历史记录已有识别结果，但还没有保存过大模型诊断报告。
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-[#7FFFD4]/30 bg-[#7FFFD4]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7FFFD4] transition-colors hover:bg-[#7FFFD4]/15"
                onClick={onGenerateDiagnosis}
              >
                生成专家报告
              </button>
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-6">
              <div className="relative">
                <div className="flex h-16 w-16 animate-spin-slow items-center justify-center rounded-full border-2 border-[#7FFFD4]/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2 w-2 animate-ping rounded-full bg-[#7FFFD4]" />
                </div>
                <div className="absolute -inset-4 animate-pulse rounded-full border border-[#7FFFD4]/5" />
              </div>
              <div className="space-y-2 text-center">
                <p className="text-xs font-mono uppercase tracking-[0.1em] text-[#7FFFD4]/60">
                  {isDiagnosisLoading ? "Consulting Digital Twin..." : "System Idle"}
                </p>
                {isDiagnosisLoading ? (
                  <motion.p
                    key={thinkingIndex}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] italic font-light text-[#7FFFD4]/30"
                    initial={{ opacity: 0, y: 5 }}
                  >
                    {thinkingSteps[thinkingIndex]}
                  </motion.p>
                ) : null}
              </div>
            </div>
          )}
          {isDiagnosisLoading ? <span className="ml-2 inline-block h-4 w-2 animate-pulse align-middle bg-[#7FFFD4]" /> : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#7FFFD4]/10 pt-3">
        <p className="text-[10px] italic text-[#7FFFD4]/40">
          {diagnosisMode === "cached" && hasStoredDiagnosis === false
            ? "历史详情页默认只读取已保存报告，避免进入页面时重复生成。"
            : "Powered by OpenCode Kimi K2.5 • 基于结构化特征与桥梁巡检规范之量化评估报告"}
        </p>
        <div className="flex gap-4">
          <span className="h-1 w-8 rounded-full bg-[#7FFFD4]/20" />
          <span className="h-1 w-8 rounded-full bg-[#00D2FF]/20" />
        </div>
      </div>
    </div>
  );
}
