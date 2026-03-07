import type { PredictionResult } from "@/lib/types";

export const demoResult: PredictionResult = {
  schema_version: "1.0.0",
  image_id: "bridge-deck-demo.jpg",
  inference_ms: 284,
  model_name: "yolov8-seg",
  model_version: "v1-demo",
  backend: "mock",
  inference_mode: "direct",
  created_at: "2026-03-07T11:00:00Z",
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
      }
    },
    {
      id: "det-spall-002",
      category: "剥落",
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
      }
    }
  ],
  artifacts: {
    upload_path: "uploads/bridge-deck-demo.jpg",
    json_path: "results/bridge-deck-demo.json",
    overlay_path: "/mock-artifacts/bridge-deck-demo-overlay.png"
  }
};
