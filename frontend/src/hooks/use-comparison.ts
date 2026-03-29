import { useMemo } from "react";
import type { Detection, PredictionResult } from "@/lib/types";
import { 
  alignDetectionsByInstance, 
  buildDetectionCategoryDiff 
} from "@/lib/result-utils";
import { formatModelLabel, formatDetectionSourceLabel } from "@/lib/model-labels";

export interface ComparisonMetrics {
  totalLength: number;
  totalArea: number;
  count: number;
  averageConfidence: number;
}

export interface ComparisonSummary {
  detectionDelta: number;
  inferenceDelta: number;
  matchedCount: number;
  primaryOnlyCount: number;
  comparisonOnlyCount: number;
  recommendation: string;
}

function calculateMetrics(detections: Detection[]): ComparisonMetrics {
  const totals = {
    totalLength: 0,
    totalArea: 0,
    count: detections.length,
    averageConfidence: 0,
  };

  if (detections.length === 0) return totals;

  let totalConfidence = 0;
  for (const detection of detections) {
    if (detection.metrics.length_mm) totals.totalLength += detection.metrics.length_mm;
    if (detection.metrics.area_mm2) totals.totalArea += detection.metrics.area_mm2;
    totalConfidence += detection.confidence;
  }

  totals.averageConfidence = totalConfidence / detections.length;
  return totals;
}

function getRecommendation(
  primary: PredictionResult,
  comparison: PredictionResult,
  summary: { matched: number; primaryOnly: number; comparisonOnly: number }
): string {
  const detectionDelta = comparison.detections.length - primary.detections.length;
  const inferenceDelta = comparison.inference_ms - primary.inference_ms;

  if (detectionDelta === 0) {
    if (summary.matched > 0 && (summary.primaryOnly > 0 || summary.comparisonOnly > 0)) {
      return `两版总数一致，但位置存在差异。建议对比叠加视图以确认对齐精度。`;
    }
    return inferenceDelta <= 0 
      ? `结果一致，${formatModelLabel(comparison)} 耗时更短，建议采用。` 
      : `结果一致，主模型 ${formatModelLabel(primary)} 效率更高。`;
  }

  if (detectionDelta > 0) {
    return `${formatModelLabel(comparison)} 额外检出 ${summary.comparisonOnly} 处目标，建议核实是否包含漏检。`;
  }

  return `${formatModelLabel(primary)} 检测结果更全面，当前主模型更具优势。`;
}

export function useComparison(
  primaryResult: PredictionResult,
  comparisonResult: PredictionResult | null | undefined
) {
  return useMemo(() => {
    if (!comparisonResult) return null;

    const primaryMetrics = calculateMetrics(primaryResult.detections);
    const comparisonMetrics = calculateMetrics(comparisonResult.detections);
    
    const alignment = alignDetectionsByInstance(
      primaryResult.detections,
      comparisonResult.detections,
      0.3
    );

    const categoryDiff = buildDetectionCategoryDiff(primaryResult, comparisonResult);

    const summary: ComparisonSummary = {
      detectionDelta: comparisonResult.detections.length - primaryResult.detections.length,
      inferenceDelta: comparisonResult.inference_ms - primaryResult.inference_ms,
      matchedCount: alignment.matched.length,
      primaryOnlyCount: alignment.primaryOnly.length,
      comparisonOnlyCount: alignment.comparisonOnly.length,
      recommendation: getRecommendation(primaryResult, comparisonResult, {
        matched: alignment.matched.length,
        primaryOnly: alignment.primaryOnly.length,
        comparisonOnly: alignment.comparisonOnly.length,
      }),
    };

    const sourceBreakdown = (detections: Detection[]) => {
      const counts = detections.reduce<Record<string, number>>((acc, d) => {
        const label = formatDetectionSourceLabel(d.source_role) ?? "默认模型";
        acc[label] = (acc[label] ?? 0) + 1;
        return acc;
      }, {});
      return Object.entries(counts).map(([label, count]) => ({ label, count }));
    };

    return {
      primaryMetrics,
      comparisonMetrics,
      alignment,
      categoryDiff,
      summary,
      primarySources: sourceBreakdown(primaryResult.detections),
      comparisonSources: sourceBreakdown(comparisonResult.detections),
      matchedPrimaryIds: new Set(alignment.matched.map(m => m.primary.id)),
      matchedComparisonIds: new Set(alignment.matched.map(m => m.comparison.id)),
    };
  }, [primaryResult, comparisonResult]);
}
