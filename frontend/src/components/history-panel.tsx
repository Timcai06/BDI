import type { PredictionHistoryItem } from "@/lib/types";

interface HistoryPanelProps {
  items: PredictionHistoryItem[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (imageId: string) => void;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function HistoryPanel({
  items,
  loading,
  onRefresh,
  onSelect
}: HistoryPanelProps) {
  return (
    <div className="h-full rounded-[2rem] border border-white/10 bg-[#1E293B]/60 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
            History
          </p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-white">
            历史识别结果
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            复用本地结果文件回看最近的检测记录。
          </p>
        </div>
        <button
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
          type="button"
          onClick={onRefresh}
        >
          刷新列表
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-slate-400">
            正在读取历史结果...
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-slate-400">
            暂无历史结果，可先上传一张巡检图像生成记录。
          </div>
        ) : null}

        {!loading
          ? items.map((item) => (
              <button
                key={item.image_id}
                className="flex w-full items-start justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.06]"
                type="button"
                onClick={() => onSelect(item.image_id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] text-sky-400">
                      {item.backend}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatTime(item.created_at)}
                    </span>
                  </div>
                  <h3 className="mt-3 truncate text-sm font-medium text-white">
                    {item.image_id}
                  </h3>
                  <p className="mt-2 text-xs text-slate-400">
                    {item.model_name} / {item.model_version} / {item.inference_mode}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-lg font-mono text-sky-400">
                    {item.detection_count}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    detections
                  </div>
                  <div className="mt-3 text-xs font-mono text-slate-400">
                    {item.inference_ms}ms
                  </div>
                </div>
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
