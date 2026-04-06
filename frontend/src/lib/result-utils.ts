import type { Detection, PredictionResult } from "@/lib/types";
import { getDefectLabel, normalizeCategory } from "@/lib/defect-visuals";

interface Size {
  width: number;
  height: number;
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getDetectionSummary(result: PredictionResult): string {
  if (result.detections.length === 0) {
    return "系统未在当前阈值下识别到裂缝、破损、梳齿缺陷、孔洞、钢筋外露或渗水等目标。建议结合图像质量与拍摄角度进一步复检。";
  }

  const categories = new Set(result.detections.map((item) => item.category));
  return `系统已输出病害类别、置信度、掩膜与几何参数，涉及 ${categories.size} 类结构病害，可继续用于专家复核与报告生成。`;
}

export function getPrimaryFinding(result: PredictionResult): string {
  if (result.detections.length === 0) {
    return "当前暂未发现明确病害";
  }

  const categoryCounts = result.detections.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  const [topCategory, topCount] =
    Object.entries(categoryCounts).sort((left, right) => right[1] - left[1])[0] ?? [];

  if (!topCategory || !topCount) {
    return `本次识别发现 ${result.detections.length} 处异常区域`;
  }

  const normalized = normalizeCategory(topCategory);
  const riskLevel = normalized === "crack" || normalized === "reinforcement" || topCount >= 5 ? "中高" : "中低";

  return `本次识别发现 ${result.detections.length} 处结构性损伤，主要涉及${getDefectLabel(topCategory)}，综合风险评级：${riskLevel}`;
}

export function getResultNextStep(result: PredictionResult): string {
  if (result.detections.length === 0) {
    return "建议：降低召回阈值重试、切换其他模型版本进行比对，或放大原图查验微小细节。";
  }

  if (result.detections.length === 1) {
    return "建议：查看病害详情（包含尺寸估算与置信度分布），确认定级后导出结构化记录。";
  }

  return "建议：优先排查高亮高风险病害项，多维度比对原图与掩膜判定后，导出评估结果与可视化物料。";
}

export interface DetectionCategoryDiffItem {
  category: string;
  primaryCount: number;
  comparisonCount: number;
  delta: number;
}

export interface DetectionAlignmentPair {
  primary: Detection;
  comparison: Detection;
  iou: number;
}

export interface DetectionAlignmentResult {
  matched: DetectionAlignmentPair[];
  primaryOnly: Detection[];
  comparisonOnly: Detection[];
}

// Frontend IoU is only used for comparison UI alignment and summary rendering.
// Fusion-time dedupe keeps its own backend-side implementation.
function getBoundingBoxIou(left: Detection["bbox"], right: Detection["bbox"]): number {
  const leftX2 = left.x + left.width;
  const leftY2 = left.y + left.height;
  const rightX2 = right.x + right.width;
  const rightY2 = right.y + right.height;

  const interX1 = Math.max(left.x, right.x);
  const interY1 = Math.max(left.y, right.y);
  const interX2 = Math.min(leftX2, rightX2);
  const interY2 = Math.min(leftY2, rightY2);

  const interWidth = Math.max(0, interX2 - interX1);
  const interHeight = Math.max(0, interY2 - interY1);
  const intersection = interWidth * interHeight;
  if (intersection <= 0) {
    return 0;
  }

  const leftArea = Math.max(0, left.width) * Math.max(0, left.height);
  const rightArea = Math.max(0, right.width) * Math.max(0, right.height);
  const union = leftArea + rightArea - intersection;
  if (union <= 0) {
    return 0;
  }

  return intersection / union;
}

export function buildDetectionCategoryDiff(
  primary: PredictionResult,
  comparison: PredictionResult
): DetectionCategoryDiffItem[] {
  const categories = new Set([
    ...primary.detections.map((item) => getDefectLabel(item.category)),
    ...comparison.detections.map((item) => getDefectLabel(item.category))
  ]);

  return [...categories]
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((category) => {
      const primaryCount = primary.detections.filter(
        (item) => getDefectLabel(item.category) === category
      ).length;
      const comparisonCount = comparison.detections.filter(
        (item) => getDefectLabel(item.category) === category
      ).length;

      return {
        category,
        primaryCount,
        comparisonCount,
        delta: comparisonCount - primaryCount
      };
    });
}

export function alignDetectionsByInstance(
  primary: Detection[],
  comparison: Detection[],
  iouThreshold: number = 0.3
): DetectionAlignmentResult {
  const matched: DetectionAlignmentPair[] = [];
  const usedComparison = new Set<string>();

  for (const primaryDetection of primary) {
    let bestMatch: Detection | null = null;
    let bestIou = 0;

    for (const comparisonDetection of comparison) {
      if (usedComparison.has(comparisonDetection.id)) {
        continue;
      }

      if (normalizeCategory(primaryDetection.category) !== normalizeCategory(comparisonDetection.category)) {
        continue;
      }

      const iou = getBoundingBoxIou(primaryDetection.bbox, comparisonDetection.bbox);
      if (iou >= iouThreshold && iou > bestIou) {
        bestMatch = comparisonDetection;
        bestIou = iou;
      }
    }

    if (bestMatch) {
      matched.push({
        primary: primaryDetection,
        comparison: bestMatch,
        iou: bestIou,
      });
      usedComparison.add(bestMatch.id);
    }
  }

  const matchedPrimaryIds = new Set(matched.map((item) => item.primary.id));
  const primaryOnly = primary.filter((item) => !matchedPrimaryIds.has(item.id));
  const comparisonOnly = comparison.filter((item) => !usedComparison.has(item.id));

  return {
    matched,
    primaryOnly,
    comparisonOnly,
  };
}

export function filterDetections(
  detections: Detection[],
  category: string,
  minConfidence: number
): Detection[] {
  return detections.filter((item) => {
    const categoryMatched =
      category === "全部" || getDefectLabel(item.category) === category;
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

export function mapImagePointToFramePercent(
  point: [number, number],
  imageSize: Size,
  frameSize: Size
): { x: number; y: number } {
  if (
    imageSize.width <= 0 ||
    imageSize.height <= 0 ||
    frameSize.width <= 0 ||
    frameSize.height <= 0
  ) {
    return { x: 0, y: 0 };
  }

  const scale = Math.min(
    frameSize.width / imageSize.width,
    frameSize.height / imageSize.height
  );
  const renderedWidth = imageSize.width * scale;
  const renderedHeight = imageSize.height * scale;
  const offsetX = (frameSize.width - renderedWidth) / 2;
  const offsetY = (frameSize.height - renderedHeight) / 2;

  const x = offsetX + point[0] * scale;
  const y = offsetY + point[1] * scale;

  return {
    x: Number(((x / frameSize.width) * 100).toFixed(3)),
    y: Number(((y / frameSize.height) * 100).toFixed(3)),
  };
}

export function getDetectionMaskPolygonPoints(
  detection: Detection,
  imageSize: Size,
  frameSize: Size
): string {
  if (!detection.mask?.points?.length) {
    return "";
  }

  return detection.mask.points
    .map(([x, y]) => {
      const mapped = mapImagePointToFramePercent([x, y], imageSize, frameSize);
      return `${mapped.x},${mapped.y}`;
    })
    .join(" ");
}
