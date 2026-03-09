import { filterDetections, getDetectionSummary } from "@/lib/result-utils";
import type { PredictionResult } from "@/lib/types";

interface ResultDashboardProps {
  result: PredictionResult;
  categoryFilter: string;
  minConfidence: number;
  previewUrl?: string | null;
  onExportJson: () => void;
  onExportOverlay: () => void;
  overlayDisabled: boolean;
}

function getCategoryColor(category: string) {
  const norm = category.toLowerCase();
  if (norm.includes("crack") || norm.includes("裂缝")) return "border-[#FF4D4D] bg-[#FF4D4D]/10 text-[#FF4D4D]";
  if (norm.includes("spalling") || norm.includes("剥落")) return "border-[#FFC107] bg-[#FFC107]/10 text-[#FFC107]";
  if (norm.includes("efflo") || norm.includes("泛碱")) return "border-[#00D2FF] bg-[#00D2FF]/10 text-[#00D2FF]";
  return "border-emerald-400 bg-emerald-400/10 text-emerald-400";
}

export function ResultDashboard({
  result,
  categoryFilter,
  minConfidence,
  previewUrl,
  onExportJson,
  onExportOverlay,
  overlayDisabled
}: ResultDashboardProps) {
  const filteredDetections = filterDetections(
    result.detections,
    categoryFilter,
    minConfidence
  );

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full">
      {/* 图像监控主界面区 */}
      <div className="flex-1 rounded-[1.5rem] border border-white/10 bg-[#1E293B]/70 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col xl:col-span-2 min-h-[500px]">
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0B1120]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-xs font-mono text-slate-300">LIVE / {result.image_id}</span>
          </div>
          <div className="flex gap-2">
            <button
              aria-label="导出 JSON"
              className="h-8 rounded-md border border-white/10 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
              type="button"
              onClick={onExportJson}
            >
              JSON
            </button>
            <button
              aria-label="导出 Overlay"
              className="h-8 rounded-md border border-white/10 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={overlayDisabled}
              type="button"
              onClick={onExportOverlay}
            >
              Overlay
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.03),transparent_70%),linear-gradient(180deg,#0B1120,#0F172A)] relative p-6 flex items-center justify-center overflow-auto">
          {/* 画布主内容 - 带框图展示 */}
          <div className="relative max-h-full max-w-full rounded-lg ring-1 ring-white/10 shadow-2xl inline-block bg-[#0B1120] pb-[56.25%] w-full">
            {/* 实际图传底图或占位 SVG */}
            {previewUrl ? (
              <img src={previewUrl} alt="Inspection" className="absolute inset-0 w-full h-full object-fill opacity-90 rounded-lg" />
            ) : (
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] bg-repeat" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

            <div className="absolute inset-0 z-10">
              {result.detections.map((item) => {
                const colorCls = getCategoryColor(item.category);
                // BBox mapping mock scaling
                return (
                  <div
                    key={item.id}
                    className={`absolute border-[1.5px] rounded-sm group hover:border-[2.5px] transition-all cursor-crosshair box-border hover:shadow-[0_0_15px_currentColor] ${colorCls}`}
                    style={{
                      left: `${Math.min(item.bbox.x / 8, 75)}%`,
                      top: `${Math.min(item.bbox.y / 6, 70)}%`,
                      width: `${Math.min(item.bbox.width / 8, 35)}%`,
                      height: `${Math.min(item.bbox.height / 5, 25)}%`,
                      backgroundColor: 'transparent' // BBox is transparent, hover adds glow
                    }}
                  >
                    <div className="absolute inset-0 bg-current opacity-10 group-hover:opacity-20 transition-opacity" />
                    <span className="absolute -top-[21px] left-[-1.5px] px-1.5 py-0.5 text-[10px] font-mono font-bold bg-current text-[#0B1120] whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity shadow-sm">
                      {item.category.toUpperCase()} {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="absolute bottom-4 left-6 right-6 flex justify-between text-[10px] font-mono text-slate-500 pointer-events-none">
            <span>YOLOV8-SEG / {filteredDetections.length} DETECTIONS</span>
            <span>{new Date().toISOString().split('T')[1].slice(0, 8)} UTC</span>
          </div>
        </div>
      </div>

      {/* 病害详情列表 - 嵌入主画布右侧作为辅助，或者在窄屏时下放 */}
      <aside className="w-full xl:w-96 shrink-0 flex flex-col gap-6">
        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 p-5 shadow-lg backdrop-blur shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-2">Analysis Summary</p>
          <h3 className="text-xl text-slate-100 font-light tracking-tight">{getDetectionSummary(result)}</h3>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">Total Found</div>
              <div className="text-xl font-mono text-white">{filteredDetections.length}</div>
            </div>
            <div className="bg-[#0B1120]/50 rounded-lg p-3 border border-white/5">
              <div className="text-xs text-slate-400 mb-1">Avg Confidence</div>
              <div className="text-xl font-mono text-sky-400">
                {filteredDetections.length
                  ? (filteredDetections.reduce((a, b) => a + b.confidence, 0) / filteredDetections.length * 100).toFixed(1) + '%'
                  : '--'}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#1E293B]/60 shadow-lg backdrop-blur flex-1 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Anomaly List</p>
            <span className="font-mono text-xs text-slate-400">{filteredDetections.length} Items</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredDetections.map((item, index) => {
              const colorCls = getCategoryColor(item.category);
              const colorCode = colorCls.match(/text-\[(.*?)\]/)?.[1] || "#10B981";

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">{String(index + 1).padStart(2, '0')}.</span>
                      <h4 className="text-sm font-medium text-slate-200 uppercase">{item.category}</h4>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded border border-white/10" style={{ color: colorCode }}>
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 truncate w-10">Id</span>
                      <span className="font-mono text-slate-300 truncate" title={item.id}>{item.id.split('-')[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-10">Size</span>
                      <span className="font-mono text-slate-300">
                        {item.metrics.length_mm ? `${(item.metrics.length_mm / 10).toFixed(1)}cm` : "--"}
                      </span>
                    </div>
                    <div className="flex gap-2 col-span-2">
                      <span className="text-slate-500 w-10">Area</span>
                      <span className="font-mono text-slate-300">
                        {item.metrics.area_mm2 ? `${(item.metrics.area_mm2 / 100).toFixed(1)}cm²` : "--"}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredDetections.length === 0 && (
              <div className="h-32 flex items-center justify-center text-sm text-slate-500 font-mono">
                [ NO DATA MATCHES FILTERS ]
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
