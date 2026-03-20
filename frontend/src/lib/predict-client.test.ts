import {
  batchDeleteResults,
  deleteResult,
  getResultImageFile,
  getOverlayDownloadUrl,
  getResultImageUrl,
  listAllResults,
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

  it("returns mock all-history when no api base url is configured", async () => {
    const result = await listAllResults();

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
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

  it("returns successful results when batch deleting in mock mode", async () => {
    const result = await batchDeleteResults(["bridge-deck-demo.jpg", "bridge-pier-demo.jpg"]);

    expect(result.requested).toBe(2);
    expect(result.deleted_count).toBe(2);
    expect(result.failed_count).toBe(0);
    expect(result.results).toEqual([
      {
        image_id: "bridge-deck-demo.jpg",
        deleted: true,
        error_code: null
      },
      {
        image_id: "bridge-pier-demo.jpg",
        deleted: true,
        error_code: null
      }
    ]);
  });

  it("posts to the batch delete endpoint when api base url is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:8000");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:8000/results/batch-delete");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json"
      });
      expect(init?.body).toBe(JSON.stringify({
        image_ids: ["a.jpg", "b.jpg"]
      }));

      return Response.json({
        requested: 2,
        deleted_count: 1,
        failed_count: 1,
        results: [
          {
            image_id: "a.jpg",
            deleted: true,
            error_code: null
          },
          {
            image_id: "b.jpg",
            deleted: false,
            error_code: "not_found"
          }
        ]
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/lib/predict-client");
    await expect(client.batchDeleteResults(["a.jpg", "b.jpg"])).resolves.toEqual({
      requested: 2,
      deleted_count: 1,
      failed_count: 1,
      results: [
        {
          image_id: "a.jpg",
          deleted: true,
          error_code: null
        },
        {
          image_id: "b.jpg",
          deleted: false,
          error_code: "not_found"
        }
      ]
    });
  });

  it("posts to the batch export json endpoint when api base url is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:8000");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:8000/results/batch-export/json");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({
        image_ids: ["a.jpg", "b.jpg"]
      }));

      return new Response("zip-binary", {
        status: 200,
        headers: {
          "Content-Disposition": 'attachment; filename="history-json-export-20260320-110000.zip"'
        }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/lib/predict-client");
    const result = await client.batchExportResults(["a.jpg", "b.jpg"], "json");
    expect(result.filename).toBe("history-json-export-20260320-110000.zip");
    expect(result.blob).toBeDefined();
  });

  it("collects all paginated history items", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:8000");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/results?offset=0&limit=100")) {
        return Response.json({
          items: Array.from({ length: 100 }, (_, index) => ({
            image_id: `item-${index}.jpg`,
            created_at: "2026-03-17T12:00:00Z",
            model_name: "demo",
            model_version: "v1-demo",
            backend: "mock",
            inference_mode: "single",
            inference_ms: 1200,
            detection_count: 1,
            categories: ["裂缝"],
            artifacts: {
              upload_path: `uploads/item-${index}.jpg`,
              json_path: `results/item-${index}.json`,
              overlay_path: null
            }
          })),
          total: 101,
          offset: 0
        });
      }

      if (url.endsWith("/results?offset=100&limit=100")) {
        return Response.json({
          items: [
            {
              image_id: "item-100.jpg",
              created_at: "2026-03-17T12:00:00Z",
              model_name: "demo",
              model_version: "v1-demo",
              backend: "mock",
              inference_mode: "single",
              inference_ms: 1200,
              detection_count: 1,
              categories: ["裂缝"],
              artifacts: {
                upload_path: "uploads/item-100.jpg",
                json_path: "results/item-100.json",
                overlay_path: null
              }
            }
          ],
          total: 101,
          offset: 100
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/lib/predict-client");
    const result = await client.listAllResults();
    expect(result.total).toBe(101);
    expect(result.items).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
