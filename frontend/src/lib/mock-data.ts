import type { ModelCatalogResponse, PredictionResult } from "@/lib/types";

export const demoResult: PredictionResult = {
  schema_version: "1.0.0",
  image_id: "bridge-deck-demo.jpg",
  inference_ms: 284,
  model_name: "桥梁病害分割演示模型",
  model_version: "v1-demo",
  backend: "mock",
  inference_mode: "direct",
  created_at: "2026-03-07T11:00:00Z",
  has_masks: true,
  mask_detection_count: 2,
  detections: [
    {
      id: "det-crack-001",
      category: "裂缝",
      confidence: 0.94,
      bbox: { x: 160, y: 128, width: 260, height: 74 },
      mask: {
        format: "polygon",
        points: [
          [160, 158],
          [204, 140],
          [280, 136],
          [420, 182],
          [396, 202],
          [284, 192]
        ]
      },
      metrics: {
        length_mm: 326.4,
        width_mm: 4.8,
        area_mm2: 1472.3
      },
      source_role: "general",
      source_model_name: "桥梁病害分割演示模型",
      source_model_version: "v1-demo"
    },
    {
      id: "det-spall-002",
      category: "破损",
      confidence: 0.81,
      bbox: { x: 488, y: 188, width: 144, height: 112 },
      mask: {
        format: "polygon",
        points: [
          [488, 210],
          [516, 188],
          [604, 202],
          [632, 276],
          [590, 300],
          [522, 288]
        ]
      },
      metrics: {
        length_mm: null,
        width_mm: null,
        area_mm2: 8294.2
      },
      source_role: "general",
      source_model_name: "桥梁病害分割演示模型",
      source_model_version: "v1-demo"
    }
  ],
  artifacts: {
    upload_path: "uploads/bridge-deck-demo.jpg",
    json_path: "results/bridge-deck-demo.json",
    overlay_path: "/mock-artifacts/bridge-deck-demo-overlay.png"
  }
};

export const demoModelCatalog: ModelCatalogResponse = {
  active_version: "v1-demo",
  items: [
    {
      model_name: "桥梁病害分割演示模型",
      model_version: "v1-demo",
      backend: "mock",
      supports_masks: true,
      supports_overlay: true,
      supports_sliced_inference: true,
      is_active: true,
      is_available: true
    },
    {
      model_name: "桥梁病害快速演示模型",
      model_version: "mock-v2",
      backend: "mock",
      supports_masks: true,
      supports_overlay: true,
      supports_sliced_inference: false,
      is_active: false,
      is_available: true
    }
  ]
};

export function buildDemoResultForModelVersion(modelVersion: string): PredictionResult {
  if (modelVersion === "mock-v2") {
    return {
      ...demoResult,
      model_version: modelVersion,
      inference_ms: 241,
      mask_detection_count: 1,
      detections: [
        {
          ...demoResult.detections[0],
          confidence: 0.91,
          metrics: {
            ...demoResult.detections[0].metrics,
            length_mm: 318.2
          }
        }
      ]
    };
  }

  return {
    ...demoResult,
    model_version: modelVersion
  };
}
