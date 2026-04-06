from __future__ import annotations

import hashlib
import io
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Optional
from uuid import uuid4

from fastapi import UploadFile, status
from PIL import Image as PILImage
from PIL import ImageStat
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
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
    BatchIngestItemSuccess,
    BatchIngestResponse,
    BatchItemDetailResponse,
    BatchItemListResponse,
    BatchItemResponse,
    BatchItemResultResponse,
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
    PredictResponse,
    ResultDetectionResponse,
    ReviewCreateRequest,
    ReviewListResponse,
    ReviewRecordResponse,
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
            rows = session.execute(query.order_by(BatchItem.sequence_no.asc()).offset(offset).limit(limit)).all()
            items: list[BatchItemResponse] = []
            for batch_item, media_asset in rows:
                latest_task = (
                    session.get(InferenceTask, batch_item.latest_task_id) if batch_item.latest_task_id else None
                )
                item_payload = BatchItemResponse.model_validate(batch_item).model_dump()
                item_payload["original_filename"] = media_asset.original_filename
                item_payload["source_device"] = media_asset.source_device
                item_payload["source_relative_path"] = media_asset.source_relative_path
                item_payload["latest_task_status"] = latest_task.status if latest_task is not None else None
                item_payload["latest_task_attempt_no"] = latest_task.attempt_no if latest_task is not None else None
                item_payload["latest_failure_code"] = latest_task.failure_code if latest_task is not None else None
                item_payload["latest_failure_message"] = (
                    latest_task.failure_message if latest_task is not None else None
                )
                item_payload["model_policy"] = latest_task.model_policy if latest_task is not None else None
                item_payload["requested_model_version"] = (
                    latest_task.requested_model_version if latest_task is not None else None
                )
                item_payload["resolved_model_version"] = (
                    latest_task.resolved_model_version if latest_task is not None else None
                )
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
                select(InferenceTask).where(
                    InferenceTask.created_at >= datetime.fromtimestamp(window_start, timezone.utc)
                )
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
                recovered_stale_tasks=int(failure_code_breakdown.get("WORKER_LEASE_EXPIRED", 0)),
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
            latest_task = session.get(InferenceTask, batch_item.latest_task_id) if batch_item.latest_task_id else None
            item_payload = BatchItemResponse.model_validate(batch_item).model_dump()
            item_payload["original_filename"] = media_asset.original_filename
            item_payload["source_device"] = media_asset.source_device
            item_payload["source_relative_path"] = media_asset.source_relative_path
            item_payload["latest_task_status"] = latest_task.status if latest_task is not None else None
            item_payload["latest_task_attempt_no"] = latest_task.attempt_no if latest_task is not None else None
            item_payload["latest_failure_code"] = latest_task.failure_code if latest_task is not None else None
            item_payload["latest_failure_message"] = latest_task.failure_message if latest_task is not None else None
            item_payload["model_policy"] = latest_task.model_policy if latest_task is not None else None
            item_payload["requested_model_version"] = (
                latest_task.requested_model_version if latest_task is not None else None
            )
            item_payload["resolved_model_version"] = (
                latest_task.resolved_model_version if latest_task is not None else None
            )
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
                select(Detection).where(Detection.result_id == result.id).order_by(Detection.created_at.asc())
            ).all()
            enhanced_path: Optional[str] = None
            enhanced_overlay_path: Optional[str] = None
            secondary_result: Optional[PredictResponse] = None

            if result.json_uri:
                try:
                    payload = json.loads(Path(result.json_uri).read_text(encoding="utf-8"))
                    artifacts = payload.get("artifacts")
                    if isinstance(artifacts, dict):
                        raw_enhanced_path = artifacts.get("enhanced_path")
                        raw_enhanced_overlay_path = artifacts.get("enhanced_overlay_path")
                        if isinstance(raw_enhanced_path, str):
                            enhanced_path = raw_enhanced_path or None
                        if isinstance(raw_enhanced_overlay_path, str):
                            enhanced_overlay_path = raw_enhanced_overlay_path or None
                    raw_secondary = payload.get("secondary_result")
                    if isinstance(raw_secondary, dict):
                        secondary_result = PredictResponse.model_validate(raw_secondary)
                except Exception:
                    secondary_result = None

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
                enhanced_path=enhanced_path,
                enhanced_overlay_path=enhanced_overlay_path,
                secondary_result=secondary_result,
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
                query = query.join(BatchItem, BatchItem.id == Detection.batch_item_id).where(
                    BatchItem.batch_id == batch_id
                )
                count_query = count_query.join(BatchItem, BatchItem.id == Detection.batch_item_id).where(
                    BatchItem.batch_id == batch_id
                )
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
        with self.session_factory() as session:
            query = select(ReviewRecord)
            count_query = select(func.count()).select_from(ReviewRecord)
            if batch_id is not None:
                query = query.join(BatchItem, BatchItem.id == ReviewRecord.batch_item_id).where(
                    BatchItem.batch_id == batch_id
                )
                count_query = count_query.join(BatchItem, BatchItem.id == ReviewRecord.batch_item_id).where(
                    BatchItem.batch_id == batch_id
                )
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
        enhancement_mode: str,
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

            current_sequence = (
                session.scalar(
                    select(func.coalesce(func.max(BatchItem.sequence_no), 0)).where(BatchItem.batch_id == batch_id)
                )
                or 0
            )

            accepted: list[BatchIngestItemSuccess] = []
            errors: list[BatchIngestItemError] = []
            model_policy_value = model_policy.strip() or "fusion-default"
            requested_model_version = self._resolve_requested_model_version(model_policy_value)

            for index, file in enumerate(files):
                ok, error = await self._validate_upload(file)
                if not ok:
                    if error is not None:
                        errors.append(error)
                    continue
                media_asset_id = _new_id("med")
                batch_item_id = _new_id("bit")
                task_id = _new_id("tsk")
                storage_saved = False

                try:
                    content = await self._read_upload_content(file)
                    enhance_enabled = self._should_enable_enhancement(
                        content=content,
                        enhancement_mode=enhancement_mode,
                    )
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

                    next_sequence = current_sequence + 1
                    source_relative_path = self._normalize_relative_path(
                        relative_paths[index] if relative_paths and index < len(relative_paths) else None
                    )
                    self.store.save_upload(image_id=media_asset_id, content=content)
                    storage_saved = True

                    with session.begin_nested():
                        media_asset = MediaAsset(
                            id=media_asset_id,
                            media_type="image",
                            original_filename=file.filename or media_asset_id,
                            storage_uri=str(self.store.upload_path(media_asset_id)),
                            sha256=file_hash,
                            mime_type=file.content_type or "application/octet-stream",
                            file_size_bytes=len(content),
                            captured_at=captured_at,
                            source_device=source_device,
                            source_relative_path=source_relative_path,
                        )
                        session.add(media_asset)
                        session.flush()

                        batch_item = BatchItem(
                            id=batch_item_id,
                            batch_id=batch_id,
                            media_asset_id=media_asset_id,
                            sequence_no=next_sequence,
                            processing_status="queued",
                        )
                        task = InferenceTask(
                            id=task_id,
                            batch_item_id=batch_item_id,
                            status="queued",
                            model_policy=model_policy_value,
                            requested_model_version=requested_model_version,
                            queued_at=datetime.now(timezone.utc),
                            runtime_payload={
                                "enhance": enhance_enabled,
                                "enhancement_mode": enhancement_mode,
                            },
                        )
                        session.add(batch_item)
                        session.add(task)
                        session.flush()
                        batch_item.latest_task_id = task_id

                    accepted.append(
                        BatchIngestItemSuccess(
                            batch_item_id=batch_item_id,
                            media_asset_id=media_asset_id,
                            original_filename=file.filename or media_asset_id,
                            source_relative_path=source_relative_path,
                            processing_status="queued",
                            task_id=task_id,
                            model_policy=model_policy_value,
                            requested_model_version=requested_model_version,
                        )
                    )
                    current_sequence = next_sequence
                except AppError as exc:
                    if storage_saved:
                        self.store.delete_upload(media_asset_id)
                    errors.append(
                        BatchIngestItemError(
                            filename=file.filename or "",
                            code=exc.code,
                            message=exc.message,
                        )
                    )
                    continue
                except IntegrityError:
                    if storage_saved:
                        self.store.delete_upload(media_asset_id)
                    errors.append(
                        BatchIngestItemError(
                            filename=file.filename or "",
                            code="MEDIA_DUPLICATED",
                            message="Image already exists in this batch.",
                        )
                    )
                    continue

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
