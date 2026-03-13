import type { PredictionHistoryItem } from "@/lib/types";
import { filterHistoryItems, sortHistoryItems } from "@/lib/history-utils";

const historyItems: PredictionHistoryItem[] = [
  {
    image_id: "bridge-003.jpg",
    created_at: "2026-03-10T10:00:00Z",
    model_name: "yolov8-seg",
    model_version: "v1-real",
    backend: "pytorch",
    inference_mode: "direct",
    inference_ms: 180,
    detection_count: 1,
    categories: ["剥落"],
    artifacts: {
      upload_path: "uploads/bridge-003.jpg",
      json_path: "results/bridge-003.json",
      overlay_path: "overlays/bridge-003.png"
    }
  },
  {
    image_id: "bridge-001.jpg",
    created_at: "2026-03-12T10:00:00Z",
    model_name: "yolov8-seg",
    model_version: "v1-fast",
    backend: "mock",
    inference_mode: "direct",
    inference_ms: 120,
    detection_count: 2,
    categories: ["裂缝"],
    artifacts: {
      upload_path: "uploads/bridge-001.jpg",
      json_path: "results/bridge-001.json",
      overlay_path: null
    }
  },
  {
    image_id: "bridge-002.jpg",
    created_at: "2026-03-11T10:00:00Z",
    model_name: "yolov8-seg",
    model_version: "v1-real",
    backend: "pytorch",
    inference_mode: "direct",
    inference_ms: 240,
    detection_count: 5,
    categories: ["裂缝", "剥落"],
    artifacts: {
      upload_path: "uploads/bridge-002.jpg",
      json_path: "results/bridge-002.json",
      overlay_path: "overlays/bridge-002.png"
    }
  }
];

describe("history-utils", () => {
  it("filters history items by query and category", () => {
    const filtered = filterHistoryItems(historyItems, {
      query: "real",
      category: "剥落"
    });

    expect(filtered.map((item) => item.image_id)).toEqual([
      "bridge-003.jpg",
      "bridge-002.jpg"
    ]);
  });

  it("sorts history items by newest first", () => {
    const sorted = sortHistoryItems(historyItems, "newest");

    expect(sorted.map((item) => item.image_id)).toEqual([
      "bridge-001.jpg",
      "bridge-002.jpg",
      "bridge-003.jpg"
    ]);
  });

  it("sorts history items by most detections first", () => {
    const sorted = sortHistoryItems(historyItems, "detections");

    expect(sorted.map((item) => item.image_id)).toEqual([
      "bridge-002.jpg",
      "bridge-001.jpg",
      "bridge-003.jpg"
    ]);
  });

  it("sorts history items by fastest inference first", () => {
    const sorted = sortHistoryItems(historyItems, "fastest");

    expect(sorted.map((item) => item.image_id)).toEqual([
      "bridge-001.jpg",
      "bridge-003.jpg",
      "bridge-002.jpg"
    ]);
  });
});
