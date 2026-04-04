from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, File, Form, Request, UploadFile, status

from app.models.schemas import (
    AlertCreateRequest,
    AlertListResponse,
    AlertRulesConfigResponse,
    OpsAuditLogListResponse,
    AlertRulesUpdateRequest,
    AlertResponse,
    AlertStatusUpdateRequest,
    BatchCreateRequest,
    BatchCreateResponse,
    BatchIngestResponse,
    BatchItemDetailResponse,
    BatchItemListResponse,
    BatchItemResultResponse,
    BatchListResponse,
    BatchResponse,
    BatchStatsResponse,
    BridgeCreateRequest,
    BridgeListResponse,
    BridgeResponse,
    DetectionListResponse,
    OpsMetricsResponse,
    ReviewCreateRequest,
    ReviewListResponse,
    ReviewRecordResponse,
    TaskProcessResponse,
    TaskRetryRequest,
    TaskRetryResponse,
    TaskResponse,
)

router = APIRouter(prefix="/api/v1", tags=["phase5"])


@router.post("/bridges", response_model=BridgeResponse, status_code=status.HTTP_201_CREATED)
async def create_bridge(request: Request, payload: BridgeCreateRequest) -> BridgeResponse:
    return request.app.state.batch_service.create_bridge(payload)


@router.get("/bridges", response_model=BridgeListResponse)
async def list_bridges(request: Request, limit: int = 20, offset: int = 0) -> BridgeListResponse:
    return request.app.state.batch_service.list_bridges(limit=limit, offset=offset)


@router.get("/bridges/{bridge_id}", response_model=BridgeResponse)
async def get_bridge(request: Request, bridge_id: str) -> BridgeResponse:
    return request.app.state.batch_service.get_bridge(bridge_id)


