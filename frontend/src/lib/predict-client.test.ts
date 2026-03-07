import { predictImage } from "@/lib/predict-client";

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
});
