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
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

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

  it("invalidates cached history after a successful prediction", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:8000");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/results?offset=0&limit=20")) {
        return Response.json({
          items: [
            {
              image_id: "first.jpg",
              created_at: "2026-03-17T12:00:00Z",
              model_name: "demo",
              model_version: "v1-demo",
              backend: "mock",
              inference_mode: "single",
              inference_ms: 1200,
              detection_count: 1,
              categories: ["裂缝"],
              artifacts: {
                upload_path: "uploads/first.jpg",
                json_path: "results/first.jpg.json",
                overlay_path: null
              }
            }
          ],
          total: 1,
          offset: 0
        });
      }

      if (url.endsWith("/predict") && init?.method === "POST") {
        return Response.json({
          image_id: "second.jpg",
          created_at: "2026-03-17T12:00:05Z",
          model_name: "demo",
          model_version: "v1-demo",
          backend: "mock",
          inference_mode: "single",
          inference_ms: 980,
          detections: [],
          artifacts: {
            upload_path: "uploads/second.jpg",
            json_path: "results/second.jpg.json",
            overlay_path: null
          }
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/lib/predict-client");
    const initialHistory = await client.listResults();
    expect(initialHistory.items).toHaveLength(1);

    await client.predictImage(new File(["demo"], "second.jpg", { type: "image/jpeg" }), {
      confidence: 0.4,
      exportOverlay: false
    });

    const refreshedHistory = await client.listResults();
    expect(refreshedHistory.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8000/results?offset=0&limit=20",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
