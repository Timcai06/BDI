import type { Detection } from "@/lib/types";

interface ResultDashboardToolbarProps {
  viewMode: "image" | "result" | "mask";
  onViewModeChange: (mode: "image" | "result" | "mask") => void;
  resultDisabled: boolean;
  maskDisabled: boolean;
  showHistoryButton: boolean;
  onOpenHistory: () => void;
  showPrimaryActionButton: boolean;
  primaryActionTitle: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  comparisonResultExists: boolean;
  hasEnhancedResult: boolean;
  onGenerateEnhancement?: () => void | Promise<void>;
  enhancementPending: boolean;
  showEnhancementCompare: boolean;
  onToggleEnhancementCompare: () => void;
  onOpenExport: () => void;
  currentDetection: Detection | null;
}

function getEnhancementButtonTitle({
  comparisonResultExists,
  hasEnhancedResult,
  onGenerateEnhancement,
}: Pick<
  ResultDashboardToolbarProps,
  "comparisonResultExists" | "hasEnhancedResult" | "onGenerateEnhancement"
>): string {
  if (comparisonResultExists) {
    return "请先清除模型对比结果";
  }
  if (!hasEnhancedResult && !onGenerateEnhancement) {
    return "当前记录没有增强结果";
  }
  if (hasEnhancedResult) {
    return "切换增强识别结果";
  }
  return "生成增强识别结果";
}

function getEnhancementButtonLabel({
  enhancementPending,
  hasEnhancedResult,
  showEnhancementCompare,
}: Pick<ResultDashboardToolbarProps, "enhancementPending" | "hasEnhancedResult" | "showEnhancementCompare">): string {
  if (enhancementPending) {
    return "增强中...";
  }
  if (!hasEnhancedResult) {
    return "增强";
  }
  return showEnhancementCompare ? "查看原图" : "查看增强";
}

export function ResultDashboardToolbar({
  viewMode,
  onViewModeChange,
  resultDisabled,
  maskDisabled,
  showHistoryButton,
  onOpenHistory,
  showPrimaryActionButton,
  primaryActionTitle,
  primaryActionLabel,
  onPrimaryAction,
  comparisonResultExists,
  hasEnhancedResult,
  onGenerateEnhancement,
  enhancementPending,
  showEnhancementCompare,
  onToggleEnhancementCompare,
  onOpenExport,
}: ResultDashboardToolbarProps) {
  const enhancementDisabled =
    enhancementPending || comparisonResultExists || (!hasEnhancedResult && !onGenerateEnhancement);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 w-full">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
            AI 分析看板
          </span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex rounded-lg border border-white/8 bg-black/20 p-1">
          <button
            aria-pressed={viewMode === "image"}
            className={`h-7 rounded-md px-3 text-[11px] font-semibold transition-colors ${
              viewMode === "image"
                ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-slate-400 hover:bg-white/5 hover:text-white/80"
            }`}
            type="button"
            onClick={() => onViewModeChange("image")}
          >
            原图
          </button>
          <button
            aria-pressed={viewMode === "result"}
            className={`h-7 rounded-md px-3 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              viewMode === "result"
                ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-slate-400 hover:bg-white/5 hover:text-white/80"
            }`}
            disabled={resultDisabled}
            type="button"
            onClick={() => onViewModeChange("result")}
          >
            结果图
          </button>
          <button
            aria-pressed={viewMode === "mask"}
            className={`h-7 rounded-md px-3 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              viewMode === "mask"
                ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-slate-400 hover:bg-white/5 hover:text-white/80"
            }`}
            disabled={maskDisabled}
            type="button"
            onClick={() => onViewModeChange("mask")}
          >
            掩膜图
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex h-8 items-center rounded-lg bg-white/5 px-3 text-[11px] font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white border border-white/5"
          type="button"
          onClick={onOpenExport}
        >
          <svg className="mr-2 h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          导出与下载
        </button>

        {showHistoryButton ? (
          <button
            className="h-8 rounded-lg px-3 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            type="button"
            onClick={onOpenHistory}
          >
            历史记录
          </button>
        ) : null}

        {showPrimaryActionButton ? (
          <button
            className="ml-2 h-8 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 text-[11px] font-bold tracking-widest uppercase text-sky-300 transition-colors hover:bg-sky-500/20 hover:text-white"
            title={primaryActionTitle}
            type="button"
            onClick={onPrimaryAction}
          >
            {primaryActionLabel}
          </button>
        ) : null}

        <button
          className="h-8 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-[11px] font-bold tracking-widest uppercase text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
          type="button"
          title={getEnhancementButtonTitle({ comparisonResultExists, hasEnhancedResult, onGenerateEnhancement })}
          disabled={enhancementDisabled}
          onClick={() => {
            if (hasEnhancedResult) {
              onToggleEnhancementCompare();
              return;
            }
            void onGenerateEnhancement?.();
          }}
        >
          {getEnhancementButtonLabel({ enhancementPending, hasEnhancedResult, showEnhancementCompare })}
        </button>
      </div>
    </div>
  );
}