@router.post("/batches", response_model=BatchCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(request: Request, payload: BatchCreateRequest) -> BatchCreateResponse:
    return request.app.state.batch_service.create_batch(payload)


@router.get("/batches", response_model=BatchListResponse)
async def list_batches(request: Request, limit: int = 20, offset: int = 0) -> BatchListResponse:
    return request.app.state.batch_service.list_batches(limit=limit, offset=offset)


@router.get("/batches/{batch_id}", response_model=BatchResponse)
async def get_batch(request: Request, batch_id: str) -> BatchResponse:
    return request.app.state.batch_service.get_batch(batch_id)


@router.post("/batches/{batch_id}/items", response_model=BatchIngestResponse)
async def ingest_batch_items(
    request: Request,
    batch_id: str,
    files: Annotated[list[UploadFile], File(...)],
    relative_paths: Annotated[Optional[list[str]], Form()] = None,
    source_device: Annotated[Optional[str], Form()] = None,
    captured_at: Annotated[Optional[datetime], Form()] = None,
    model_policy: Annotated[str, Form()] = "fusion-default",
) -> BatchIngestResponse:
    return await request.app.state.batch_service.ingest_items(
        batch_id=batch_id,
        files=files,
        relative_paths=relative_paths,
        source_device=source_device,
        captured_at=captured_at,
        model_policy=model_policy,
    )


@router.get("/batches/{batch_id}/items", response_model=BatchItemListResponse)
async def list_batch_items(
    request: Request,
    batch_id: str,
    limit: int = 50,
    offset: int = 0,
    relative_path_prefix: Optional[str] = None,
) -> BatchItemListResponse:
    return request.app.state.batch_service.list_batch_items(
        batch_id=batch_id,
        limit=limit,
        offset=offset,
        relative_path_prefix=relative_path_prefix,
    )


@router.get("/batches/{batch_id}/stats", response_model=BatchStatsResponse)
async def get_batch_stats(request: Request, batch_id: str) -> BatchStatsResponse:
    return request.app.state.batch_service.get_batch_stats(batch_id=batch_id)


@router.get("/batch-items/{batch_item_id}", response_model=BatchItemDetailResponse)
async def get_batch_item_detail(request: Request, batch_item_id: str) -> BatchItemDetailResponse:
    return request.app.state.batch_service.get_batch_item_detail(batch_item_id=batch_item_id)


@router.get("/batch-items/{batch_item_id}/result", response_model=BatchItemResultResponse)
async def get_batch_item_result(request: Request, batch_item_id: str) -> BatchItemResultResponse:
    return request.app.state.batch_service.get_batch_item_result(batch_item_id=batch_item_id)


@router.get("/ops/metrics", response_model=OpsMetricsResponse)
async def get_ops_metrics(request: Request, window_hours: int = 24) -> OpsMetricsResponse:
    return request.app.state.batch_service.get_ops_metrics(window_hours=window_hours)


@router.get("/ops/alert-rules", response_model=AlertRulesConfigResponse)
async def get_ops_alert_rules(request: Request) -> AlertRulesConfigResponse:
    config = request.app.state.task_service.get_alert_rule_config()
    request.app.state.batch_service.set_alert_sla_hours_by_level(config.sla_hours_by_level)
    return config


@router.put("/ops/alert-rules", response_model=AlertRulesConfigResponse)
async def update_ops_alert_rules(
    request: Request,
    payload: AlertRulesUpdateRequest,
) -> AlertRulesConfigResponse:
    updated = request.app.state.task_service.update_alert_rule_config(payload)
    request.app.state.batch_service.set_alert_sla_hours_by_level(updated.sla_hours_by_level)
    return updated


@router.get("/ops/alert-rules/audit", response_model=OpsAuditLogListResponse)
async def list_ops_alert_rules_audit(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    actor: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> OpsAuditLogListResponse:
    return request.app.state.task_service.list_alert_rule_audit_logs(
        limit=limit,
        offset=offset,
        actor=actor,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(request: Request, task_id: str) -> TaskResponse:
    return request.app.state.task_service.get_task(task_id)


@router.post("/tasks/process-next", response_model=TaskProcessResponse)
async def process_next_task(request: Request) -> TaskProcessResponse:
    return request.app.state.task_service.process_next_queued_task()


@router.post("/tasks/{task_id}/retry", response_model=TaskRetryResponse, status_code=status.HTTP_202_ACCEPTED)
async def retry_task(request: Request, task_id: str, payload: TaskRetryRequest) -> TaskRetryResponse:
    return request.app.state.task_service.retry_task(task_id, payload)


@router.get("/detections", response_model=DetectionListResponse)
async def list_detections(
    request: Request,
    batch_id: Optional[str] = None,
    batch_item_id: Optional[str] = None,
    category: Optional[str] = None,
    min_confidence: Optional[float] = None,
    max_confidence: Optional[float] = None,
    min_area_mm2: Optional[float] = None,
    is_valid: Optional[bool] = None,
    sort_by: Literal["created_at", "confidence", "area_mm2"] = "created_at",
    sort_order: Literal["asc", "desc"] = "desc",
    limit: int = 50,
    offset: int = 0,
) -> DetectionListResponse:
    return request.app.state.batch_service.list_detections(
        batch_id=batch_id,
        batch_item_id=batch_item_id,
        category=category,
        min_confidence=min_confidence,
        max_confidence=max_confidence,
        min_area_mm2=min_area_mm2,
        is_valid=is_valid,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )


@router.post("/reviews", response_model=ReviewRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_review(request: Request, payload: ReviewCreateRequest) -> ReviewRecordResponse:
    return request.app.state.batch_service.create_review(payload)


@router.get("/reviews", response_model=ReviewListResponse)
async def list_reviews(
    request: Request,
    batch_id: Optional[str] = None,
    batch_item_id: Optional[str] = None,
    detection_id: Optional[str] = None,
    reviewer: Optional[str] = None,
    sort_by: Literal["reviewed_at", "created_at"] = "reviewed_at",
    sort_order: Literal["asc", "desc"] = "desc",
    limit: int = 50,
    offset: int = 0,
) -> ReviewListResponse:
    return request.app.state.batch_service.list_reviews(
        batch_id=batch_id,
        batch_item_id=batch_item_id,
        detection_id=detection_id,
        reviewer=reviewer,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )


@router.post("/alerts", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(request: Request, payload: AlertCreateRequest) -> AlertResponse:
    return request.app.state.batch_service.create_alert(payload)


@router.get("/alerts", response_model=AlertListResponse)
async def list_alerts(
    request: Request,
    batch_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    event_type: Optional[str] = None,
    sort_by: Literal["triggered_at", "created_at", "updated_at"] = "triggered_at",
    sort_order: Literal["asc", "desc"] = "desc",
    limit: int = 50,
    offset: int = 0,
) -> AlertListResponse:
    return request.app.state.batch_service.list_alerts(
        batch_id=batch_id,
        status_filter=status_filter,
        event_type=event_type,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )


@router.post("/alerts/{alert_id}/status", response_model=AlertResponse)
async def update_alert_status(
    request: Request,
    alert_id: str,
    payload: AlertStatusUpdateRequest,
) -> AlertResponse:
    return request.app.state.batch_service.update_alert_status(alert_id, payload)
