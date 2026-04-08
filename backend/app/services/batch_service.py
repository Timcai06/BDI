from __future__ import annotations

import io
import math
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import UploadFile, status
from PIL import Image as PILImage
from PIL import ImageStat
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.adapters.manager import RunnerManager
from app.core.errors import AppError
from app.db.models import (
    BatchItem,
    Bridge,
    InferenceTask,
    InspectionBatch,
)
from app.models.schemas import (
    AlertCreateRequest,
    AlertListResponse,
    AlertResponse,
    AlertStatusUpdateRequest,
    BatchCreateRequest,
    BatchCreateResponse,
    BatchDeleteResponse,
    BatchIngestItemError,
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
)
from app.services.batch_aggregate_service import refresh_batch_aggregates
from app.services.batch_alert_review_service import (
    apply_overdue_alert_escalation as apply_overdue_alert_escalation_via_service,
)
from app.services.batch_alert_review_service import (
    build_alert_trigger_payload as build_alert_trigger_payload_via_service,
)
from app.services.batch_alert_review_service import (
    build_sla_due_at_iso as build_sla_due_at_iso_via_service,
)
from app.services.batch_alert_review_service import (
    create_alert as create_alert_via_service,
)
from app.services.batch_alert_review_service import (
    create_review as create_review_via_service,
)
from app.services.batch_alert_review_service import (
    next_alert_level as next_alert_level_via_service,
)
from app.services.batch_alert_review_service import (
    parse_iso_datetime as parse_iso_datetime_via_service,
)
from app.services.batch_alert_review_service import (
    refresh_batch_item_alert_status as refresh_batch_item_alert_status_via_service,
)
from app.services.batch_alert_review_service import (
    update_alert_status as update_alert_status_via_service,
)
from app.services.batch_ingest_service import ingest_batch_items as ingest_batch_items_via_service
from app.services.batch_read_service import (
    get_batch_item_detail as get_batch_item_detail_via_service,
)
from app.services.batch_read_service import (
    get_batch_item_result as get_batch_item_result_via_service,
)
from app.services.batch_read_service import (
    get_batch_stats as get_batch_stats_via_service,
)
from app.services.batch_read_service import (
    get_ops_metrics as get_ops_metrics_via_service,
)
from app.services.batch_read_service import (
    list_alerts as list_alerts_via_service,
)
from app.services.batch_read_service import (
    list_batch_items as list_batch_items_via_service,
)
from app.services.batch_read_service import (
    list_detections as list_detections_via_service,
)
from app.services.batch_read_service import (
    list_reviews as list_reviews_via_service,
)
from app.services.batch_validation_service import (
    normalize_relative_path,
    resolve_requested_model_version,
    validate_enhancement_mode,
    validate_model_policy,
    validate_relative_paths,
)
from app.services.batch_write_service import create_batch as create_batch_via_service
from app.services.batch_write_service import create_bridge as create_bridge_via_service
from app.services.batch_write_service import delete_batch as delete_batch_via_service
from app.services.batch_write_service import delete_bridge as delete_bridge_via_service
from app.storage.local import LocalArtifactStore

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
MAX_BATCH_UPLOAD_FILES = 200
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
    MAX_BATCH_UPLOAD_FILES = MAX_BATCH_UPLOAD_FILES

    @staticmethod
    def _new_id(prefix: str) -> str:
        return _new_id(prefix)

    def __init__(
        self,
        *,
        session_factory: sessionmaker[Session],
        store: LocalArtifactStore,
        max_upload_size_bytes: int,
        runner_manager: Optional[RunnerManager] = None,
    ) -> None:
        self.session_factory = session_factory
        self.store = store
        self.max_upload_size_bytes = max_upload_size_bytes
        self.runner_manager = runner_manager
        self.alert_sla_hours_by_level = dict(ALERT_SLA_HOURS_BY_LEVEL)

    def set_alert_sla_hours_by_level(self, values: dict[str, int]) -> None:
        merged = dict(self.alert_sla_hours_by_level)
        for level in ALERT_LEVEL_ORDER:
            if level in values:
                merged[level] = max(1, int(values[level]))
        self.alert_sla_hours_by_level = merged

    def _resolve_requested_model_version(self, model_policy: str) -> Optional[str]:
        return resolve_requested_model_version(self, model_policy)

    def _validate_model_policy(self, model_policy: str) -> str:
        return validate_model_policy(self, model_policy)

    def _validate_enhancement_mode(self, enhancement_mode: str) -> str:
        return validate_enhancement_mode(enhancement_mode)

    def _build_bridge_response(self, *, session: Session, bridge: Bridge) -> BridgeResponse:
        latest_batch = session.scalar(
            select(InspectionBatch)
            .where(InspectionBatch.bridge_id == bridge.id)
            .order_by(InspectionBatch.created_at.desc())
            .limit(1)
        )
        active_batch_count = (
            session.scalar(
                select(func.count())
                .select_from(InspectionBatch)
                .where(
                    InspectionBatch.bridge_id == bridge.id,
                    InspectionBatch.status.in_(("created", "ingesting", "running")),
                )
            )
            or 0
        )
        abnormal_batch_count = (
            session.scalar(
                select(func.count())
                .select_from(InspectionBatch)
                .where(
                    InspectionBatch.bridge_id == bridge.id,
                    (InspectionBatch.failed_item_count > 0)
                    | (InspectionBatch.status.in_(("failed", "partial_failed"))),
                )
            )
            or 0
        )
        payload = BridgeResponse.model_validate(bridge).model_dump()
        payload["latest_batch_id"] = latest_batch.id if latest_batch is not None else None
        payload["latest_batch_code"] = latest_batch.batch_code if latest_batch is not None else None
        payload["latest_batch_status"] = latest_batch.status if latest_batch is not None else None
        payload["latest_batch_created_at"] = latest_batch.created_at if latest_batch is not None else None
        payload["active_batch_count"] = active_batch_count
        payload["abnormal_batch_count"] = abnormal_batch_count
        return BridgeResponse.model_validate(payload)

    def _resolve_batch_enhancement_mode(
        self,
        *,
        session: Session,
        batch_id: str,
        fallback: str = "auto",
    ) -> str:
        runtime_payload = session.execute(
            select(InferenceTask.runtime_payload)
            .join(BatchItem, BatchItem.id == InferenceTask.batch_item_id)
            .where(BatchItem.batch_id == batch_id)
            .order_by(InferenceTask.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        if isinstance(runtime_payload, dict):
            mode = runtime_payload.get("enhancement_mode")
            if isinstance(mode, str) and mode in {"off", "auto", "always"}:
                return mode
        return fallback

    def _build_batch_payload(
        self,
        *,
        session: Session,
        batch: InspectionBatch,
        bridge: Optional[Bridge],
        payload: Optional[BatchCreateRequest] = None,
    ) -> dict[str, Any]:
        data = BatchResponse.model_validate(batch).model_dump()
        data["bridge_code"] = bridge.bridge_code if bridge is not None else None
        data["bridge_name"] = bridge.bridge_name if bridge is not None else None
        data["inspection_label"] = payload.inspection_label if payload is not None else None
        fallback = payload.enhancement_mode if payload is not None else "auto"
        data["enhancement_mode"] = self._resolve_batch_enhancement_mode(
            session=session, batch_id=batch.id, fallback=fallback
        )
        return data

    def _generate_batch_code(self, *, session: Session, bridge: Bridge, attempt_offset: int = 0) -> str:
        date_prefix = datetime.now(timezone.utc).strftime("%Y%m%d")
        base = f"{bridge.bridge_code}-{date_prefix}"
        rows = session.scalars(
            select(InspectionBatch.batch_code).where(InspectionBatch.batch_code.like(f"{base}-%"))
        ).all()
        used_numbers: set[int] = set()
        for code in rows:
            try:
                used_numbers.add(int(str(code).rsplit("-", 1)[-1]))
            except (TypeError, ValueError):
                continue
        next_index = 1
        while next_index in used_numbers:
            next_index += 1
        next_index += attempt_offset
        return f"{base}-{next_index:03d}"

    def _should_enable_enhancement(self, *, content: bytes, enhancement_mode: str) -> bool:
        mode = (enhancement_mode or "auto").strip().lower()
        if mode == "off":
            return False
        if mode == "always":
            return True
        try:
            img = PILImage.open(io.BytesIO(content))
        except Exception:
            return False
        stat = ImageStat.Stat(img.convert("L"))
        mean_luma = stat.mean[0] if stat.mean else 255
        return mean_luma < 92

    def create_bridge(self, payload: BridgeCreateRequest) -> BridgeResponse:
        return create_bridge_via_service(self, payload)

    def list_bridges(self, *, limit: int, offset: int) -> BridgeListResponse:
        with self.session_factory() as session:
            total = session.scalar(select(func.count()).select_from(Bridge)) or 0
            rows = session.scalars(select(Bridge).order_by(Bridge.created_at.desc()).offset(offset).limit(limit)).all()

            items = [self._build_bridge_response(session=session, bridge=row) for row in rows]
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
            return self._build_bridge_response(session=session, bridge=bridge)

    def delete_bridge(self, bridge_id: str):
        return delete_bridge_via_service(self, bridge_id)

    def create_batch(self, payload: BatchCreateRequest) -> BatchCreateResponse:
        return create_batch_via_service(self, payload)

    def list_batches(
        self,
        *,
        limit: int,
        offset: int,
        bridge_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        has_failures: Optional[bool] = None,
    ) -> BatchListResponse:
        with self.session_factory() as session:
            query = select(InspectionBatch, Bridge).join(Bridge, Bridge.id == InspectionBatch.bridge_id)
            count_query = select(func.count()).select_from(InspectionBatch)
            if bridge_id is not None:
                query = query.where(InspectionBatch.bridge_id == bridge_id)
                count_query = count_query.where(InspectionBatch.bridge_id == bridge_id)
            if status_filter is not None:
                query = query.where(InspectionBatch.status == status_filter)
                count_query = count_query.where(InspectionBatch.status == status_filter)
            if has_failures is True:
                query = query.where(InspectionBatch.failed_item_count > 0)
                count_query = count_query.where(InspectionBatch.failed_item_count > 0)
            elif has_failures is False:
                query = query.where(InspectionBatch.failed_item_count == 0)
                count_query = count_query.where(InspectionBatch.failed_item_count == 0)
            total = session.scalar(count_query) or 0
            rows = session.execute(query.order_by(InspectionBatch.created_at.desc()).offset(offset).limit(limit)).all()
            dirty = False
            items: list[BatchResponse] = []
            for batch, bridge in rows:
                dirty = self._reconcile_batch_aggregates(session=session, batch=batch) or dirty
                items.append(
                    BatchResponse.model_validate(self._build_batch_payload(session=session, batch=batch, bridge=bridge))
                )
            if dirty:
                session.commit()
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
            if self._reconcile_batch_aggregates(session=session, batch=batch):
                session.commit()
            bridge = session.get(Bridge, batch.bridge_id)
            return BatchResponse.model_validate(self._build_batch_payload(session=session, batch=batch, bridge=bridge))

    def delete_batch(self, batch_id: str) -> BatchDeleteResponse:
        return delete_batch_via_service(self, batch_id)

    def list_batch_items(
        self,
        *,
        batch_id: str,
        limit: int,
        offset: int,
        relative_path_prefix: Optional[str] = None,
    ) -> BatchItemListResponse:
        return list_batch_items_via_service(
            self,
            batch_id=batch_id,
            limit=limit,
            offset=offset,
            relative_path_prefix=relative_path_prefix,
        )

    def get_batch_stats(self, *, batch_id: str) -> BatchStatsResponse:
        return get_batch_stats_via_service(self, batch_id=batch_id)

    def get_ops_metrics(self, *, window_hours: int) -> OpsMetricsResponse:
        return get_ops_metrics_via_service(self, window_hours=window_hours)

    def get_batch_item_detail(self, *, batch_item_id: str) -> BatchItemDetailResponse:
        return get_batch_item_detail_via_service(self, batch_item_id=batch_item_id)

    def get_batch_item_result(self, *, batch_item_id: str) -> BatchItemResultResponse:
        return get_batch_item_result_via_service(self, batch_item_id=batch_item_id)

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
        return list_detections_via_service(
            self,
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

    def create_review(self, payload: ReviewCreateRequest) -> ReviewRecordResponse:
        return create_review_via_service(self, payload)

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
        return list_reviews_via_service(
            self,
            batch_id=batch_id,
            batch_item_id=batch_item_id,
            detection_id=detection_id,
            reviewer=reviewer,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset,
        )

    def create_alert(self, payload: AlertCreateRequest) -> AlertResponse:
        return create_alert_via_service(self, payload)

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
        return list_alerts_via_service(
            self,
            batch_id=batch_id,
            status_filter=status_filter,
            event_type=event_type,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset,
        )

    def update_alert_status(self, alert_id: str, payload: AlertStatusUpdateRequest) -> AlertResponse:
        return update_alert_status_via_service(self, alert_id, payload)

    async def ingest_items(
        self,
        *,
        batch_id: str,
        files: list[UploadFile],
        relative_paths: Optional[list[str]],
        source_device: Optional[str],
        captured_at: Optional[datetime],
        model_policy: str,
        enhancement_mode: str,
    ) -> BatchIngestResponse:
        return await ingest_batch_items_via_service(
            self,
            batch_id=batch_id,
            files=files,
            relative_paths=relative_paths,
            source_device=source_device,
            captured_at=captured_at,
            model_policy=model_policy,
            enhancement_mode=enhancement_mode,
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
        return True, None

    async def _read_upload_content(self, file: UploadFile) -> bytes:
        content = await file.read()
        await file.seek(0)
        if not content:
            raise AppError(
                code="EMPTY_FILE",
                message="Uploaded image is empty.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if len(content) > self.max_upload_size_bytes:
            raise AppError(
                code="FILE_TOO_LARGE",
                message="Uploaded image exceeds maximum allowed size.",
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        return content

    def _normalize_relative_path(self, value: Optional[str]) -> Optional[str]:
        return normalize_relative_path(value)

    def _validate_relative_paths(self, *, files: list[UploadFile], relative_paths: Optional[list[str]]) -> None:
        validate_relative_paths(files=files, relative_paths=relative_paths)

    def _refresh_batch_aggregates(self, *, session: Session, batch_id: str) -> None:
        refresh_batch_aggregates(self, session=session, batch_id=batch_id)

    def _refresh_batch_item_alert_status(self, *, session: Session, batch_item_id: str) -> None:
        refresh_batch_item_alert_status_via_service(self, session=session, batch_item_id=batch_item_id)

    def _reconcile_batch_aggregates(self, *, session: Session, batch: InspectionBatch) -> bool:
        status_counts = dict(
            session.execute(
                select(BatchItem.processing_status, func.count())
                .where(BatchItem.batch_id == batch.id)
                .group_by(BatchItem.processing_status)
            ).all()
        )

        next_received = sum(status_counts.values())
        next_queued = int(status_counts.get("queued", 0))
        next_running = int(status_counts.get("running", 0))
        next_succeeded = int(status_counts.get("succeeded", 0))
        next_failed = int(status_counts.get("failed", 0))

        next_status = batch.status
        next_started_at = batch.started_at
        next_finished_at = batch.finished_at

        if next_received == 0:
            next_status = "ingesting"
            next_started_at = None
            next_finished_at = None
        else:
            if next_started_at is None:
                next_started_at = batch.created_at
            if next_running > 0 or next_queued > 0:
                next_status = "running"
                next_finished_at = None
            elif next_failed > 0 and next_succeeded > 0:
                next_status = "partial_failed"
                next_finished_at = batch.updated_at
            elif next_failed > 0:
                next_status = "failed"
                next_finished_at = batch.updated_at
            elif next_succeeded > 0:
                next_status = "completed"
                next_finished_at = batch.updated_at

        changed = any(
            [
                batch.received_item_count != next_received,
                batch.queued_item_count != next_queued,
                batch.running_item_count != next_running,
                batch.succeeded_item_count != next_succeeded,
                batch.failed_item_count != next_failed,
                batch.status != next_status,
                batch.started_at != next_started_at,
                batch.finished_at != next_finished_at,
            ]
        )
        if not changed:
            return False

        batch.received_item_count = next_received
        batch.queued_item_count = next_queued
        batch.running_item_count = next_running
        batch.succeeded_item_count = next_succeeded
        batch.failed_item_count = next_failed
        batch.status = next_status
        batch.started_at = next_started_at
        batch.finished_at = next_finished_at
        return True

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
        return build_alert_trigger_payload_via_service(self, base_payload, alert_level)

    def _apply_overdue_alert_escalation(self, *, session: Session) -> None:
        apply_overdue_alert_escalation_via_service(self, session=session)

    @staticmethod
    def _parse_iso_datetime(value: Any) -> Optional[datetime]:
        return parse_iso_datetime_via_service(value)

    @staticmethod
    def _next_alert_level(level: str) -> str:
        return next_alert_level_via_service(level)

    def _build_sla_due_at_iso(self, level: str, start_at: datetime) -> str:
        return build_sla_due_at_iso_via_service(self, level, start_at)
