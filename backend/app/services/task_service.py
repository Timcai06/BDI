from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.adapters.enhancement_runner import DualBranchEnhanceRunner
from app.adapters.manager import RunnerManager
from app.core.category_mapper import normalize_defect_category
from app.core.errors import AppError
from app.core.constants import ALERT_SLA_HOURS_BY_LEVEL, SCHEMA_VERSION, next_alert_level as next_alert_level_via_service
from app.core.utils import new_id, resolve_path
from app.services.batch_validation_service import resolve_requested_model_version
from app.db.models import AlertEvent, BatchItem, InferenceTask
from app.models.schemas import (
    PredictResponse,
    RawPrediction,
    ResultEnhanceRequest,
    TaskProcessResponse,
    TaskResponse,
    TaskRetryRequest,
    TaskRetryResponse,
)
from app.services.batch_aggregate_service import refresh_batch_aggregates
from app.services.task_alert_service import (
    apply_repeat_trigger_escalation as apply_repeat_trigger_escalation_via_service,
)
from app.services.task_alert_service import (
    build_alert_rules_payload as build_alert_rules_payload_via_service,
)
from app.services.task_alert_service import (
    build_alert_trigger_payload as build_alert_trigger_payload_via_service,
)
from app.services.task_alert_service import (
    build_auto_alert_candidates as build_auto_alert_candidates_via_service,
)
from app.services.task_alert_service import (
    build_diff_payload as build_diff_payload_via_service,
)
from app.services.task_alert_service import (
    build_sla_due_at_iso as build_sla_due_at_iso_via_service,
)
from app.services.task_alert_service import (
    emit_auto_alerts as emit_auto_alerts_via_service,
)
from app.services.task_alert_service import (
    get_alert_rule_config as get_alert_rule_config_via_service,
)
from app.services.task_alert_service import (
    list_alert_rule_audit_logs as list_alert_rule_audit_logs_via_service,
)
from app.services.task_alert_service import (
    sync_alert_rules_from_db as sync_alert_rules_from_db_via_service,
)
from app.services.task_alert_service import (
    update_alert_rule_config as update_alert_rule_config_via_service,
)
from app.services.task_enhancement_service import enhance_result as enhance_result_via_service
from app.services.task_execution_service import execute_task as execute_task_via_service
from app.services.task_retry_service import (
    classify_failure as classify_failure_via_service,
)
from app.services.task_retry_service import (
    create_retry_task as create_retry_task_via_service,
)
from app.services.task_retry_service import (
    is_retryable_failure_code as is_retryable_failure_code_via_service,
)
from app.services.task_retry_service import (
    mark_task_failed as mark_task_failed_via_service,
)
from app.services.task_retry_service import (
    next_attempt_no as next_attempt_no_via_service,
)
from app.services.task_retry_service import (
    process_next_queued_task as process_next_queued_task_via_service,
)
from app.services.task_retry_service import (
    recover_stale_tasks as recover_stale_tasks_via_service,
)
from app.services.task_retry_service import (
    retry_task as retry_task_via_service,
)
from app.storage.local import LocalArtifactStore


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


