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
  pixelsPerMm?: number;
  enhance?: boolean;
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
  source_role?: string | null;
  source_model_name?: string | null;
  source_model_version?: string | null;
}

export interface Artifacts {
  upload_path: string;
  json_path: string;
  overlay_path?: string | null;
  enhanced_path?: string | null;
  enhanced_overlay_path?: string | null;
}

export interface PredictResponse {
  schema_version: string;
  image_id: string;
  inference_ms: number;
  inference_breakdown?: Record<string, number>;
  model_name: string;
  model_version: string;
  backend: string;
  inference_mode: string;
  detections: Detection[];
  has_masks: boolean;
  mask_detection_count: number;
  artifacts: Artifacts;
  secondary_result?: PredictResponse | null;
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
  inference_breakdown?: Record<string, number>;
  detection_count: number;
  has_masks: boolean;
  mask_detection_count: number;
  has_diagnosis?: boolean;
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
  supports_overlay: boolean;
  supports_sliced_inference: boolean;
  is_active: boolean;
  is_available: boolean;
}

export interface ModelCatalogResponse {
  active_version: string;
  items: ModelCatalogItem[];
}

export interface DiagnosisResponse {
  image_id: string;
  exists: boolean;
  content: string | null;
  generated_at: string | null;
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

export interface BridgeV1 {
  id: string;
  bridge_code: string;
  bridge_name: string;
  bridge_type?: string | null;
  region?: string | null;
  manager_org?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BridgeListV1Response {
  items: BridgeV1[];
  total: number;
  limit: number;
  offset: number;
}

export interface BatchV1 {
  id: string;
  bridge_id: string;
  batch_code: string;
  source_type: string;
  status: string;
  sealed: boolean;
  expected_item_count: number;
  received_item_count: number;
  queued_item_count: number;
  running_item_count: number;
  succeeded_item_count: number;
  failed_item_count: number;
  created_by?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchListV1Response {
  items: BatchV1[];
  total: number;
  limit: number;
  offset: number;
}

export interface BatchIngestV1Response {
  batch_id: string;
  accepted_count: number;
  rejected_count: number;
  items: Array<{
    batch_item_id: string;
    media_asset_id: string;
    original_filename: string;
    source_relative_path?: string | null;
    processing_status: string;
    task_id: string;
  }>;
  errors: Array<{
    filename: string;
    code: string;
    message: string;
  }>;
}

export interface BatchStatsV1Response {
  batch_id: string;
  status_breakdown: Record<string, number>;
  review_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  alert_breakdown: Record<string, number>;
}

export interface OpsMetricsV1Response {
  window_hours: number;
  generated_at: string;
  total_tasks: number;
  success_rate: number;
  retry_recovery_rate?: number | null;
  queued_tasks: number;
  running_tasks: number;
  failed_tasks: number;
  p50_queue_wait_ms?: number | null;
  p95_queue_wait_ms?: number | null;
  p50_run_ms?: number | null;
  p95_run_ms?: number | null;
  status_breakdown: Record<string, number>;
  failure_code_breakdown: Record<string, number>;
}

export interface AlertRulesConfigV1Response {
  profile_name: string;
  alert_auto_enabled: boolean;
  count_threshold: number;
  category_watchlist: string[];
  category_confidence_threshold: number;
  repeat_escalation_hits: number;
  sla_hours_by_level: Record<string, number>;
  near_due_hours: number;
  updated_at: string;
  updated_by?: string | null;
}

export interface OpsAuditLogV1 {
  id: string;
  audit_type: string;
  actor: string;
  target_key?: string | null;
  before_payload: Record<string, unknown>;
  after_payload: Record<string, unknown>;
  diff_payload: Record<string, unknown>;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsAuditLogListV1Response {
  items: OpsAuditLogV1[];
  total: number;
  limit: number;
  offset: number;
}

export interface MediaAssetV1 {
  id: string;
  media_type: string;
  original_filename: string;
  storage_uri: string;
  mime_type: string;
  file_size_bytes: number;
  width?: number | null;
  height?: number | null;
  captured_at?: string | null;
  uploaded_at: string;
  source_device?: string | null;
  source_relative_path?: string | null;
}

export interface BatchItemV1 {
  id: string;
  batch_id: string;
  media_asset_id: string;
  source_relative_path?: string | null;
  sequence_no: number;
  processing_status: string;
  review_status: string;
  latest_task_id?: string | null;
  latest_result_id?: string | null;
  defect_count: number;
  max_confidence?: number | null;
  max_severity?: string | null;
  alert_status: string;
  created_at: string;
  updated_at: string;
}

export interface BatchItemListV1Response {
  items: BatchItemV1[];
  total: number;
  limit: number;
  offset: number;
}

export interface BatchItemDetailV1Response extends BatchItemV1 {
  media_asset: MediaAssetV1;
}

export interface TaskV1 {
  id: string;
  batch_item_id: string;
  task_type: string;
  status: string;
  attempt_no: number;
  priority: number;
  model_policy: string;
  requested_model_version?: string | null;
  resolved_model_version?: string | null;
  inference_mode: string;
  queued_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  worker_name?: string | null;
  runtime_payload: Record<string, unknown>;
  timing_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TaskRetryV1Response {
  old_task_id: string;
  new_task_id: string;
  status: string;
}

export interface DetectionRecordV1 {
  id: string;
  result_id: string;
  batch_item_id: string;
  category: string;
  confidence: number;
  severity_level?: string | null;
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
  mask_payload?: Record<string, unknown> | null;
  length_mm?: number | null;
  width_mm?: number | null;
  area_mm2?: number | null;
  source_role?: string | null;
  source_model_name?: string | null;
  source_model_version?: string | null;
  is_valid: boolean;
  extra_payload: Record<string, unknown>;
  created_at: string;
}

export interface DetectionListV1Response {
  items: DetectionRecordV1[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReviewRecordV1 {
  id: string;
  batch_item_id: string;
  result_id: string;
  detection_id: string;
  review_action: string;
  review_decision: string;
  before_payload: Record<string, unknown>;
  after_payload: Record<string, unknown>;
  review_note?: string | null;
  reviewer: string;
  reviewed_at: string;
  created_at: string;
}

export interface ReviewListV1Response {
  items: ReviewRecordV1[];
  total: number;
  limit: number;
  offset: number;
}

export interface AlertV1 {
  id: string;
  bridge_id: string;
  batch_id: string;
  batch_item_id?: string | null;
  result_id?: string | null;
  detection_id?: string | null;
  event_type: string;
  alert_level: string;
  status: string;
  title: string;
  trigger_payload: Record<string, unknown>;
  triggered_at: string;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertListV1Response {
  items: AlertV1[];
  total: number;
  limit: number;
  offset: number;
}

export interface ResultDetectionV1 {
  id: string;
  category: string;
  confidence: number;
  severity_level?: string | null;
  bbox: BoundingBox;
  mask?: Record<string, unknown> | null;
  metrics: DetectionMetrics;
  source_role?: string | null;
  source_model_name?: string | null;
  source_model_version?: string | null;
  is_valid: boolean;
}

export interface BatchItemResultV1Response {
  id: string;
  task_id: string;
  batch_item_id: string;
  schema_version: string;
  model_name: string;
  model_version: string;
  backend: string;
  inference_mode: string;
  inference_ms: number;
  inference_breakdown: Record<string, number>;
  detection_count: number;
  has_masks: boolean;
  mask_detection_count: number;
  overlay_uri?: string | null;
  json_uri?: string | null;
  diagnosis_uri?: string | null;
  created_at: string;
  detections: ResultDetectionV1[];
}
