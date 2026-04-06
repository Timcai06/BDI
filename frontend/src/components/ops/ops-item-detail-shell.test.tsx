import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { OpsItemDetailShell } from "@/components/ops/ops-item-detail-shell";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("returnTo=%2Fdashboard%2Fops%3FbatchId%3Dbat_1"),
}));

vi.mock("@/lib/predict-client", () => ({
  enhanceResultImage: vi.fn(),
  createV1Review: vi.fn(async () => ({ id: "rev_1" })),
  getResultImageUrl: vi.fn(() => "/results/res_1/image"),
  getOverlayDownloadUrl: vi.fn(() => "/results/res_1/overlay"),
  getEnhancedImageUrl: vi.fn(() => "/results/res_1/enhanced"),
  getEnhancedOverlayUrl: vi.fn(() => "/results/res_1/enhanced-overlay"),
  getV1BatchItemDetail: vi.fn(async () => ({
    id: "bit_1",
    batch_id: "bat_1",
    sequence_no: 7,
    original_filename: "bridge-dark.png",
  })),
  getV1BatchItemResult: vi.fn(async () => ({
    id: "res_1",
    task_id: "task_1",
    batch_item_id: "bit_1",
    schema_version: "2.0.0",
    model_name: "yolo",
    model_version: "mock-v1",
    backend: "mock",
    inference_mode: "direct",
    inference_ms: 120,
    inference_breakdown: { model: 100 },
    detection_count: 1,
    has_masks: false,
    mask_detection_count: 0,
    overlay_uri: "artifacts/res_1-overlay.webp",
    json_uri: "artifacts/res_1.json",
    enhanced_path: "artifacts/res_1-enhanced.webp",
    enhanced_overlay_path: "artifacts/res_1-enhanced-overlay.webp",
    created_at: "2026-04-05T12:00:00Z",
    detections: [
      {
        id: "det_1",
        category: "crack",
        confidence: 0.91,
        bbox: { x: 10, y: 12, width: 80, height: 24 },
        metrics: { area_mm2: 21.4 },
        is_valid: true,
      },
    ],
    secondary_result: {
      schema_version: "1.0.0",
      image_id: "res_1-enhanced",
      result_variant: "enhanced",
      inference_ms: 140,
      inference_breakdown: { model: 118 },
      model_name: "yolo",
      model_version: "mock-v1",
      backend: "mock",
      inference_mode: "direct",
      detections: [
        {
          id: "res_1-enhanced-1",
          category: "corrosion",
          confidence: 0.97,
          bbox: { x: 24, y: 18, width: 66, height: 30 },
          metrics: { area_mm2: 44.1 },
        },
        {
          id: "res_1-enhanced-2",
          category: "crack",
          confidence: 0.88,
          bbox: { x: 40, y: 56, width: 42, height: 14 },
          metrics: { area_mm2: 14.2 },
        },
      ],
      has_masks: false,
      mask_detection_count: 0,
      enhancement_info: {
        algorithm: "Img_Enhance",
        pipeline: "dual_branch_fusion",
        revised_weights: "best_psnr_revised.pth",
        bridge_weights: "best_psnr_bridge.pth",
        generated_at: "2026-04-05T12:00:00Z",
      },
      artifacts: {
        upload_path: "artifacts/res_1-enhanced.webp",
        json_path: "",
        overlay_path: "artifacts/res_1-enhanced-overlay.webp",
      },
      created_at: "2026-04-05T12:00:00Z",
    },
  })),
}));

describe("OpsItemDetailShell", () => {
  it("switches the diagnosis panel to the enhanced result source", async () => {
    render(<OpsItemDetailShell batchItemId="bit_1" />);

    await waitFor(() => {
      expect(screen.getByText("crack")).toBeInTheDocument();
    });

    expect(screen.getAllByText("原图识别").length).toBeGreaterThan(0);
    expect(screen.queryByText("corrosion")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看增强" }));

    await waitFor(() => {
      expect(screen.getAllByText("增强后识别").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("corrosion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "请切回原图提交" })).toBeDisabled();
  });
});