class TaskService:
    ALERT_RULES_CONFIG_KEY = "alert_rules"
    failure_decision_class = FailureDecision
    auto_alert_candidate_class = AutoAlertCandidate
    normalize_category = staticmethod(normalize_defect_category)

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

    @staticmethod
    def _new_id(prefix: str) -> str:
        return new_id(prefix)

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
        return recover_stale_tasks_via_service(self)

    def process_next_queued_task(self) -> TaskProcessResponse:
        return process_next_queued_task_via_service(self)

    def enhance_result(self, image_id: str, payload: ResultEnhanceRequest) -> PredictResponse:
        return enhance_result_via_service(self, image_id, payload)

    def retry_task(self, task_id: str, payload: TaskRetryRequest) -> TaskRetryResponse:
        return retry_task_via_service(self, task_id, payload)

    def get_alert_rule_config(self):
        return get_alert_rule_config_via_service(self)

    def update_alert_rule_config(self, payload):
        return update_alert_rule_config_via_service(self, payload)

    def list_alert_rule_audit_logs(
        self,
        *,
        limit: int,
        offset: int,
        actor: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ):
        return list_alert_rule_audit_logs_via_service(
            self,
            limit=limit,
            offset=offset,
            actor=actor,
            date_from=date_from,
            date_to=date_to,
        )

    def _lease_deadline(self, now: Optional[datetime] = None) -> datetime:
        current = now or datetime.now(timezone.utc)
        return current + timedelta(seconds=self.task_lease_seconds)

    def _touch_task_lease(self, task: InferenceTask) -> None:
        now = datetime.now(timezone.utc)
        task.heartbeat_at = now
        task.lease_expires_at = self._lease_deadline(now)

    def _resolve_requested_model_version(self, model_policy: str) -> Optional[str]:
        return resolve_requested_model_version(self, model_policy)

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
        return execute_task_via_service(self, session, task)

    def _resolve_storage_path(self, storage_uri: str) -> Path:
        result = resolve_path(storage_uri, fallback=True)
        assert result is not None
        return result

    def _emit_auto_alerts(
        self,
        *,
        session: Session,
        batch_item: BatchItem,
        result_id: str,
        raw: RawPrediction,
    ) -> None:
        emit_auto_alerts_via_service(self, session=session, batch_item=batch_item, result_id=result_id, raw=raw)

    def _build_auto_alert_candidates(self, raw: RawPrediction) -> list[AutoAlertCandidate]:
        return build_auto_alert_candidates_via_service(self, raw)

    def _refresh_batch_aggregates(self, *, session: Session, batch_id: str) -> None:
        refresh_batch_aggregates(self, session=session, batch_id=batch_id)

    def _mark_task_failed(
        self,
        task_id: str,
        *,
        decision: FailureDecision,
        allow_auto_retry: bool,
    ) -> Optional[str]:
        return mark_task_failed_via_service(
            self,
            task_id,
            decision=decision,
            allow_auto_retry=allow_auto_retry,
        )

    def _next_attempt_no(self, *, session: Session, batch_item_id: str) -> int:
        return next_attempt_no_via_service(session=session, batch_item_id=batch_item_id)

    def _create_retry_task(
        self,
        *,
        session: Session,
        source_task: InferenceTask,
        attempt_no: int,
        requested_by: str,
        reason: Optional[str],
    ) -> InferenceTask:
        return create_retry_task_via_service(
            self,
            session=session,
            source_task=source_task,
            attempt_no=attempt_no,
            requested_by=requested_by,
            reason=reason,
        )

    @staticmethod
    def _classify_failure(exc: Exception) -> FailureDecision:
        return classify_failure_via_service(TaskService, exc)

    @staticmethod
    def _is_retryable_failure_code(code: Optional[str]) -> bool:
        return is_retryable_failure_code_via_service(code)

    def _apply_repeat_trigger_escalation(self, alert: AlertEvent) -> None:
        apply_repeat_trigger_escalation_via_service(self, alert)

    def _build_alert_trigger_payload(self, base_payload: dict[str, Any], alert_level: str) -> dict[str, Any]:
        return build_alert_trigger_payload_via_service(self, base_payload, alert_level)

    @staticmethod
    def _next_alert_level(level: str) -> str:
        return next_alert_level_via_service(level)

    def _build_sla_due_at_iso(self, level: str, start_at: datetime) -> str:
        return build_sla_due_at_iso_via_service(self, level, start_at)

    def _sync_alert_rules_from_db(self, *, session: Session) -> None:
        sync_alert_rules_from_db_via_service(self, session=session)

    def _build_alert_rules_payload(self) -> dict[str, Any]:
        return build_alert_rules_payload_via_service(self)

    @staticmethod
    def _build_diff_payload(before_payload: dict[str, Any], after_payload: dict[str, Any]) -> dict[str, Any]:
        return build_diff_payload_via_service(before_payload, after_payload)

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
                res.append(
                    {
                        "id": f"{r_id}-{index + 1}",
                        "category": item.category,
                        "confidence": item.confidence,
                        "bbox": item.bbox.model_dump(),
                        "mask": item.mask.model_dump() if item.mask is not None else None,
                        "metrics": item.metrics.model_dump(),
                        "source_role": item.source_role,
                        "source_model_name": item.source_model_name,
                        "source_model_version": item.source_model_version,
                    }
                )
            return res

        payload = {
            "schema_version": SCHEMA_VERSION,
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
            },
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
                }
                if enhancement_meta is not None
                else None,
                "artifacts": {
                    "upload_path": enhanced_uri or "",
                    "json_path": "",
                    "overlay_path": enhanced_overlay_uri,
                },
            }

        return payload
