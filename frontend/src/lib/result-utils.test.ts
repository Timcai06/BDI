import { demoResult } from "@/lib/mock-data";
import {
  alignDetectionsByInstance,
  buildDetectionCategoryDiff,
  filterDetections,
  formatConfidence,
  getDetectionOverlayStyle,
  getDetectionSummary
} from "@/lib/result-utils";

describe("result-utils", () => {
  it("formats confidence values as percentages", () => {
    expect(formatConfidence(0.812)).toBe("81%");
  });

  it("builds a human-readable summary", () => {
    expect(getDetectionSummary(demoResult)).toBe(
      "系统已输出病害类别、置信度、掩膜与几何参数，涉及 2 类结构病害，可继续用于专家复核与报告生成。"
    );
  });

  it("filters detections by category and confidence", () => {
    const filtered = filterDetections(demoResult.detections, "裂缝", 0.9);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("det-crack-001");
  });

  it("maps detections into the displayed image area for contain mode", () => {
    const style = getDetectionOverlayStyle(
      { x: 160, y: 90, width: 320, height: 180 },
      { width: 1280, height: 720 },
      { width: 1000, height: 800 }
    );

    expect(style).toEqual({
      left: "12.500%",
      top: "23.633%",
      width: "25.000%",
      height: "17.578%"
    });
  });

  it("builds category-level detection diff between two results", () => {
    const diff = buildDetectionCategoryDiff(demoResult, {
      ...demoResult,
      model_version: "mock-v2",
      detections: [demoResult.detections[0]]
    });

    expect(diff).toEqual([
      {
        category: "裂缝",
        primaryCount: 1,
        comparisonCount: 1,
        delta: 0
      },
      {
        category: "破损",
        primaryCount: 1,
        comparisonCount: 0,
        delta: -1
      }
    ]);
  });

  it("aligns matched detections by category and bbox overlap", () => {
    const aligned = alignDetectionsByInstance(
      demoResult.detections,
      [
        {
          ...demoResult.detections[0],
          id: "cmp-crack",
          confidence: 0.89,
        },
        {
          ...demoResult.detections[1],
          id: "cmp-new-hole",
          category: "hole",
          bbox: { x: 700, y: 220, width: 80, height: 80 },
        },
      ],
      0.3
    );

    expect(aligned.matched).toHaveLength(1);
    expect(aligned.matched[0]?.primary.id).toBe("det-crack-001");
    expect(aligned.matched[0]?.comparison.id).toBe("cmp-crack");
    expect(aligned.primaryOnly).toHaveLength(1);
    expect(aligned.primaryOnly[0]?.id).toBe("det-spall-002");
    expect(aligned.comparisonOnly).toHaveLength(1);
    expect(aligned.comparisonOnly[0]?.id).toBe("cmp-new-hole");
  });
});
