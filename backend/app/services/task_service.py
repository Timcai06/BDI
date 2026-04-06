from __future__ import annotations

import io
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import status
from PIL import Image as PILImage
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.adapters.enhancement_runner import DualBranchEnhanceRunner

from app.adapters.manager import RunnerManager
from app.core.category_mapper import normalize_defect_category
from app.core.errors import AppError
from app.db.models import (
    AlertEvent,
    BatchItem,
    Detection,
    InferenceResult,
    InferenceTask,
    InspectionBatch,
    MediaAsset,
    OpsAuditLog,
    OpsConfig,
)
from app.models.schemas import (
    AlertRulesConfigResponse,
    AlertRulesUpdateRequest,
    OpsAuditLogListResponse,
    OpsAuditLogResponse,
    PredictOptions,
    PredictResponse,
    RawPrediction,
    ResultEnhanceRequest,
    TaskProcessResponse,
    TaskResponse,
    TaskRetryRequest,
    TaskRetryResponse,
)
from app.storage.local import LocalArtifactStore

RETRYABLE_FAILURE_CODES = {
    "MODEL_TIMEOUT",
    "MODEL_RUNTIME_ERROR",
    "MODEL_UNAVAILABLE",
    "TASK_EXECUTION_FAILED",
    "WORKER_LEASE_EXPIRED",
}

ALERT_LEVEL_ORDER = ["low", "medium", "high", "critical"]
ALERT_SLA_HOURS_BY_LEVEL = {
    "low": 72,
    "medium": 48,
    "high": 24,
    "critical": 12,
}

logger = logging.getLogger(__name__)
BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = BACKEND_ROOT.parent


@dataclass
class FailureDecision:
    code: str
    message: str
    retryable: bool


@dataclass
class AutoAlertCandidate:
    event_type: str
    alert_level: str
    title: str
    trigger_payload: dict[str, Any]


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:16]}"


