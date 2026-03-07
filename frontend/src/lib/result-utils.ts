import type { Detection, PredictionResult } from "@/lib/types";

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getDetectionSummary(result: PredictionResult): string {
  if (result.detections.length === 0) {
    return "未检出病害，建议调整阈值或更换样例。";
  }

  const categories = new Set(result.detections.map((item) => item.category));
  return `检出 ${result.detections.length} 处病害，涉及 ${categories.size} 类病害。`;
}

export function filterDetections(
  detections: Detection[],
  category: string,
  minConfidence: number
): Detection[] {
  return detections.filter((item) => {
    const categoryMatched = category === "全部" || item.category === category;
    return categoryMatched && item.confidence >= minConfidence;
  });
}
