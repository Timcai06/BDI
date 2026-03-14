import { demoResult } from "@/lib/mock-data";
import {
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
    expect(getDetectionSummary(demoResult)).toBe("检出 2 处病害，涉及 2 类病害。");
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
        category: "剥落",
        primaryCount: 1,
        comparisonCount: 0,
        delta: -1
      },
      {
        category: "裂缝",
        primaryCount: 1,
        comparisonCount: 1,
        delta: 0
      }
    ]);
  });
});
