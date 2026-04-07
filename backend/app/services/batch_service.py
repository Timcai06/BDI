from __future__ import annotations

import io
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Optional
from uuid import uuid4

from fastapi import UploadFile, status
from PIL import Image as PILImage
from PIL import ImageStat
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, sessionmaker

from app.adapters.manager import RunnerManager
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
from app.storage.local import LocalArtifactStore

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_ENHANCEMENT_MODES = {"off", "auto", "always"}
DEFAULT_MODEL_POLICIES = {"active-default", "active", "fusion-default", "seepage-priority", "general-only"}
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
        if self.runner_manager is None:
            return None

        registry = self.runner_manager.registry
        policy = (model_policy or "").strip().lower()
        if not policy or policy in {"active-default", "active"}:
            return registry.active_version
        if policy in {"fusion-default", "seepage-priority"}:
            active_spec = registry.get_active()
            if active_spec.runner_kind == "fusion":
                return active_spec.model_version
            for spec in registry.list_specs():
                if spec.runner_kind == "fusion":
                    return spec.model_version
            return registry.active_version
        if policy == "general-only":
            active_spec = registry.get_active()
            if active_spec.runner_kind == "fusion" and active_spec.primary_model_version:
                return active_spec.primary_model_version
            for spec in registry.list_specs():
                if spec.runner_kind in {"ultralytics", "external_ultralytics"}:
                    return spec.model_version
            return registry.active_version
        if policy in registry.specs:
            return policy
        return registry.active_version

    def _validate_model_policy(self, model_policy: str) -> str:
        policy = (model_policy or "").strip().lower()
        if not policy:
            raise AppError(
                code="INVALID_MODEL_POLICY",
                message="Model policy must not be empty.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if policy in DEFAULT_MODEL_POLICIES:
            return policy

        if self.runner_manager is not None and policy in self.runner_manager.registry.specs:
            return policy

        raise AppError(
            code="INVALID_MODEL_POLICY",
            message="Model policy is not supported.",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"model_policy": model_policy},
        )

    def _validate_enhancement_mode(self, enhancement_mode: str) -> str:
        mode = (enhancement_mode or "").strip().lower()
        if mode not in ALLOWED_ENHANCEMENT_MODES:
            raise AppError(
                code="INVALID_ENHANCEMENT_MODE",
                message="Enhancement mode must be one of off, auto, or always.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"enhancement_mode": enhancement_mode},
            )
        return mode

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
            return self._build_bridge_response(session=session, bridge=bridge)

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
        with self.session_factory() as session:
            bridge = session.get(Bridge, bridge_id)
            if bridge is None:
                raise AppError(
                    code="BRIDGE_NOT_FOUND",
                    message="Bridge does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"bridge_id": bridge_id},
                )
            batch_ids = session.scalars(select(InspectionBatch.id).where(InspectionBatch.bridge_id == bridge_id)).all()

        for batch_id in batch_ids:
            self.delete_batch(batch_id)

        with self.session_factory() as session:
            bridge = session.get(Bridge, bridge_id)
            if bridge is None:
                return {"bridge_id": bridge_id, "deleted": True}
            session.delete(bridge)
            session.commit()
        return {"bridge_id": bridge_id, "deleted": True}

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

            batch_code = self._generate_batch_code(session=session, bridge=bridge)
            if payload.batch_code:
                normalized = payload.batch_code.strip()
                if normalized:
                    batch_code = normalized
            existing = session.scalar(select(InspectionBatch).where(InspectionBatch.batch_code == batch_code))
            if existing is not None:
                if payload.batch_code:
                    raise AppError(
                        code="BATCH_CODE_CONFLICT",
                        message="Batch code already exists.",
                        status_code=status.HTTP_409_CONFLICT,
                        details={"batch_code": batch_code},
                    )
                batch_code = self._generate_batch_code(session=session, bridge=bridge, attempt_offset=1)

            batch = InspectionBatch(
                id=_new_id("bat"),
                bridge_id=payload.bridge_id,
                batch_code=batch_code,
                source_type=payload.source_type,
                status="ingesting",
                expected_item_count=payload.expected_item_count,
                created_by=payload.created_by,
                sealed=False,
            )
            session.add(batch)
            session.commit()
            session.refresh(batch)
            return BatchCreateResponse.model_validate(
                self._build_batch_payload(session=session, batch=batch, bridge=bridge, payload=payload)
            )

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
        with self.session_factory() as session:
            batch = session.get(InspectionBatch, batch_id)
            if batch is None:
                raise AppError(
                    code="BATCH_NOT_FOUND",
                    message="Batch does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"batch_id": batch_id},
                )

            item_rows = session.execute(
                select(BatchItem.id, BatchItem.media_asset_id).where(BatchItem.batch_id == batch_id)
            ).all()
            batch_item_ids = [row[0] for row in item_rows]
            media_asset_ids = [row[1] for row in item_rows]

            result_rows = (
                session.execute(
                    select(
                        InferenceResult.id,
                        InferenceResult.json_uri,
                        InferenceResult.overlay_uri,
                        InferenceResult.diagnosis_uri,
                    ).where(InferenceResult.batch_item_id.in_(batch_item_ids))
                ).all()
                if batch_item_ids
                else []
            )
            result_ids = [row[0] for row in result_rows]

            media_rows = (
                session.execute(
                    select(MediaAsset.id, MediaAsset.storage_uri).where(MediaAsset.id.in_(media_asset_ids))
                ).all()
                if media_asset_ids
                else []
            )

            if batch_item_ids:
                session.execute(
                    update(BatchItem)
                    .where(BatchItem.id.in_(batch_item_ids))
                    .values(latest_task_id=None, latest_result_id=None)
                )
                session.execute(delete(ReviewRecord).where(ReviewRecord.batch_item_id.in_(batch_item_ids)))
            session.execute(delete(AlertEvent).where(AlertEvent.batch_id == batch_id))
            if batch_item_ids:
                session.execute(delete(Detection).where(Detection.batch_item_id.in_(batch_item_ids)))
            if result_ids:
                session.execute(delete(InferenceResult).where(InferenceResult.id.in_(result_ids)))
            if batch_item_ids:
                session.execute(delete(InferenceTask).where(InferenceTask.batch_item_id.in_(batch_item_ids)))
                session.execute(delete(BatchItem).where(BatchItem.id.in_(batch_item_ids)))
            session.execute(delete(InspectionBatch).where(InspectionBatch.id == batch_id))

            for media_asset_id, _ in media_rows:
                ref_count = (
                    session.scalar(
                        select(func.count()).select_from(BatchItem).where(BatchItem.media_asset_id == media_asset_id)
                    )
                    or 0
                )
                if ref_count == 0:
                    session.execute(delete(MediaAsset).where(MediaAsset.id == media_asset_id))

            session.commit()

            for _, storage_uri in media_rows:
                if not storage_uri:
                    continue
                upload_path = Path(storage_uri)
                if upload_path.exists():
                    upload_path.unlink(missing_ok=True)

            for _, json_uri, overlay_uri, diagnosis_uri in result_rows:
                for candidate in (json_uri, overlay_uri, diagnosis_uri):
                    if not candidate:
                        continue
                    artifact_path = Path(candidate)
                    if artifact_path.exists():
                        artifact_path.unlink(missing_ok=True)

            return BatchDeleteResponse(batch_id=batch_id)

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
                total_detection_count = (
                    session.scalar(
                        select(func.count())
                        .select_from(Detection)
                        .where(Detection.batch_item_id == detection.batch_item_id)
                    )
                    or 0
                )
                reviewed_detection_count = (
                    session.scalar(
                        select(func.count(func.distinct(ReviewRecord.detection_id)))
                        .select_from(ReviewRecord)
                        .where(ReviewRecord.batch_item_id == detection.batch_item_id)
                    )
                    or 0
                )
                already_reviewed = (
                    session.scalar(
                        select(func.count())
                        .select_from(ReviewRecord)
                        .where(
                            ReviewRecord.batch_item_id == detection.batch_item_id,
                            ReviewRecord.detection_id == detection.id,
                        )
                    )
                    or 0
                )
                projected_reviewed_count = int(reviewed_detection_count) + (0 if already_reviewed else 1)
                if total_detection_count <= 1 or projected_reviewed_count >= total_detection_count:
                    batch_item.review_status = "reviewed"
                else:
                    batch_item.review_status = "partially_reviewed"

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
        if not value:
            return None
        normalized = value.strip().replace("\\", "/")
        if not normalized:
            return None
        parts = [part for part in PurePosixPath(normalized).parts if part not in ("", ".")]
        if not parts or any(part == ".." for part in parts):
            return None
        return "/".join(parts)[:1024]

    def _validate_relative_paths(self, *, files: list[UploadFile], relative_paths: Optional[list[str]]) -> None:
        if relative_paths is None:
            return

        if len(relative_paths) != len(files):
            raise AppError(
                code="RELATIVE_PATH_COUNT_MISMATCH",
                message="relative_paths must match the number of uploaded files.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={"files": len(files), "relative_paths": len(relative_paths)},
            )

        for index, value in enumerate(relative_paths):
            normalized = self._normalize_relative_path(value)
            if normalized is None:
                raise AppError(
                    code="INVALID_RELATIVE_PATH",
                    message="relative_paths contains an invalid or unsafe path.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    details={"index": index, "relative_path": value},
                )

    def _refresh_batch_aggregates(self, *, session: Session, batch_id: str) -> None:
        refresh_batch_aggregates(self, session=session, batch_id=batch_id)

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
        now = datetime.now(timezone.utc)
        payload = dict(base_payload)
        payload.setdefault("repeat_hits", 1)
        payload.setdefault("first_triggered_at", now.isoformat())
        payload["last_triggered_at"] = now.isoformat()
        payload["sla_due_at"] = self._build_sla_due_at_iso(alert_level, now)
        return payload

    def _apply_overdue_alert_escalation(self, *, session: Session) -> None:
        now = datetime.now(timezone.utc)
        alerts = session.scalars(select(AlertEvent).where(AlertEvent.status.in_(["open", "acknowledged"]))).all()
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
