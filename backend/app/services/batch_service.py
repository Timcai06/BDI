from __future__ import annotations

import hashlib
import math
from datetime import datetime, timedelta, timezone
from pathlib import PurePosixPath
from typing import Any, Optional
from uuid import uuid4

from fastapi import UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import AppError
from app.db.models import (
    AlertEvent,
    BatchItem,
    Bridge,
    Detection,
    InferenceResult,
    InferenceTask,
    InspectionBatch,
    MediaAsset,
    ReviewRecord,
)
from app.models.schemas import (
    AlertCreateRequest,
    AlertListResponse,
    AlertResponse,
    AlertStatusUpdateRequest,
    BatchItemDetailResponse,
    BatchCreateRequest,
    BatchCreateResponse,
    BatchItemListResponse,
    BatchItemResponse,
    BatchItemResultResponse,
    BatchIngestItemError,
    BatchIngestItemSuccess,
    BatchIngestResponse,
    BatchListResponse,
    BatchResponse,
    BatchStatsResponse,
    BridgeCreateRequest,
    BridgeListResponse,
    BridgeResponse,
    DetectionListResponse,
    DetectionRecordResponse,
    MediaAssetResponse,
    OpsMetricsResponse,
    ReviewCreateRequest,
    ReviewListResponse,
    ReviewRecordResponse,
    ResultDetectionResponse,
)
from app.storage.local import LocalArtifactStore

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
ALERT_LEVEL_ORDER = ["low", "medium", "high", "critical"]
ALERT_SLA_HOURS_BY_LEVEL = {
    "low": 72,
    "medium": 48,
    "high": 24,
    "critical": 12,
}


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:16]}"


