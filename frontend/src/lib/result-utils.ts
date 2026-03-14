import type { Detection, PredictionResult } from "@/lib/types";

interface Size {
  width: number;
  height: number;
}

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

export interface DetectionCategoryDiffItem {
  category: string;
  primaryCount: number;
  comparisonCount: number;
  delta: number;
}

export function buildDetectionCategoryDiff(
  primary: PredictionResult,
  comparison: PredictionResult
): DetectionCategoryDiffItem[] {
  const categories = new Set([
    ...primary.detections.map((item) => item.category),
    ...comparison.detections.map((item) => item.category)
  ]);

  return [...categories]
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((category) => {
      const primaryCount = primary.detections.filter(
        (item) => item.category === category
      ).length;
      const comparisonCount = comparison.detections.filter(
        (item) => item.category === category
      ).length;

      return {
        category,
        primaryCount,
        comparisonCount,
        delta: comparisonCount - primaryCount
      };
    });
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

export function getDetectionOverlayStyle(
  bbox: Detection["bbox"],
  imageSize: Size,
  frameSize: Size
): Record<"left" | "top" | "width" | "height", string> {
  if (
    imageSize.width <= 0 ||
    imageSize.height <= 0 ||
    frameSize.width <= 0 ||
    frameSize.height <= 0
  ) {
    return {
      left: "0%",
      top: "0%",
      width: "0%",
      height: "0%"
    };
  }

  const scale = Math.min(
    frameSize.width / imageSize.width,
    frameSize.height / imageSize.height
  );
  const renderedWidth = imageSize.width * scale;
  const renderedHeight = imageSize.height * scale;
  const offsetX = (frameSize.width - renderedWidth) / 2;
  const offsetY = (frameSize.height - renderedHeight) / 2;

  const left = offsetX + bbox.x * scale;
  const top = offsetY + bbox.y * scale;
  const width = bbox.width * scale;
  const height = bbox.height * scale;

  return {
    left: `${(left / frameSize.width * 100).toFixed(3)}%`,
    top: `${(top / frameSize.height * 100).toFixed(3)}%`,
    width: `${(width / frameSize.width * 100).toFixed(3)}%`,
    height: `${(height / frameSize.height * 100).toFixed(3)}%`
  };
}
