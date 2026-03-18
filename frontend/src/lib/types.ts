export type AppPhase = "idle" | "uploading" | "running" | "success" | "error";
export type PredictionStatus = AppPhase;

export interface PredictState {
  phase: AppPhase;
  message: string;
}

export interface PredictOptions {
  confidence: number;
  exportOverlay: boolean;
  modelVersion?: string | null;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionMetrics {
  length_mm?: number | null;
  width_mm?: number | null;
  area_mm2?: number | null;
}

export interface DetectionMask {
  format: "polygon";
  points: number[][];
}

export interface Detection {
  id: string;
  category: string;
  confidence: number;
  bbox: BoundingBox;
  mask?: DetectionMask | null;
  metrics: DetectionMetrics;
}

export interface Artifacts {
  upload_path: string;
  json_path: string;
  overlay_path?: string | null;
}

export interface PredictResponse {
  schema_version: string;
  image_id: string;
  inference_ms: number;
  model_name: string;
  model_version: string;
  backend: string;
  inference_mode: string;
  detections: Detection[];
  artifacts: Artifacts;
  created_at: string;
}

export type PredictionResult = PredictResponse;

export interface PredictionHistoryItem {
  image_id: string;
  created_at: string;
  model_name: string;
  model_version: string;
  backend: string;
  inference_mode: string;
  inference_ms: number;
  detection_count: number;
  categories: string[];
  artifacts: Artifacts;
}

export interface PredictionHistoryResponse {
  items: PredictionHistoryItem[];
  total: number;
  offset: number;
}

export interface ModelCatalogItem {
  model_name: string;
  model_version: string;
  backend: string;
  supports_masks: boolean;
  supports_sliced_inference: boolean;
  is_active: boolean;
  is_available: boolean;
}

export interface ModelCatalogResponse {
  active_version: string;
  items: ModelCatalogItem[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  };
}

export interface BatchDeleteResultItem {
  image_id: string;
  deleted: boolean;
  error_code?: string | null;
}

export interface BatchDeleteResultsResponse {
  requested: number;
  deleted_count: number;
  failed_count: number;
  results: BatchDeleteResultItem[];
}
