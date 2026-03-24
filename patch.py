import sys

def patch():
    with open('frontend/src/components/result-dashboard.tsx', 'r') as f:
        lines = f.readlines()
    
    # Lines 347 to 480 (0-indexed 346 to 479)
    # The original outer div stays open, containing the new unified horizontal bar.
    new_code = """          <div className="relative border-b border-white/5 bg-[linear-gradient(180deg,rgba(5,8,10,0.4),rgba(5,8,10,0.1))] px-6 py-4 shrink-0 z-10">
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
                <details className="relative">
                  <summary className="flex h-8 cursor-pointer list-none items-center rounded-lg px-3 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white">
                    导出与下载
                  </summary>
                  <div className="absolute right-0 top-10 z-20 flex min-w-[160px] flex-col gap-1 rounded-xl border border-white/10 bg-[#0B1120]/95 p-2 shadow-2xl backdrop-blur">
                    <button
                      className="rounded-md px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      type="button"
                      onClick={onExportJson}
                    >
                      下载 JSON
                    </button>
                    <button
                      className="rounded-md px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={resultDisabled}
                      type="button"
                      onClick={onExportOverlay}
                    >
                      保存结果图
                    </button>
                  </div>
                </details>
                <button
                  className="h-8 rounded-lg px-3 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                  type="button"
                  onClick={onOpenHistory}
                >
                  历史记录
                </button>
                <button
                  className="ml-2 h-8 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 text-[11px] font-bold tracking-widest uppercase text-sky-300 transition-colors hover:bg-sky-500/20 hover:text-white"
                  title={primaryActionTitle}
                  type="button"
                  onClick={handlePrimaryAction}
                >
                  {primaryActionLabel}
                </button>
              </div>
            </div>\n"""
            
    # Replacement 2: CAMERA FEED tag at lines 520-535.
    camera_feed_code = """              <div className="relative flex items-center justify-between gap-3 border-b border-white/6 px-5 py-3 bg-[linear-gradient(to_bottom,currentColor_0%,transparent_100%)] text-sky-900/10 z-20">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-500/80">
                  CAMERA FEED
                </span>
                <span className="shrink-0 text-[10px] font-mono text-white/40">
                  {formatResultTimestamp(result.created_at)} UTC
                </span>
              </div>\n"""

    lines[519:535] = [camera_feed_code]
    lines[346:480] = [new_code]
    
    with open('frontend/src/components/result-dashboard.tsx', 'w') as f:
        f.writelines(lines)

patch()