class BatchService:
    def __init__(
        self,
        *,
        session_factory: sessionmaker[Session],
        store: LocalArtifactStore,
        max_upload_size_bytes: int,
    ) -> None:
        self.session_factory = session_factory
        self.store = store
        self.max_upload_size_bytes = max_upload_size_bytes
        self.alert_sla_hours_by_level = dict(ALERT_SLA_HOURS_BY_LEVEL)

    def set_alert_sla_hours_by_level(self, values: dict[str, int]) -> None:
        merged = dict(self.alert_sla_hours_by_level)
        for level in ALERT_LEVEL_ORDER:
            if level in values:
                merged[level] = max(1, int(values[level]))
        self.alert_sla_hours_by_level = merged

    def create_bridge(self, payload: BridgeCreateRequest) -> BridgeResponse:
        with self.session_factory() as session:
            existing = session.scalar(select(Bridge).where(Bridge.bridge_code == payload.bridge_code))
            if existing is not None:
                raise AppError(
                    code="BRIDGE_CODE_CONFLICT",
                    message="Bridge code already exists.",
                    status_code=status.HTTP_409_CONFLICT,
                    details={"bridge_code": payload.bridge_code},
                )

            bridge = Bridge(
                id=_new_id("br"),
                bridge_code=payload.bridge_code,
                bridge_name=payload.bridge_name,
                bridge_type=payload.bridge_type,
                region=payload.region,
                manager_org=payload.manager_org,
                longitude=payload.longitude,
                latitude=payload.latitude,
                status="active",
            )
            session.add(bridge)
            session.commit()
            session.refresh(bridge)
            return BridgeResponse.model_validate(bridge)

    def list_bridges(self, *, limit: int, offset: int) -> BridgeListResponse:
        with self.session_factory() as session:
            total = session.scalar(select(func.count()).select_from(Bridge)) or 0
            rows = session.scalars(
                select(Bridge)
                .order_by(Bridge.created_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()

            items = [BridgeResponse.model_validate(row) for row in rows]
            return BridgeListResponse(items=items, total=total, limit=limit, offset=offset)

    def get_bridge(self, bridge_id: str) -> BridgeResponse:
        with self.session_factory() as session:
            bridge = session.get(Bridge, bridge_id)
            if bridge is None:
                raise AppError(
                    code="BRIDGE_NOT_FOUND",
                    message="Bridge does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"bridge_id": bridge_id},
                )
            return BridgeResponse.model_validate(bridge)

    def create_batch(self, payload: BatchCreateRequest) -> BatchCreateResponse:
        with self.session_factory() as session:
            bridge = session.get(Bridge, payload.bridge_id)
            if bridge is None:
                raise AppError(
                    code="BRIDGE_NOT_FOUND",
                    message="Bridge does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"bridge_id": payload.bridge_id},
                )

            existing = session.scalar(
                select(InspectionBatch).where(InspectionBatch.batch_code == payload.batch_code)
            )
            if existing is not None:
                raise AppError(
                    code="BATCH_CODE_CONFLICT",
                    message="Batch code already exists.",
                    status_code=status.HTTP_409_CONFLICT,
                    details={"batch_code": payload.batch_code},
                )

            batch = InspectionBatch(
                id=_new_id("bat"),
                bridge_id=payload.bridge_id,
                batch_code=payload.batch_code,
                source_type=payload.source_type,
                status="ingesting",
                expected_item_count=payload.expected_item_count,
                created_by=payload.created_by,
                sealed=False,
            )
            session.add(batch)
            session.commit()
            session.refresh(batch)
            return BatchCreateResponse.model_validate(batch)

    def list_batches(self, *, limit: int, offset: int) -> BatchListResponse:
        with self.session_factory() as session:
            total = session.scalar(select(func.count()).select_from(InspectionBatch)) or 0
            rows = session.scalars(
                select(InspectionBatch)
                .order_by(InspectionBatch.created_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
            items = [BatchResponse.model_validate(row) for row in rows]
            return BatchListResponse(items=items, total=total, limit=limit, offset=offset)

    def get_batch(self, batch_id: str) -> BatchResponse:
        with self.session_factory() as session:
            batch = session.get(InspectionBatch, batch_id)
            if batch is None:
                raise AppError(
                    code="BATCH_NOT_FOUND",
                    message="Batch does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"batch_id": batch_id},
                )
            return BatchResponse.model_validate(batch)

    def list_batch_items(
        self,
        *,
        batch_id: str,
        limit: int,
        offset: int,
        relative_path_prefix: Optional[str] = None,
    ) -> BatchItemListResponse:
        with self.session_factory() as session:
            batch = session.get(InspectionBatch, batch_id)
            if batch is None:
                raise AppError(
                    code="BATCH_NOT_FOUND",
                    message="Batch does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"batch_id": batch_id},
                )

            normalized_prefix = self._normalize_relative_path(relative_path_prefix)
            count_query = (
                select(func.count())
                .select_from(BatchItem)
                .join(MediaAsset, MediaAsset.id == BatchItem.media_asset_id)
                .where(BatchItem.batch_id == batch_id)
            )
            query = (
                select(BatchItem, MediaAsset)
                .join(MediaAsset, MediaAsset.id == BatchItem.media_asset_id)
                .where(BatchItem.batch_id == batch_id)
            )
            if normalized_prefix:
                count_query = count_query.where(MediaAsset.source_relative_path.ilike(f"{normalized_prefix}%"))
                query = query.where(MediaAsset.source_relative_path.ilike(f"{normalized_prefix}%"))
            total = session.scalar(count_query) or 0
            rows = session.execute(
                query
                .order_by(BatchItem.sequence_no.asc())
                .offset(offset)
                .limit(limit)
            ).all()
            items: list[BatchItemResponse] = []
            for batch_item, media_asset in rows:
                item_payload = BatchItemResponse.model_validate(batch_item).model_dump()
                item_payload["source_relative_path"] = media_asset.source_relative_path
                items.append(BatchItemResponse.model_validate(item_payload))
            return BatchItemListResponse(items=items, total=total, limit=limit, offset=offset)

    def get_batch_stats(self, *, batch_id: str) -> BatchStatsResponse:
        with self.session_factory() as session:
            batch = session.get(InspectionBatch, batch_id)
            if batch is None:
                raise AppError(
                    code="BATCH_NOT_FOUND",
                    message="Batch does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"batch_id": batch_id},
                )

            status_breakdown = dict(
                session.execute(
                    select(BatchItem.processing_status, func.count())
                    .where(BatchItem.batch_id == batch_id)
                    .group_by(BatchItem.processing_status)
                ).all()
            )
            review_breakdown = dict(
                session.execute(
                    select(BatchItem.review_status, func.count())
                    .where(BatchItem.batch_id == batch_id)
                    .group_by(BatchItem.review_status)
                ).all()
            )
            category_breakdown = dict(
                session.execute(
                    select(Detection.category, func.count())
                    .join(BatchItem, BatchItem.id == Detection.batch_item_id)
                    .where(BatchItem.batch_id == batch_id)
                    .group_by(Detection.category)
                ).all()
            )
            alert_breakdown = dict(
                session.execute(
                    select(AlertEvent.status, func.count())
                    .where(AlertEvent.batch_id == batch_id)
                    .group_by(AlertEvent.status)
                ).all()
            )

            return BatchStatsResponse(
                batch_id=batch_id,
                status_breakdown={key: int(value) for key, value in status_breakdown.items()},
                review_breakdown={key: int(value) for key, value in review_breakdown.items()},
                category_breakdown={key: int(value) for key, value in category_breakdown.items()},
                alert_breakdown={key: int(value) for key, value in alert_breakdown.items()},
            )

    def get_ops_metrics(self, *, window_hours: int) -> OpsMetricsResponse:
        hours = max(1, window_hours)
        now = datetime.now(timezone.utc)
        window_start = now.timestamp() - float(hours * 3600)
        with self.session_factory() as session:
            rows = session.scalars(
                select(InferenceTask).where(InferenceTask.created_at >= datetime.fromtimestamp(window_start, timezone.utc))
            ).all()

            status_breakdown: dict[str, int] = {}
            failure_code_breakdown: dict[str, int] = {}
            queue_wait_ms: list[int] = []
            run_ms: list[int] = []
            retried_item_ids: set[str] = set()
            recovered_item_ids: set[str] = set()

            for task in rows:
                status_breakdown[task.status] = status_breakdown.get(task.status, 0) + 1
                if task.status == "failed" and task.failure_code:
                    failure_code_breakdown[task.failure_code] = failure_code_breakdown.get(task.failure_code, 0) + 1
                if task.attempt_no > 1:
                    retried_item_ids.add(task.batch_item_id)
                if task.status == "succeeded" and task.attempt_no > 1:
                    recovered_item_ids.add(task.batch_item_id)
                if task.queued_at is not None and task.started_at is not None:
                    wait = int((task.started_at - task.queued_at).total_seconds() * 1000)
                    if wait >= 0:
                        queue_wait_ms.append(wait)
                if task.started_at is not None and task.finished_at is not None:
                    duration = int((task.finished_at - task.started_at).total_seconds() * 1000)
                    if duration >= 0:
                        run_ms.append(duration)

            total_tasks = len(rows)
            success_count = int(status_breakdown.get("succeeded", 0))
            success_rate = float(success_count / total_tasks) if total_tasks > 0 else 0.0
            retry_recovery_rate: Optional[float] = None
            if retried_item_ids:
                retry_recovery_rate = float(len(recovered_item_ids) / len(retried_item_ids))

            return OpsMetricsResponse(
                window_hours=hours,
                generated_at=now,
                total_tasks=total_tasks,
                success_rate=round(success_rate, 4),
                retry_recovery_rate=round(retry_recovery_rate, 4) if retry_recovery_rate is not None else None,
                queued_tasks=int(status_breakdown.get("queued", 0)),
                running_tasks=int(status_breakdown.get("running", 0)),
                failed_tasks=int(status_breakdown.get("failed", 0)),
                p50_queue_wait_ms=self._percentile_int(queue_wait_ms, 0.50),
                p95_queue_wait_ms=self._percentile_int(queue_wait_ms, 0.95),
                p50_run_ms=self._percentile_int(run_ms, 0.50),
                p95_run_ms=self._percentile_int(run_ms, 0.95),
                status_breakdown=status_breakdown,
                failure_code_breakdown=failure_code_breakdown,
            )

    def get_batch_item_detail(self, *, batch_item_id: str) -> BatchItemDetailResponse:
        with self.session_factory() as session:
            row = session.execute(
                select(BatchItem, MediaAsset)
                .join(MediaAsset, MediaAsset.id == BatchItem.media_asset_id)
                .where(BatchItem.id == batch_item_id)
            ).first()
            if row is None:
                raise AppError(
                    code="BATCH_ITEM_NOT_FOUND",
                    message="Batch item does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"batch_item_id": batch_item_id},
                )
            batch_item, media_asset = row
            item_payload = BatchItemResponse.model_validate(batch_item).model_dump()
            item_payload["source_relative_path"] = media_asset.source_relative_path
            item_payload["media_asset"] = MediaAssetResponse.model_validate(media_asset)
            return BatchItemDetailResponse.model_validate(item_payload)

    def get_batch_item_result(self, *, batch_item_id: str) -> BatchItemResultResponse:
        with self.session_factory() as session:
            result = session.scalar(
                select(InferenceResult)
                .where(InferenceResult.batch_item_id == batch_item_id)
                .order_by(InferenceResult.created_at.desc())
                .limit(1)
            )
            if result is None:
                raise AppError(
                    code="RESULT_NOT_FOUND",
                    message="Result does not exist for batch item.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"batch_item_id": batch_item_id},
                )

            rows = session.scalars(
                select(Detection)
                .where(Detection.result_id == result.id)
                .order_by(Detection.created_at.asc())
            ).all()

            detections = [
                ResultDetectionResponse(
                    id=item.id,
                    category=item.category,
                    confidence=item.confidence,
                    severity_level=item.severity_level,
                    bbox={
                        "x": item.bbox_x,
                        "y": item.bbox_y,
                        "width": item.bbox_width,
                        "height": item.bbox_height,
                    },
                    mask=item.mask_payload,
                    metrics={
                        "length_mm": item.length_mm,
                        "width_mm": item.width_mm,
                        "area_mm2": item.area_mm2,
                    },
                    source_role=item.source_role,
                    source_model_name=item.source_model_name,
                    source_model_version=item.source_model_version,
                    is_valid=item.is_valid,
                )
                for item in rows
            ]

            return BatchItemResultResponse(
                id=result.id,
                task_id=result.task_id,
                batch_item_id=result.batch_item_id,
                schema_version=result.schema_version,
                model_name=result.model_name,
                model_version=result.model_version,
                backend=result.backend,
                inference_mode=result.inference_mode,
                inference_ms=result.inference_ms,
                inference_breakdown=result.inference_breakdown,
                detection_count=result.detection_count,
                has_masks=result.has_masks,
                mask_detection_count=result.mask_detection_count,
                overlay_uri=result.overlay_uri,
                json_uri=result.json_uri,
                diagnosis_uri=result.diagnosis_uri,
                created_at=result.created_at,
                detections=detections,
            )

    def list_detections(
        self,
        *,
        batch_id: Optional[str],
        batch_item_id: Optional[str],
        category: Optional[str],
        min_confidence: Optional[float],
        max_confidence: Optional[float],
        min_area_mm2: Optional[float],
        is_valid: Optional[bool],
        sort_by: str,
        sort_order: str,
        limit: int,
        offset: int,
    ) -> DetectionListResponse:
        with self.session_factory() as session:
            query = select(Detection)
            count_query = select(func.count()).select_from(Detection)
            if batch_id is not None:
                query = query.join(BatchItem, BatchItem.id == Detection.batch_item_id).where(BatchItem.batch_id == batch_id)
                count_query = count_query.join(BatchItem, BatchItem.id == Detection.batch_item_id).where(BatchItem.batch_id == batch_id)
            if batch_item_id is not None:
                query = query.where(Detection.batch_item_id == batch_item_id)
                count_query = count_query.where(Detection.batch_item_id == batch_item_id)
            if category is not None:
                query = query.where(Detection.category == category)
                count_query = count_query.where(Detection.category == category)
            if min_confidence is not None:
                query = query.where(Detection.confidence >= min_confidence)
                count_query = count_query.where(Detection.confidence >= min_confidence)
            if max_confidence is not None:
                query = query.where(Detection.confidence <= max_confidence)
                count_query = count_query.where(Detection.confidence <= max_confidence)
            if min_area_mm2 is not None:
                query = query.where(Detection.area_mm2.is_not(None), Detection.area_mm2 >= min_area_mm2)
                count_query = count_query.where(Detection.area_mm2.is_not(None), Detection.area_mm2 >= min_area_mm2)
            if is_valid is not None:
                query = query.where(Detection.is_valid == is_valid)
                count_query = count_query.where(Detection.is_valid == is_valid)

            sort_map: dict[str, Any] = {
                "created_at": Detection.created_at,
                "confidence": Detection.confidence,
                "area_mm2": Detection.area_mm2,
            }
            sort_column = sort_map.get(sort_by, Detection.created_at)
            if sort_order == "asc":
                query = query.order_by(sort_column.asc(), Detection.id.asc())
            else:
                query = query.order_by(sort_column.desc(), Detection.id.desc())

            total = session.scalar(count_query) or 0
            rows = session.scalars(query.offset(offset).limit(limit)).all()
            items = [DetectionRecordResponse.model_validate(row) for row in rows]
            return DetectionListResponse(items=items, total=total, limit=limit, offset=offset)

    def create_review(self, payload: ReviewCreateRequest) -> ReviewRecordResponse:
        with self.session_factory() as session:
            detection = session.get(Detection, payload.detection_id)
            if detection is None:
                raise AppError(
                    code="DETECTION_NOT_FOUND",
                    message="Detection does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"detection_id": payload.detection_id},
                )

            decision_map = {
                "confirm": "confirmed",
                "reject": "rejected",
                "edit": "edited",
            }
            before_payload = {
                "is_valid": detection.is_valid,
                "severity_level": detection.severity_level,
                "category": detection.category,
                "extra_payload": detection.extra_payload,
            }
            review = ReviewRecord(
                id=_new_id("rev"),
                batch_item_id=detection.batch_item_id,
                result_id=detection.result_id,
                detection_id=detection.id,
                review_action=payload.review_action,
                review_decision=decision_map[payload.review_action],
                before_payload=before_payload,
                after_payload=payload.after_payload,
                review_note=payload.review_note,
                reviewer=payload.reviewer,
                reviewed_at=datetime.now(timezone.utc),
            )

            if payload.review_action == "reject":
                detection.is_valid = False
            else:
                detection.is_valid = True
            if payload.review_action == "edit":
                detection.extra_payload = payload.after_payload

            batch_item = session.get(BatchItem, detection.batch_item_id)
            if batch_item is not None:
                batch_item.review_status = "reviewed"

            session.add(review)
            session.commit()
            session.refresh(review)
            return ReviewRecordResponse.model_validate(review)

    def list_reviews(
        self,
        *,
        batch_id: Optional[str],
        batch_item_id: Optional[str],
        detection_id: Optional[str],
        reviewer: Optional[str],
        sort_by: str,
        sort_order: str,
        limit: int,
        offset: int,
    ) -> ReviewListResponse:
        with self.session_factory() as session:
            query = select(ReviewRecord)
            count_query = select(func.count()).select_from(ReviewRecord)
            if batch_id is not None:
                query = query.join(BatchItem, BatchItem.id == ReviewRecord.batch_item_id).where(BatchItem.batch_id == batch_id)
                count_query = count_query.join(BatchItem, BatchItem.id == ReviewRecord.batch_item_id).where(BatchItem.batch_id == batch_id)
            if batch_item_id is not None:
                query = query.where(ReviewRecord.batch_item_id == batch_item_id)
                count_query = count_query.where(ReviewRecord.batch_item_id == batch_item_id)
            if detection_id is not None:
                query = query.where(ReviewRecord.detection_id == detection_id)
                count_query = count_query.where(ReviewRecord.detection_id == detection_id)
            if reviewer is not None:
                query = query.where(ReviewRecord.reviewer == reviewer)
                count_query = count_query.where(ReviewRecord.reviewer == reviewer)

            sort_map: dict[str, Any] = {
                "reviewed_at": ReviewRecord.reviewed_at,
                "created_at": ReviewRecord.created_at,
            }
            sort_column = sort_map.get(sort_by, ReviewRecord.reviewed_at)
            if sort_order == "asc":
                query = query.order_by(sort_column.asc(), ReviewRecord.id.asc())
            else:
                query = query.order_by(sort_column.desc(), ReviewRecord.id.desc())

            total = session.scalar(count_query) or 0
            rows = session.scalars(query.offset(offset).limit(limit)).all()
            items = [ReviewRecordResponse.model_validate(row) for row in rows]
            return ReviewListResponse(items=items, total=total, limit=limit, offset=offset)

    def create_alert(self, payload: AlertCreateRequest) -> AlertResponse:
        with self.session_factory() as session:
            bridge = session.get(Bridge, payload.bridge_id)
            if bridge is None:
                raise AppError(
                    code="BRIDGE_NOT_FOUND",
                    message="Bridge does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"bridge_id": payload.bridge_id},
                )
            batch = session.get(InspectionBatch, payload.batch_id)
            if batch is None:
                raise AppError(
                    code="BATCH_NOT_FOUND",
                    message="Batch does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"batch_id": payload.batch_id},
                )

            alert = AlertEvent(
                id=_new_id("alt"),
                bridge_id=payload.bridge_id,
                batch_id=payload.batch_id,
                batch_item_id=payload.batch_item_id,
                result_id=payload.result_id,
                detection_id=payload.detection_id,
                event_type=payload.event_type,
                alert_level=payload.alert_level,
                status="open",
                title=payload.title,
                trigger_payload=self._build_alert_trigger_payload(payload.trigger_payload, payload.alert_level),
                note=payload.note,
                triggered_at=datetime.now(timezone.utc),
            )
            session.add(alert)
            session.flush()

            if payload.batch_item_id is not None:
                self._refresh_batch_item_alert_status(session=session, batch_item_id=payload.batch_item_id)

            session.commit()
            session.refresh(alert)
            return AlertResponse.model_validate(alert)

    def list_alerts(
        self,
        *,
        batch_id: Optional[str],
        status_filter: Optional[str],
        event_type: Optional[str],
        sort_by: str,
        sort_order: str,
        limit: int,
        offset: int,
    ) -> AlertListResponse:
        with self.session_factory() as session:
            self._apply_overdue_alert_escalation(session=session)
            query = select(AlertEvent)
            count_query = select(func.count()).select_from(AlertEvent)
            if batch_id is not None:
                query = query.where(AlertEvent.batch_id == batch_id)
                count_query = count_query.where(AlertEvent.batch_id == batch_id)
            if status_filter is not None:
                query = query.where(AlertEvent.status == status_filter)
                count_query = count_query.where(AlertEvent.status == status_filter)
            if event_type is not None:
                query = query.where(AlertEvent.event_type == event_type)
                count_query = count_query.where(AlertEvent.event_type == event_type)

            sort_map: dict[str, Any] = {
                "triggered_at": AlertEvent.triggered_at,
                "created_at": AlertEvent.created_at,
                "updated_at": AlertEvent.updated_at,
            }
            sort_column = sort_map.get(sort_by, AlertEvent.triggered_at)
            if sort_order == "asc":
                query = query.order_by(sort_column.asc(), AlertEvent.id.asc())
            else:
                query = query.order_by(sort_column.desc(), AlertEvent.id.desc())

            total = session.scalar(count_query) or 0
            rows = session.scalars(query.offset(offset).limit(limit)).all()
            items = [AlertResponse.model_validate(row) for row in rows]
            return AlertListResponse(items=items, total=total, limit=limit, offset=offset)

    def update_alert_status(self, alert_id: str, payload: AlertStatusUpdateRequest) -> AlertResponse:
        with self.session_factory() as session:
            alert = session.get(AlertEvent, alert_id)
            if alert is None:
                raise AppError(
                    code="ALERT_NOT_FOUND",
                    message="Alert does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"alert_id": alert_id},
                )

            if payload.action == "acknowledge":
                alert.status = "acknowledged"
                alert.acknowledged_by = payload.operator
                alert.acknowledged_at = datetime.now(timezone.utc)
            elif payload.action == "resolve":
                if alert.acknowledged_at is None:
                    alert.acknowledged_by = payload.operator
                    alert.acknowledged_at = datetime.now(timezone.utc)
                alert.status = "resolved"
                alert.resolved_at = datetime.now(timezone.utc)
            if payload.note:
                alert.note = payload.note

            if alert.batch_item_id is not None:
                self._refresh_batch_item_alert_status(session=session, batch_item_id=alert.batch_item_id)

            session.commit()
            session.refresh(alert)
            return AlertResponse.model_validate(alert)

    async def ingest_items(
        self,
        *,
        batch_id: str,
        files: list[UploadFile],
        relative_paths: Optional[list[str]],
        source_device: Optional[str],
        captured_at: Optional[datetime],
        model_policy: str,
    ) -> BatchIngestResponse:
        with self.session_factory() as session:
            batch = session.get(InspectionBatch, batch_id)
            if batch is None:
                raise AppError(
                    code="BATCH_NOT_FOUND",
                    message="Batch does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"batch_id": batch_id},
                )
            if batch.sealed:
                raise AppError(
                    code="BATCH_ALREADY_SEALED",
                    message="Batch is sealed and cannot accept new items.",
                    status_code=status.HTTP_409_CONFLICT,
                    details={"batch_id": batch_id},
                )

            current_sequence = session.scalar(
                select(func.coalesce(func.max(BatchItem.sequence_no), 0)).where(BatchItem.batch_id == batch_id)
            ) or 0

            accepted: list[BatchIngestItemSuccess] = []
            errors: list[BatchIngestItemError] = []

            for index, file in enumerate(files):
                ok, error = await self._validate_upload(file)
                if not ok:
                    if error is not None:
                        errors.append(error)
                    continue

                content = await file.read()
                file_hash = hashlib.sha256(content).hexdigest()
                duplicated = session.scalar(
                    select(func.count())
                    .select_from(BatchItem)
                    .join(MediaAsset, MediaAsset.id == BatchItem.media_asset_id)
                    .where(BatchItem.batch_id == batch_id, MediaAsset.sha256 == file_hash)
                )
                if duplicated:
                    errors.append(
                        BatchIngestItemError(
                            filename=file.filename or "",
                            code="MEDIA_DUPLICATED",
                            message="Image already exists in this batch.",
                        )
                    )
                    continue

                media_asset_id = _new_id("med")
                batch_item_id = _new_id("bit")
                task_id = _new_id("tsk")
                current_sequence += 1

                storage_uri = self.store.save_upload(image_id=media_asset_id, content=content)
                source_relative_path = self._normalize_relative_path(
                    relative_paths[index] if relative_paths and index < len(relative_paths) else None
                )

                media_asset = MediaAsset(
                    id=media_asset_id,
                    media_type="image",
                    original_filename=file.filename or media_asset_id,
                    storage_uri=storage_uri,
                    sha256=file_hash,
                    mime_type=file.content_type or "application/octet-stream",
                    file_size_bytes=len(content),
                    captured_at=captured_at,
                    source_device=source_device,
                    source_relative_path=source_relative_path,
                )
                session.add(media_asset)
                # Ensure media_assets rows are persisted before batch_items flushes.
                # This avoids FK violations when SQLAlchemy groups inserts by mapper.
                session.flush()

                batch_item = BatchItem(
                    id=batch_item_id,
                    batch_id=batch_id,
                    media_asset_id=media_asset_id,
                    sequence_no=current_sequence,
                    processing_status="queued",
                    latest_task_id=task_id,
                )
                task = InferenceTask(
                    id=task_id,
                    batch_item_id=batch_item_id,
                    status="queued",
                    model_policy=model_policy,
                    queued_at=datetime.now(timezone.utc),
                )

                session.add(batch_item)
                session.add(task)

                accepted.append(
                    BatchIngestItemSuccess(
                        batch_item_id=batch_item_id,
                        media_asset_id=media_asset_id,
                        original_filename=file.filename or media_asset_id,
                        source_relative_path=source_relative_path,
                        processing_status="queued",
                        task_id=task_id,
                    )
                )

            if accepted:
                batch.received_item_count += len(accepted)
                batch.queued_item_count += len(accepted)
                batch.status = "running"
            session.commit()

            return BatchIngestResponse(
                batch_id=batch_id,
                accepted_count=len(accepted),
                rejected_count=len(errors),
                items=accepted,
                errors=errors,
            )

    async def _validate_upload(
        self,
        file: UploadFile,
    ) -> tuple[bool, Optional[BatchIngestItemError]]:
        if not file.filename:
            return False, BatchIngestItemError(
                filename="",
                code="MISSING_FILENAME",
                message="Uploaded file must include a filename.",
            )
        suffix = file.filename[file.filename.rfind(".") :].lower() if "." in file.filename else ""
        if suffix not in ALLOWED_SUFFIXES:
            return False, BatchIngestItemError(
                filename=file.filename,
                code="INVALID_IMAGE_FORMAT",
                message="Only jpg, jpeg, png, and webp files are supported.",
            )
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            return False, BatchIngestItemError(
                filename=file.filename,
                code="INVALID_CONTENT_TYPE",
                message="Unsupported content type for uploaded image.",
            )
        content = await file.read()
        if not content:
            return False, BatchIngestItemError(
                filename=file.filename,
                code="EMPTY_FILE",
                message="Uploaded image is empty.",
            )
        if len(content) > self.max_upload_size_bytes:
            return False, BatchIngestItemError(
                filename=file.filename,
                code="FILE_TOO_LARGE",
                message="Uploaded image exceeds maximum allowed size.",
            )
        await file.seek(0)
        return True, None

    def _normalize_relative_path(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        normalized = value.strip().replace("\\", "/")
        if not normalized:
            return None
        parts = [part for part in PurePosixPath(normalized).parts if part not in ("", ".")]
        if not parts or any(part == ".." for part in parts):
            return None
        return "/".join(parts)[:1024]

    def _refresh_batch_item_alert_status(self, *, session: Session, batch_item_id: str) -> None:
        batch_item = session.get(BatchItem, batch_item_id)
        if batch_item is None:
            return

        status_counts = dict(
            session.execute(
                select(AlertEvent.status, func.count())
                .where(AlertEvent.batch_item_id == batch_item_id)
                .group_by(AlertEvent.status)
            ).all()
        )
        if int(status_counts.get("open", 0)) > 0:
            batch_item.alert_status = "open"
        elif int(status_counts.get("acknowledged", 0)) > 0:
            batch_item.alert_status = "acknowledged"
        elif int(status_counts.get("resolved", 0)) > 0:
            batch_item.alert_status = "resolved"
        else:
            batch_item.alert_status = "none"

    @staticmethod
    def _percentile_int(values: list[int], p: float) -> Optional[int]:
        if not values:
            return None
        if p <= 0:
            return int(min(values))
        if p >= 1:
            return int(max(values))
        sorted_values = sorted(values)
        rank = max(1, math.ceil(p * len(sorted_values)))
        return int(sorted_values[rank - 1])

    def _build_alert_trigger_payload(self, base_payload: dict[str, Any], alert_level: str) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        payload = dict(base_payload)
        payload.setdefault("repeat_hits", 1)
        payload.setdefault("first_triggered_at", now.isoformat())
        payload["last_triggered_at"] = now.isoformat()
        payload["sla_due_at"] = self._build_sla_due_at_iso(alert_level, now)
        return payload

    def _apply_overdue_alert_escalation(self, *, session: Session) -> None:
        now = datetime.now(timezone.utc)
        alerts = session.scalars(
            select(AlertEvent).where(AlertEvent.status.in_(["open", "acknowledged"]))
        ).all()
        changed = False
        for alert in alerts:
            payload = dict(alert.trigger_payload or {})
            due_at_raw = payload.get("sla_due_at")
            if not due_at_raw:
                continue
            due_at = self._parse_iso_datetime(due_at_raw)
            if due_at is None or now <= due_at:
                continue
            next_level = self._next_alert_level(alert.alert_level)
            if next_level == alert.alert_level:
                continue
            alert.alert_level = next_level
            payload["overdue_escalated_at"] = now.isoformat()
            payload["sla_due_at"] = self._build_sla_due_at_iso(next_level, now)
            alert.trigger_payload = payload
            changed = True
        if changed:
            session.commit()

    @staticmethod
    def _parse_iso_datetime(value: Any) -> Optional[datetime]:
        if not isinstance(value, str):
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed

    @staticmethod
    def _next_alert_level(level: str) -> str:
        try:
            idx = ALERT_LEVEL_ORDER.index(level)
        except ValueError:
            return "critical"
        if idx >= len(ALERT_LEVEL_ORDER) - 1:
            return ALERT_LEVEL_ORDER[-1]
        return ALERT_LEVEL_ORDER[idx + 1]

    def _build_sla_due_at_iso(self, level: str, start_at: datetime) -> str:
        hours = self.alert_sla_hours_by_level.get(level, self.alert_sla_hours_by_level.get("critical", 12))
        due_at = start_at + timedelta(hours=hours)
        return due_at.isoformat()
