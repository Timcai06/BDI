import { demoResult } from "@/lib/mock-data";
import { filterDetections, formatConfidence, getDetectionSummary } from "@/lib/result-utils";

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
});