class TaskService:
    ALERT_RULES_CONFIG_KEY = "alert_rules"

    def __init__(
        self,
        *,
        session_factory: sessionmaker[Session],
        store: LocalArtifactStore,
        runner_manager: RunnerManager,
        enhance_runner: Optional[DualBranchEnhanceRunner] = None,
        max_attempts: int = 3,
        task_lease_seconds: int = 300,
        alert_auto_enabled: bool = True,
        alert_count_threshold: int = 3,
        alert_category_watchlist: Optional[list[str]] = None,
        alert_category_confidence_threshold: float = 0.8,
    ) -> None:
        self.session_factory = session_factory
        self.store = store
        self.runner_manager = runner_manager
        self.enhance_runner = enhance_runner
        self.max_attempts = max(1, max_attempts)
        self.task_lease_seconds = max(30, task_lease_seconds)
        self.alert_profile_name = "JTG-v1"
        self.alert_updated_at = datetime.now(timezone.utc)
        self.alert_updated_by: Optional[str] = "system-default"
        self.alert_auto_enabled = alert_auto_enabled
        self.alert_count_threshold = max(1, alert_count_threshold)
        normalized = [normalize_defect_category(item) for item in (alert_category_watchlist or ["seepage"])]
        self.alert_category_watchlist = [item for item in normalized if item]
        self.alert_category_confidence_threshold = max(0.0, min(1.0, alert_category_confidence_threshold))
        self.alert_repeat_escalation_hits = 2
        self.alert_near_due_hours = 2
        self.alert_sla_hours_by_level = dict(ALERT_SLA_HOURS_BY_LEVEL)

    def get_task(self, task_id: str) -> TaskResponse:
        with self.session_factory() as session:
            task = session.get(InferenceTask, task_id)
            if task is None:
                raise AppError(
                    code="TASK_NOT_FOUND",
                    message="Task does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"task_id": task_id},
                )
            return TaskResponse.model_validate(task)

    def recover_stale_tasks(self) -> int:
        stale_task_ids: list[str] = []
        now = datetime.now(timezone.utc)
        with self.session_factory() as session:
            if not hasattr(session, "scalars"):
                return 0
            stale_task_ids = list(
                session.scalars(
                    select(InferenceTask.id)
                    .where(
                        InferenceTask.status == "running",
                        InferenceTask.lease_expires_at.is_not(None),
                        InferenceTask.lease_expires_at < now,
                    )
                    .order_by(InferenceTask.lease_expires_at.asc(), InferenceTask.id.asc())
                ).all()
            )

        recovered = 0
        for task_id in stale_task_ids:
            retry_task_id = self._mark_task_failed(
                task_id,
                decision=FailureDecision(
                    code="WORKER_LEASE_EXPIRED",
                    message="Task lease expired before worker completed the job.",
                    retryable=True,
                ),
                allow_auto_retry=True,
            )
            recovered += 1
            logger.warning("Recovered stale task %s -> retry=%s", task_id, retry_task_id)
        return recovered

    def process_next_queued_task(self) -> TaskProcessResponse:
        recovered_stale_tasks = self.recover_stale_tasks()
        with self.session_factory() as session:
            self._sync_alert_rules_from_db(session=session)
            task = self._claim_next_queued_task(session=session, worker_name="local-worker-1")
            if task is None:
                message = "No queued task found."
                if recovered_stale_tasks > 0:
                    message = f"{message} Recovered stale tasks: {recovered_stale_tasks}"
                return TaskProcessResponse(processed=False, message=message)

            try:
                result_id = self._execute_task(session, task)
                session.commit()
                return TaskProcessResponse(processed=True, task_id=task.id, result_id=result_id)
            except Exception as exc:  # noqa: BLE001
                session.rollback()
                decision = self._classify_failure(exc)
                retry_task_id = self._mark_task_failed(task.id, decision=decision, allow_auto_retry=True)
                message = decision.message
                if retry_task_id is not None:
                    message = f"{message} Retry queued: {retry_task_id}"
                return TaskProcessResponse(processed=False, task_id=task.id, message=message)

    def enhance_result(self, image_id: str, payload: ResultEnhanceRequest) -> PredictResponse:
        if self.enhance_runner is None:
            raise AppError(
                code="ENHANCEMENT_UNAVAILABLE",
                message="Enhancement runtime is unavailable.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                details={"image_id": image_id},
            )

        with self.session_factory() as session:
            result = session.get(InferenceResult, image_id)
            if result is None:
                raise AppError(
                    code="RESULT_NOT_FOUND",
                    message="Result does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"image_id": image_id},
                )

            batch_item = session.get(BatchItem, result.batch_item_id)
            if batch_item is None:
                raise AppError(
                    code="BATCH_ITEM_NOT_FOUND",
                    message="Batch item does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"batch_item_id": result.batch_item_id},
                )

            media_asset = session.get(MediaAsset, batch_item.media_asset_id)
            if media_asset is None:
                raise AppError(
                    code="MEDIA_ASSET_NOT_FOUND",
                    message="Media asset does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"media_asset_id": batch_item.media_asset_id},
                )

            image_path = self._resolve_storage_path(media_asset.storage_uri)
            if not image_path.exists():
                raise AppError(
                    code="MEDIA_FILE_NOT_FOUND",
                    message="Task media file does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"storage_uri": media_asset.storage_uri},
                )

            spec, runner = self.runner_manager.resolve(result.model_version)
            options = PredictOptions(
                model_version=spec.model_version,
                inference_mode=result.inference_mode,
                return_overlay=True,
            )

            image_bytes = image_path.read_bytes()
            original_img = PILImage.open(io.BytesIO(image_bytes))
            enhanced_img = self.enhance_runner.enhance(original_img)
            enhance_meta = self.enhance_runner.describe()

            buf = io.BytesIO()
            enhanced_img.save(buf, format="WEBP", quality=95)
            enhanced_content = buf.getvalue()
            enhanced_uri = self.store.save_enhanced(image_id=batch_item.id, content=enhanced_content)

            secondary_raw = runner.predict(
                image_bytes=enhanced_content,
                image_name=media_asset.original_filename,
                options=options,
            )

            enhanced_overlay_uri = None
            if secondary_raw.overlay_png:
                enhanced_overlay_uri = self.store.save_enhanced_overlay(
                    image_id=batch_item.id,
                    content=secondary_raw.overlay_png,
                )

            payload_path = Path(result.json_uri) if result.json_uri else self.store.result_path(image_id)
            if not payload_path.exists():
                raise AppError(
                    code="RESULT_JSON_NOT_FOUND",
                    message="Result payload does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"image_id": image_id},
                )

            raw_payload = json.loads(payload_path.read_text(encoding="utf-8"))
            created_at = datetime.now(timezone.utc)
            secondary_id = f"{image_id}-enhanced"
            raw_payload.setdefault("artifacts", {})
            raw_payload["artifacts"]["enhanced_path"] = enhanced_uri
            raw_payload["artifacts"]["enhanced_overlay_path"] = enhanced_overlay_uri
            raw_payload["secondary_result"] = {
                "schema_version": raw_payload.get("schema_version", "2.0.0"),
                "image_id": secondary_id,
                "result_variant": "enhanced",
                "inference_ms": secondary_raw.inference_ms,
                "inference_breakdown": secondary_raw.inference_breakdown,
                "model_name": secondary_raw.model_name,
                "model_version": secondary_raw.model_version,
                "backend": secondary_raw.backend,
                "inference_mode": secondary_raw.inference_mode,
                "detections": [
                    {
                        "id": f"{secondary_id}-{index + 1}",
                        "category": item.category,
                        "confidence": item.confidence,
                        "bbox": item.bbox.model_dump(),
                        "mask": item.mask.model_dump() if item.mask is not None else None,
                        "metrics": item.metrics.model_dump(),
                        "source_role": item.source_role,
                        "source_model_name": item.source_model_name,
                        "source_model_version": item.source_model_version,
                    }
                    for index, item in enumerate(secondary_raw.detections)
                ],
                "has_masks": any(item.mask is not None for item in secondary_raw.detections),
                "mask_detection_count": sum(1 for item in secondary_raw.detections if item.mask is not None),
                "enhancement_info": {
                    "algorithm": enhance_meta["algorithm"],
                    "pipeline": enhance_meta["pipeline"],
                    "revised_weights": enhance_meta["revised_weights"],
                    "bridge_weights": enhance_meta["bridge_weights"],
                    "generated_at": created_at.isoformat(),
                },
                "artifacts": {
                    "upload_path": enhanced_uri,
                    "json_path": raw_payload.get("artifacts", {}).get("json_path", ""),
                    "overlay_path": enhanced_overlay_uri,
                },
                "created_at": created_at.isoformat(),
            }
            raw_payload["enhancement_request"] = {
                "requested_by": payload.requested_by,
                "reason": payload.reason,
                "generated_at": created_at.isoformat(),
            }
            payload_path.write_text(json.dumps(raw_payload, ensure_ascii=False, indent=2), encoding="utf-8")
            return PredictResponse.model_validate(raw_payload)

    def retry_task(self, task_id: str, payload: TaskRetryRequest) -> TaskRetryResponse:
        with self.session_factory() as session:
            task = session.get(InferenceTask, task_id)
            if task is None:
                raise AppError(
                    code="TASK_NOT_FOUND",
                    message="Task does not exist.",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"task_id": task_id},
                )
            if task.status != "failed":
                raise AppError(
                    code="TASK_RETRY_NOT_ALLOWED",
                    message="Only failed tasks can be retried.",
                    status_code=status.HTTP_409_CONFLICT,
                    details={"task_id": task_id, "status": task.status},
                )
            if not self._is_retryable_failure_code(task.failure_code):
                raise AppError(
                    code="TASK_RETRY_NOT_ALLOWED",
                    message="This failure type is not retryable.",
                    status_code=status.HTTP_409_CONFLICT,
                    details={"task_id": task_id, "failure_code": task.failure_code},
                )

            next_attempt = self._next_attempt_no(session=session, batch_item_id=task.batch_item_id)
            if next_attempt > self.max_attempts:
                raise AppError(
                    code="TASK_RETRY_NOT_ALLOWED",
                    message="Retry limit reached for this batch item.",
                    status_code=status.HTTP_409_CONFLICT,
                    details={"task_id": task_id, "next_attempt": next_attempt},
                )

            new_task = self._create_retry_task(
                session=session,
                source_task=task,
                attempt_no=next_attempt,
                requested_by=payload.requested_by,
                reason=payload.reason,
            )

            batch_item = session.get(BatchItem, task.batch_item_id)
            if batch_item is not None:
                batch_item.processing_status = "queued"
                batch_item.latest_task_id = new_task.id
                self._refresh_batch_aggregates(session=session, batch_id=batch_item.batch_id)

            session.commit()
            return TaskRetryResponse(old_task_id=task_id, new_task_id=new_task.id, status="queued")

    def get_alert_rule_config(self) -> AlertRulesConfigResponse:
        with self.session_factory() as session:
            self._sync_alert_rules_from_db(session=session)
        return AlertRulesConfigResponse(
            profile_name=self.alert_profile_name,
            alert_auto_enabled=self.alert_auto_enabled,
            count_threshold=self.alert_count_threshold,
            category_watchlist=self.alert_category_watchlist,
            category_confidence_threshold=self.alert_category_confidence_threshold,
            repeat_escalation_hits=self.alert_repeat_escalation_hits,
            sla_hours_by_level=self.alert_sla_hours_by_level,
            near_due_hours=self.alert_near_due_hours,
            updated_at=self.alert_updated_at,
            updated_by=self.alert_updated_by,
        )

    def update_alert_rule_config(self, payload: AlertRulesUpdateRequest) -> AlertRulesConfigResponse:
        with self.session_factory() as session:
            self._sync_alert_rules_from_db(session=session)
            before_payload = self._build_alert_rules_payload()
            if payload.profile_name is not None:
                self.alert_profile_name = payload.profile_name
            if payload.alert_auto_enabled is not None:
                self.alert_auto_enabled = payload.alert_auto_enabled
            if payload.count_threshold is not None:
                self.alert_count_threshold = max(1, int(payload.count_threshold))
            if payload.category_watchlist is not None:
                self.alert_category_watchlist = [item for item in payload.category_watchlist if item]
            if payload.category_confidence_threshold is not None:
                self.alert_category_confidence_threshold = max(0.0, min(1.0, payload.category_confidence_threshold))
            if payload.repeat_escalation_hits is not None:
                self.alert_repeat_escalation_hits = max(2, int(payload.repeat_escalation_hits))
            if payload.sla_hours_by_level is not None:
                merged = dict(self.alert_sla_hours_by_level)
                for level in ALERT_LEVEL_ORDER:
                    if level in payload.sla_hours_by_level:
                        merged[level] = max(1, int(payload.sla_hours_by_level[level]))
                self.alert_sla_hours_by_level = merged
            if payload.near_due_hours is not None:
                self.alert_near_due_hours = max(1, int(payload.near_due_hours))
            self.alert_updated_at = datetime.now(timezone.utc)
            self.alert_updated_by = payload.updated_by
            config = session.get(OpsConfig, self.ALERT_RULES_CONFIG_KEY)
            if config is None:
                config = OpsConfig(config_key=self.ALERT_RULES_CONFIG_KEY)
                session.add(config)
            after_payload = self._build_alert_rules_payload()
            config.config_payload = after_payload
            config.updated_by = payload.updated_by
            session.add(
                OpsAuditLog(
                    id=_new_id("aud"),
                    audit_type="alert_rules_updated",
                    actor=payload.updated_by,
                    target_key=self.ALERT_RULES_CONFIG_KEY,
                    before_payload=before_payload,
                    after_payload=after_payload,
                    diff_payload=self._build_diff_payload(before_payload, after_payload),
                    note=f"profile={after_payload.get('profile_name', 'JTG-v1')}",
                )
            )
            session.commit()
        return self.get_alert_rule_config()

    def list_alert_rule_audit_logs(
        self,
        *,
        limit: int,
        offset: int,
        actor: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> OpsAuditLogListResponse:
        with self.session_factory() as session:
            query = select(OpsAuditLog).where(OpsAuditLog.audit_type == "alert_rules_updated")
            count_query = select(func.count()).select_from(OpsAuditLog).where(
                OpsAuditLog.audit_type == "alert_rules_updated"
            )
            if actor:
                query = query.where(OpsAuditLog.actor == actor)
                count_query = count_query.where(OpsAuditLog.actor == actor)
            if date_from is not None:
                query = query.where(OpsAuditLog.created_at >= date_from)
                count_query = count_query.where(OpsAuditLog.created_at >= date_from)
            if date_to is not None:
                query = query.where(OpsAuditLog.created_at <= date_to)
                count_query = count_query.where(OpsAuditLog.created_at <= date_to)
            total = session.scalar(count_query) or 0
            rows = session.scalars(
                query.order_by(OpsAuditLog.created_at.desc(), OpsAuditLog.id.desc()).offset(offset).limit(limit)
            ).all()
            items = [OpsAuditLogResponse.model_validate(row) for row in rows]
            return OpsAuditLogListResponse(items=items, total=total, limit=limit, offset=offset)

    def _lease_deadline(self, now: Optional[datetime] = None) -> datetime:
        current = now or datetime.now(timezone.utc)
        return current + timedelta(seconds=self.task_lease_seconds)

    def _touch_task_lease(self, task: InferenceTask) -> None:
        now = datetime.now(timezone.utc)
        task.heartbeat_at = now
        task.lease_expires_at = self._lease_deadline(now)

    def _resolve_requested_model_version(self, model_policy: str) -> Optional[str]:
        policy = (model_policy or "").strip().lower()
        registry = self.runner_manager.registry

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

    def _claim_next_queued_task(self, *, session: Session, worker_name: str) -> Optional[InferenceTask]:
        task = session.scalar(
            select(InferenceTask)
            .where(InferenceTask.status == "queued")
            .order_by(InferenceTask.priority.desc(), InferenceTask.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if task is None:
            return None

        now = datetime.now(timezone.utc)
        task.status = "running"
        task.claimed_at = now
        task.started_at = now
        task.heartbeat_at = now
        task.lease_expires_at = now + timedelta(seconds=self.task_lease_seconds)
        task.worker_name = worker_name
        batch_item = session.get(BatchItem, task.batch_item_id)
        if batch_item is not None:
            batch_item.processing_status = "running"
            batch_item.latest_task_id = task.id
            self._refresh_batch_aggregates(session=session, batch_id=batch_item.batch_id)
        session.commit()
        return task

    def _execute_task(self, session: Session, task: InferenceTask) -> str:
        batch_item = session.get(BatchItem, task.batch_item_id)
        if batch_item is None:
            raise AppError(
                code="BATCH_ITEM_NOT_FOUND",
                message="Task batch item does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"batch_item_id": task.batch_item_id},
            )
        media_asset = session.get(MediaAsset, batch_item.media_asset_id)
        if media_asset is None:
            raise AppError(
                code="MEDIA_ASSET_NOT_FOUND",
                message="Task media asset does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"media_asset_id": batch_item.media_asset_id},
            )

        image_path = self._resolve_storage_path(media_asset.storage_uri)
        if not image_path.exists():
            raise AppError(
                code="MEDIA_FILE_NOT_FOUND",
                message="Task media file does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"storage_uri": media_asset.storage_uri},
            )
        self._touch_task_lease(task)
        image_bytes = image_path.read_bytes()
        requested_model_version = task.requested_model_version or self._resolve_requested_model_version(task.model_policy)
        spec, runner = self.runner_manager.resolve(requested_model_version)
        task.requested_model_version = requested_model_version
        task.resolved_model_version = spec.model_version
        runtime_payload = dict(task.runtime_payload or {})
        runtime_payload["resolved_from_policy"] = {
            "model_policy": task.model_policy,
            "requested_model_version": task.requested_model_version,
            "resolved_model_version": spec.model_version,
        }
        task.runtime_payload = runtime_payload

        options = PredictOptions(
            model_version=spec.model_version,
            inference_mode=task.inference_mode,
            return_overlay=True,
        )

        # 1. Track A: Original (Baseline)
        raw = runner.predict(
            image_bytes=image_bytes,
            image_name=media_asset.original_filename,
            options=options,
        )
        self._touch_task_lease(task)

        # 2. Track B: Enhanced (Twin-track)
        secondary_raw = None
        enhanced_uri = None
        enhanced_overlay_uri = None
        
        if task.runtime_payload.get("enhance") and self.enhance_runner:
            try:
                # Image Enhancement
                orig_img = PILImage.open(io.BytesIO(image_bytes))
                enhanced_img = self.enhance_runner.enhance(orig_img)
                enhance_meta = self.enhance_runner.describe()
                
                # Save Enhanced Image
                buf = io.BytesIO()
                enhanced_img.save(buf, format="WEBP", quality=95)
                enhanced_content = buf.getvalue()
                enhanced_uri = self.store.save_enhanced(image_id=batch_item.id, content=enhanced_content)
                
                # Detection on Enhanced Image
                secondary_raw = runner.predict(
                    image_bytes=enhanced_content,
                    image_name=media_asset.original_filename,
                    options=options,
                )
                
                # Save Enhanced Overlay
                if secondary_raw.overlay_png:
                    enhanced_overlay_uri = self.store.save_enhanced_overlay(
                        image_id=batch_item.id,
                        content=secondary_raw.overlay_png
                    )
            except Exception:
                # log and allow Track A to finish
                pass

        result_id = _new_id("res")
        result_created_at = datetime.now(timezone.utc)
        overlay_uri = None
        if raw.overlay_png:
            overlay_uri = self.store.save_overlay(image_id=result_id, content=raw.overlay_png)

        json_payload = self._build_result_json(
            result_id=result_id,
            batch_item_id=batch_item.id,
            raw=raw,
            upload_uri=media_asset.storage_uri,
            overlay_uri=overlay_uri,
            secondary_raw=secondary_raw,
            enhanced_uri=enhanced_uri,
            enhanced_overlay_uri=enhanced_overlay_uri,
            enhancement_meta=enhance_meta if secondary_raw and enhanced_uri else None,
            created_at=result_created_at,
        )
        json_uri = self.store.save_json(image_id=result_id, payload=json_payload)

        result = InferenceResult(
            id=result_id,
            task_id=task.id,
            batch_item_id=batch_item.id,
            schema_version="2.0.0",
            model_name=raw.model_name,
            model_version=raw.model_version,
            backend=raw.backend,
            inference_mode=raw.inference_mode,
            inference_ms=raw.inference_ms + (secondary_raw.inference_ms if secondary_raw else 0),
            inference_breakdown={
                "original": raw.inference_breakdown,
                "enhanced": secondary_raw.inference_breakdown if secondary_raw else None
            },
            detection_count=len(raw.detections),
            has_masks=any(item.mask is not None for item in raw.detections),
            mask_detection_count=sum(1 for item in raw.detections if item.mask is not None),
            overlay_uri=overlay_uri,
            json_uri=json_uri,
            created_at=result_created_at,
        )
        session.add(result)
        # Persist the parent row first so child Detection inserts cannot race
        # ahead of inference_results and trip the FK on result_id.
        session.flush()

        # Merge detections for persistent record (showing main track detections)
        for item in raw.detections:
            session.add(
                Detection(
                    id=_new_id("det"),
                    result_id=result_id,
                    batch_item_id=batch_item.id,
                    category=item.category,
                    confidence=item.confidence,
                    bbox_x=item.bbox.x,
                    bbox_y=item.bbox.y,
                    bbox_width=item.bbox.width,
                    bbox_height=item.bbox.height,
                    mask_payload=item.mask.model_dump() if item.mask is not None else None,
                    length_mm=item.metrics.length_mm,
                    width_mm=item.metrics.width_mm,
                    area_mm2=item.metrics.area_mm2,
                    source_role=item.source_role,
                    source_model_name=item.source_model_name,
                    source_model_version=item.source_model_version,
                )
            )

        # Flush result and detections before inserting dependent alert rows.
        session.flush()

        # Keep alert persistence isolated from result persistence. If alert insert fails
        # (for example FK mismatch from legacy data), result/detection rows should still commit.
        try:
            with session.begin_nested():
                self._emit_auto_alerts(
                    session=session,
                    batch_item=batch_item,
                    result_id=result_id,
                    raw=raw,
                )
                session.flush()
        except Exception as exc:  # pragma: no cover - defensive path for alert side effects
            logger.warning(
                "Auto alert persistence failed but inference result remains valid: batch_item_id=%s result_id=%s error=%s",
                batch_item.id,
                result_id,
                exc,
            )

        batch_item.processing_status = "succeeded"
        batch_item.latest_task_id = task.id
        batch_item.latest_result_id = result_id
        batch_item.defect_count = len(raw.detections)
        batch_item.max_confidence = max((item.confidence for item in raw.detections), default=None)

        task.status = "succeeded"
        task.heartbeat_at = datetime.now(timezone.utc)
        task.lease_expires_at = None
        task.finished_at = datetime.now(timezone.utc)
        task.timing_payload = raw.inference_breakdown

        self._refresh_batch_aggregates(session=session, batch_id=batch_item.batch_id)
        return result_id

    def _resolve_storage_path(self, storage_uri: str) -> Path:
        candidate = Path(storage_uri)
        if candidate.is_absolute():
            return candidate
        # Backward-compatibility for previously persisted relative paths.
        options = [
            Path.cwd() / candidate,
            BACKEND_ROOT / candidate,
            WORKSPACE_ROOT / candidate,
        ]
        for path in options:
            if path.exists():
                return path
        return options[0]

    def _emit_auto_alerts(
        self,
        *,
        session: Session,
        batch_item: BatchItem,
        result_id: str,
        raw: RawPrediction,
    ) -> None:
        if not self.alert_auto_enabled:
            return

        batch = session.get(InspectionBatch, batch_item.batch_id)
        if batch is None:
            return

        candidates = self._build_auto_alert_candidates(raw)
        if not candidates:
            return

        created_count = 0
        for candidate in candidates:
            existing_alert = session.scalar(
                select(AlertEvent)
                .where(
                    AlertEvent.result_id == result_id,
                    AlertEvent.batch_item_id == batch_item.id,
                    AlertEvent.event_type == candidate.event_type,
                    AlertEvent.status.in_(["open", "acknowledged"]),
                )
                .order_by(AlertEvent.triggered_at.desc())
                .limit(1)
            )
            if existing_alert is not None:
                self._apply_repeat_trigger_escalation(existing_alert)
                continue

            session.add(
                AlertEvent(
                    id=_new_id("alt"),
                    bridge_id=batch.bridge_id,
                    batch_id=batch_item.batch_id,
                    batch_item_id=batch_item.id,
                    result_id=result_id,
                    detection_id=None,
                    event_type=candidate.event_type,
                    alert_level=candidate.alert_level,
                    status="open",
                    title=candidate.title,
                    trigger_payload=self._build_alert_trigger_payload(candidate.trigger_payload, candidate.alert_level),
                    triggered_at=datetime.now(timezone.utc),
                )
            )
            created_count += 1

        if created_count > 0:
            batch_item.alert_status = "open"

    def _build_auto_alert_candidates(self, raw: RawPrediction) -> list[AutoAlertCandidate]:
        candidates: list[AutoAlertCandidate] = []
        detection_count = len(raw.detections)

        if detection_count >= self.alert_count_threshold:
            level = "high" if detection_count >= self.alert_count_threshold * 2 else "medium"
            candidates.append(
                AutoAlertCandidate(
                    event_type="count_exceeded",
                    alert_level=level,
                    title="Defect count exceeds threshold",
                    trigger_payload={
                        "count": detection_count,
                        "threshold": self.alert_count_threshold,
                    },
                )
            )

        for category in self.alert_category_watchlist:
            matched = [item for item in raw.detections if normalize_defect_category(item.category) == category]
            if not matched:
                continue
            max_confidence = max(item.confidence for item in matched)
            if max_confidence < self.alert_category_confidence_threshold:
                continue
            candidates.append(
                AutoAlertCandidate(
                    event_type="category_hit",
                    alert_level="high",
                    title="Watchlist category detected",
                    trigger_payload={
                        "category": category,
                        "count": len(matched),
                        "max_confidence": max_confidence,
                        "threshold": self.alert_category_confidence_threshold,
                    },
                )
            )

        return candidates

    def _refresh_batch_aggregates(self, *, session: Session, batch_id: str) -> None:
        batch = session.get(InspectionBatch, batch_id)
        if batch is None:
            return

        status_counts = dict(
            session.execute(
                select(BatchItem.processing_status, func.count())
                .where(BatchItem.batch_id == batch_id)
                .group_by(BatchItem.processing_status)
            ).all()
        )

        batch.received_item_count = sum(status_counts.values())
        batch.queued_item_count = int(status_counts.get("queued", 0))
        batch.running_item_count = int(status_counts.get("running", 0))
        batch.succeeded_item_count = int(status_counts.get("succeeded", 0))
        batch.failed_item_count = int(status_counts.get("failed", 0))

        if batch.received_item_count == 0:
            batch.status = "ingesting"
            batch.started_at = None
            batch.finished_at = None
            return

        if batch.started_at is None:
            batch.started_at = datetime.now(timezone.utc)

        if batch.running_item_count > 0 or batch.queued_item_count > 0:
            batch.status = "running"
            batch.finished_at = None
        elif batch.failed_item_count > 0 and batch.succeeded_item_count > 0:
            batch.status = "partial_failed"
            batch.finished_at = datetime.now(timezone.utc)
        elif batch.failed_item_count > 0 and batch.succeeded_item_count == 0:
            batch.status = "failed"
            batch.finished_at = datetime.now(timezone.utc)
        elif batch.succeeded_item_count > 0:
            batch.status = "completed"
            batch.finished_at = datetime.now(timezone.utc)

    def _mark_task_failed(
        self,
        task_id: str,
        *,
        decision: FailureDecision,
        allow_auto_retry: bool,
    ) -> Optional[str]:
        with self.session_factory() as session:
            task = session.get(InferenceTask, task_id)
            if task is None:
                return None

            task.status = "failed"
            task.finished_at = datetime.now(timezone.utc)
            task.heartbeat_at = datetime.now(timezone.utc)
            task.lease_expires_at = None
            task.failure_code = decision.code
            task.failure_message = decision.message[:2000]

            batch_item = session.get(BatchItem, task.batch_item_id)
            retry_task_id: Optional[str] = None

            if batch_item is not None:
                batch_item.processing_status = "failed"

                if allow_auto_retry and decision.retryable:
                    next_attempt = self._next_attempt_no(session=session, batch_item_id=task.batch_item_id)
                    if next_attempt <= self.max_attempts:
                        retry_task = self._create_retry_task(
                            session=session,
                            source_task=task,
                            attempt_no=next_attempt,
                            requested_by="system-worker",
                            reason=f"auto-retry after {decision.code}",
                        )
                        retry_task_id = retry_task.id
                        batch_item.processing_status = "queued"
                        batch_item.latest_task_id = retry_task.id

                self._refresh_batch_aggregates(session=session, batch_id=batch_item.batch_id)

            session.commit()
            return retry_task_id

    def _next_attempt_no(self, *, session: Session, batch_item_id: str) -> int:
        max_attempt = session.scalar(
            select(func.coalesce(func.max(InferenceTask.attempt_no), 0)).where(
                InferenceTask.batch_item_id == batch_item_id
            )
        ) or 0
        return int(max_attempt) + 1

    def _create_retry_task(
        self,
        *,
        session: Session,
        source_task: InferenceTask,
        attempt_no: int,
        requested_by: str,
        reason: Optional[str],
    ) -> InferenceTask:
        new_task = InferenceTask(
            id=_new_id("tsk"),
            batch_item_id=source_task.batch_item_id,
            task_type=source_task.task_type,
            status="queued",
            attempt_no=attempt_no,
            priority=source_task.priority,
            model_policy=source_task.model_policy,
            requested_model_version=source_task.requested_model_version,
            resolved_model_version=None,
            inference_mode=source_task.inference_mode,
            queued_at=datetime.now(timezone.utc),
            runtime_payload={
                "retry": {
                    "requested_by": requested_by,
                    "reason": reason,
                    "from_task_id": source_task.id,
                }
            },
        )
        session.add(new_task)
        session.flush()
        return new_task

    @staticmethod
    def _classify_failure(exc: Exception) -> FailureDecision:
        if isinstance(exc, AppError):
            code = exc.code
            return FailureDecision(code=code, message=exc.message, retryable=TaskService._is_retryable_failure_code(code))

        if isinstance(exc, TimeoutError):
            return FailureDecision(
                code="MODEL_TIMEOUT",
                message="Model inference timed out.",
                retryable=True,
            )

        return FailureDecision(
            code="TASK_EXECUTION_FAILED",
            message=str(exc)[:2000] or "Task execution failed.",
            retryable=True,
        )

    @staticmethod
    def _is_retryable_failure_code(code: Optional[str]) -> bool:
        if code is None:
            return False
        return code in RETRYABLE_FAILURE_CODES

    def _apply_repeat_trigger_escalation(self, alert: AlertEvent) -> None:
        now = datetime.now(timezone.utc)
        payload = dict(alert.trigger_payload or {})
        repeat_hits = int(payload.get("repeat_hits", 1)) + 1
        payload["repeat_hits"] = repeat_hits
        payload["last_triggered_at"] = now.isoformat()
        if repeat_hits >= self.alert_repeat_escalation_hits:
            next_level = self._next_alert_level(alert.alert_level)
            if next_level != alert.alert_level:
                alert.alert_level = next_level
                payload["repeat_escalated_at"] = now.isoformat()
                payload["sla_due_at"] = self._build_sla_due_at_iso(next_level, now)
        alert.trigger_payload = payload
        alert.updated_at = now

    def _build_alert_trigger_payload(self, base_payload: dict[str, Any], alert_level: str) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        payload = dict(base_payload)
        payload.setdefault("repeat_hits", 1)
        payload.setdefault("first_triggered_at", now.isoformat())
        payload["last_triggered_at"] = now.isoformat()
        payload["sla_due_at"] = self._build_sla_due_at_iso(alert_level, now)
        return payload

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

    def _sync_alert_rules_from_db(self, *, session: Session) -> None:
        try:
            config = session.get(OpsConfig, self.ALERT_RULES_CONFIG_KEY)
        except Exception:
            return
        if config is None or not isinstance(config.config_payload, dict):
            return
        payload = config.config_payload
        self.alert_profile_name = str(payload.get("profile_name", self.alert_profile_name))
        self.alert_auto_enabled = bool(payload.get("alert_auto_enabled", self.alert_auto_enabled))
        self.alert_count_threshold = max(1, int(payload.get("count_threshold", self.alert_count_threshold)))
        watchlist = payload.get("category_watchlist", self.alert_category_watchlist)
        if isinstance(watchlist, list):
            normalized = [normalize_defect_category(str(item)) for item in watchlist if str(item).strip()]
            if normalized:
                self.alert_category_watchlist = normalized
        self.alert_category_confidence_threshold = max(
            0.0,
            min(1.0, float(payload.get("category_confidence_threshold", self.alert_category_confidence_threshold))),
        )
        self.alert_repeat_escalation_hits = max(
            2,
            int(payload.get("repeat_escalation_hits", self.alert_repeat_escalation_hits)),
        )
        self.alert_near_due_hours = max(1, int(payload.get("near_due_hours", self.alert_near_due_hours)))
        sla = payload.get("sla_hours_by_level")
        if isinstance(sla, dict):
            merged = dict(self.alert_sla_hours_by_level)
            for level in ALERT_LEVEL_ORDER:
                value = sla.get(level)
                if value is not None:
                    merged[level] = max(1, int(value))
            self.alert_sla_hours_by_level = merged
        updated_by = config.updated_by
        if updated_by is not None:
            self.alert_updated_by = updated_by
        self.alert_updated_at = config.updated_at

    def _build_alert_rules_payload(self) -> dict[str, Any]:
        return {
            "profile_name": self.alert_profile_name,
            "alert_auto_enabled": self.alert_auto_enabled,
            "count_threshold": self.alert_count_threshold,
            "category_watchlist": self.alert_category_watchlist,
            "category_confidence_threshold": self.alert_category_confidence_threshold,
            "repeat_escalation_hits": self.alert_repeat_escalation_hits,
            "sla_hours_by_level": self.alert_sla_hours_by_level,
            "near_due_hours": self.alert_near_due_hours,
        }

    @staticmethod
    def _build_diff_payload(before_payload: dict[str, Any], after_payload: dict[str, Any]) -> dict[str, Any]:
        diff: dict[str, Any] = {}
        keys = set(before_payload.keys()) | set(after_payload.keys())
        for key in sorted(keys):
            before_value = before_payload.get(key)
            after_value = after_payload.get(key)
            if before_value != after_value:
                diff[key] = {"before": before_value, "after": after_value}
        return diff

    def _build_result_json(
        self,
        *,
        result_id: str,
        batch_item_id: str,
        raw: RawPrediction,
        upload_uri: Optional[str] = None,
        overlay_uri: Optional[str] = None,
        secondary_raw: Optional[RawPrediction] = None,
        enhanced_uri: Optional[str] = None,
        enhanced_overlay_uri: Optional[str] = None,
        enhancement_meta: Optional[dict[str, str]] = None,
        created_at: Optional[datetime] = None,
    ) -> dict[str, Any]:
        def _map_detections(r_id: str, d_items: list):
            res = []
            for index, item in enumerate(d_items):
                res.append({
                    "id": f"{r_id}-{index + 1}",
                    "category": item.category,
                    "confidence": item.confidence,
                    "bbox": item.bbox.model_dump(),
                    "mask": item.mask.model_dump() if item.mask is not None else None,
                    "metrics": item.metrics.model_dump(),
                    "source_role": item.source_role,
                    "source_model_name": item.source_model_name,
                    "source_model_version": item.source_model_version,
                })
            return res

        payload = {
            "schema_version": "2.0.0",
            "image_id": result_id,
            "batch_item_id": batch_item_id,
            "result_variant": "original",
            "model_name": raw.model_name,
            "model_version": raw.model_version,
            "backend": raw.backend,
            "inference_mode": raw.inference_mode,
            "inference_ms": raw.inference_ms,
            "inference_breakdown": raw.inference_breakdown,
            "detections": _map_detections(result_id, raw.detections),
            "has_masks": any(item.mask is not None for item in raw.detections),
            "mask_detection_count": sum(1 for item in raw.detections if item.mask is not None),
            "created_at": (created_at or datetime.now(timezone.utc)).isoformat(),
            "artifacts": {
                "upload_path": upload_uri or "",
                "json_path": "",
                "overlay_path": overlay_uri,
                "enhanced_path": enhanced_uri,
                "enhanced_overlay_path": enhanced_overlay_uri,
            }
        }
        
        if secondary_raw:
            secondary_id = f"{result_id}-enhanced"
            payload["secondary_result"] = {
                "image_id": secondary_id,
                "result_variant": "enhanced",
                "inference_ms": secondary_raw.inference_ms,
                "inference_breakdown": secondary_raw.inference_breakdown,
                "model_name": secondary_raw.model_name,
                "model_version": secondary_raw.model_version,
                "backend": secondary_raw.backend,
                "inference_mode": secondary_raw.inference_mode,
                "detections": _map_detections(secondary_id, secondary_raw.detections),
                "has_masks": any(item.mask is not None for item in secondary_raw.detections),
                "mask_detection_count": sum(1 for item in secondary_raw.detections if item.mask is not None),
                "created_at": (created_at or datetime.now(timezone.utc)).isoformat(),
                "enhancement_info": {
                    "algorithm": enhancement_meta["algorithm"],
                    "pipeline": enhancement_meta["pipeline"],
                    "revised_weights": enhancement_meta["revised_weights"],
                    "bridge_weights": enhancement_meta["bridge_weights"],
                    "generated_at": (created_at or datetime.now(timezone.utc)).isoformat(),
                } if enhancement_meta is not None else None,
                "artifacts": {
                    "upload_path": enhanced_uri or "",
                    "json_path": "",
                    "overlay_path": enhanced_overlay_uri,
                }
            }

        return payload
