import { filterDetections, formatConfidence, getDetectionSummary } from "@/lib/result-utils";
import type { PredictionResult } from "@/lib/types";

interface ResultDashboardProps {
  result: PredictionResult;
  categoryFilter: string;
  minConfidence: number;
}

export function ResultDashboard({
  result,
  categoryFilter,
  minConfidence
}: ResultDashboardProps) {
  const filteredDetections = filterDetections(
    result.detections,
    categoryFilter,
    minConfidence
  );

  const categories = ["全部", ...new Set(result.detections.map((item) => item.category))];

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Result View
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">识别结果主画面</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            {result.image_id}
          </span>
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(172,203,238,0.32),_transparent_45%),linear-gradient(135deg,#f8fafc,#dbeafe)] p-6">
          <div className="aspect-[16/10] rounded-[1.5rem] border border-white/70 bg-[linear-gradient(160deg,rgba(15,23,42,0.12),rgba(15,23,42,0.02)),url('data:image/svg+xml,%3Csvg width=%27240%27 height=%27140%27 viewBox=%270 0 240 140%27 fill=%27none%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Crect width=%27240%27 height=%27140%27 fill=%27%23dbeafe%27/%3E%3Cpath d=%27M0 96C35 87 65 72 95 72C128 72 152 104 183 104C206 104 220 92 240 79V140H0V96Z%27 fill=%27%23cbd5e1%27/%3E%3Cpath d=%27M0 24C26 33 56 50 95 52C132 54 175 36 240 8V0H0V24Z%27 fill=%27%23e2e8f0%27/%3E%3C/svg%3E')] bg-cover bg-center p-6 shadow-inner">
            <div className="relative h-full w-full overflow-hidden rounded-[1.1rem] border border-slate-900/10 bg-white/65 backdrop-blur">
              {result.detections.map((item) => (
                <div
                  key={item.id}
                  className="absolute rounded-2xl border-2 border-teal-500/80 bg-teal-400/15"
                  style={{
                    left: `${Math.min(item.bbox.x / 8, 75)}%`,
                    top: `${Math.min(item.bbox.y / 6, 70)}%`,
                    width: `${Math.min(item.bbox.width / 8, 35)}%`,
                    height: `${Math.min(item.bbox.height / 5, 25)}%`
                  }}
                >
                  <span className="absolute -top-8 left-0 rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                    {item.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            当前为 Phase 2 的可视化占位画面，后续接入真实 overlay 图后仍沿用相同布局。
          </p>
        </div>
      </div>

      <aside className="space-y-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Summary
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            {getDetectionSummary(result)}
          </h3>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">推理耗时</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-950">
                {result.inference_ms} ms
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">模型版本</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-950">
                {result.model_version}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category}
                className={`rounded-full px-3 py-1 text-sm ${
                  category === categoryFilter
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {category}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            当前最小置信度筛选值：{formatConfidence(minConfidence)}
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Findings
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">病害列表</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {filteredDetections.length} 条
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {filteredDetections.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-950">{item.category}</h4>
                    <p className="text-sm text-slate-500">{item.id}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700">
                    {formatConfidence(item.confidence)}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">长度</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {item.metrics.length_mm ? `${item.metrics.length_mm} mm` : "待计算"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">宽度</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {item.metrics.width_mm ? `${item.metrics.width_mm} mm` : "待计算"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">面积</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {item.metrics.area_mm2 ? `${item.metrics.area_mm2} mm²` : "待计算"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
