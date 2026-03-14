import {
  deleteResult,
  getResultImageFile,
  getOverlayDownloadUrl,
  getResultImageUrl,
  listModels,
  listResults,
  predictImage
} from "@/lib/predict-client";

describe("predict-client", () => {
  it("falls back to mock data when no API base url is configured", async () => {
    const file = new File(["demo"], "bridge-sample.jpg", { type: "image/jpeg" });

    const result = await predictImage(file, {
      confidence: 0.4,
      exportOverlay: false
    });

    expect(result.image_id).toBe("bridge-sample.jpg");
    expect(result.artifacts.overlay_path).toBeNull();
    expect(result.detections.length).toBeGreaterThan(0);
  });

  it("returns mock history when no API base url is configured", async () => {
    const result = await listResults();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].image_id).toBe("bridge-deck-demo.jpg");
  });

  it("returns mock model catalog when no API base url is configured", async () => {
    const result = await listModels();

    expect(result.active_version).toBe("v1-demo");
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("returns a mock overlay path when available", () => {
    expect(getOverlayDownloadUrl("bridge-deck-demo.jpg")).toContain("mock-artifacts");
  });

  it("returns null for result images when no API base url is configured", () => {
    expect(getResultImageUrl("bridge-deck-demo.jpg")).toBeNull();
  });

  it("rejects result image file loading when no API base url is configured", async () => {
    await expect(getResultImageFile("bridge-deck-demo.jpg")).rejects.toThrow(
      "当前环境无法读取历史原图。"
    );
  });

  it("does not throw when deleting in mock mode", async () => {
    await expect(deleteResult("bridge-deck-demo.jpg")).resolves.toBeUndefined();
  });
});
