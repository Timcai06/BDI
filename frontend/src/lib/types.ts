import type { components } from "@/lib/api/generated";

export type AppPhase = "idle" | "uploading" | "running" | "success" | "error";
export type PredictionStatus = AppPhase;

export interface PredictState {
  phase: AppPhase;
  message: string;
}

// Frontend-local predict form options. These intentionally match the UI model,
// not the raw FastAPI field names.
export interface PredictOptions {
  confidence: number;
  exportOverlay: boolean;
  modelVersion?: string | null;
  pixelsPerMm?: number;
  enhance?: boolean;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  };
}

export type BoundingBox = components["schemas"]["BoundingBox"];
export type DetectionMetrics = components["schemas"]["DetectionMetrics"];
export type DetectionMask = components["schemas"]["MaskPayload"];
export type Detection = Omit<components["schemas"]["Detection"], "bbox" | "metrics"> & {
  bbox: BoundingBox;
  metrics: DetectionMetrics;
};
export type Artifacts = components["schemas"]["ArtifactLinks"];
export type EnhancementInfo = components["schemas"]["EnhancementInfo"];
export type PredictResponse = Omit<
  components["schemas"]["PredictResponse"],
  "detections" | "inference_breakdown" | "artifacts" | "secondary_result" | "created_at"
> & {
  detections: Detection[];
  inference_breakdown?: Record<string, number>;
  artifacts: Artifacts;
  created_at: string;
  secondary_result?: PredictResponse | null;
};
export type PredictionResult = PredictResponse;
export type PredictionHistoryItem = Omit<
  components["schemas"]["ResultSummary"],
  "categories" | "artifacts" | "has_diagnosis"
> & {
  categories: string[];
  artifacts: Artifacts;
  has_diagnosis?: boolean;
};
export type PredictionHistoryResponse = Omit<components["schemas"]["ResultListResponse"], "items"> & {
  items: PredictionHistoryItem[];
};
export type ModelCatalogItem = components["schemas"]["ModelCatalogItem"];
export type ModelCatalogResponse = Omit<components["schemas"]["ModelCatalogResponse"], "items"> & {
  items: ModelCatalogItem[];
};
export type DiagnosisResponse = components["schemas"]["DiagnosisResponse"];
export type BatchDeleteResultItem = components["schemas"]["BatchDeleteResultItem"];
export type BatchDeleteResultsResponse = Omit<components["schemas"]["BatchDeleteResultsResponse"], "results"> & {
  results: BatchDeleteResultItem[];
};

export type BridgeV1 = components["schemas"]["BridgeResponse"];
export type BridgeListV1Response = Omit<components["schemas"]["BridgeListResponse"], "items"> & {
  items: BridgeV1[];
};
export type BridgeDeleteV1Response = components["schemas"]["BridgeDeleteResponse"];

export type BatchV1 = components["schemas"]["BatchResponse"];
export type BatchListV1Response = Omit<components["schemas"]["BatchListResponse"], "items"> & {
  items: BatchV1[];
};
export type BatchDeleteV1Response = components["schemas"]["BatchDeleteResponse"];
export type BatchIngestV1Response = Omit<components["schemas"]["BatchIngestResponse"], "items" | "errors"> & {
  items: NonNullable<components["schemas"]["BatchIngestResponse"]["items"]>;
  errors: NonNullable<components["schemas"]["BatchIngestResponse"]["errors"]>;
};
export type BatchStatsV1Response = Omit<
  components["schemas"]["BatchStatsResponse"],
  "status_breakdown" | "review_breakdown" | "category_breakdown" | "alert_breakdown"
> & {
  status_breakdown: Record<string, number>;
  review_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  alert_breakdown: Record<string, number>;
};
export type OpsMetricsV1Response = Omit<
  components["schemas"]["OpsMetricsResponse"],
  "status_breakdown" | "failure_code_breakdown"
> & {
  status_breakdown: Record<string, number>;
  failure_code_breakdown: Record<string, number>;
};
export type AlertRulesConfigV1Response = Omit<
  components["schemas"]["AlertRulesConfigResponse"],
  "category_watchlist" | "sla_hours_by_level"
> & {
  category_watchlist: string[];
  sla_hours_by_level: Record<string, number>;
};
export type OpsAuditLogV1 = components["schemas"]["OpsAuditLogResponse"];
export type OpsAuditLogListV1Response = Omit<components["schemas"]["OpsAuditLogListResponse"], "items"> & {
  items: OpsAuditLogV1[];
};
export type MediaAssetV1 = components["schemas"]["MediaAssetResponse"];
export type BatchItemV1 = components["schemas"]["BatchItemResponse"];
export type BatchItemListV1Response = Omit<components["schemas"]["BatchItemListResponse"], "items"> & {
  items: BatchItemV1[];
};
export type BatchItemDetailV1Response = components["schemas"]["BatchItemDetailResponse"];
export type TaskV1 = components["schemas"]["TaskResponse"];
export type TaskRetryV1Response = components["schemas"]["TaskRetryResponse"];
export type DetectionRecordV1 = components["schemas"]["DetectionRecordResponse"];
export type DetectionListV1Response = Omit<components["schemas"]["DetectionListResponse"], "items"> & {
  items: DetectionRecordV1[];
};
export type ReviewRecordV1 = components["schemas"]["ReviewRecordResponse"];
export type ReviewListV1Response = Omit<components["schemas"]["ReviewListResponse"], "items"> & {
  items: ReviewRecordV1[];
};
export type AlertV1 = components["schemas"]["AlertResponse"];
export type AlertListV1Response = Omit<components["schemas"]["AlertListResponse"], "items"> & {
  items: AlertV1[];
};
export type ResultDetectionV1 = components["schemas"]["ResultDetectionResponse"];
export type BatchItemResultV1Response = Omit<
  components["schemas"]["BatchItemResultResponse"],
  "detections" | "secondary_result"
> & {
  detections: ResultDetectionV1[];
  secondary_result?: PredictResponse | null;
};
