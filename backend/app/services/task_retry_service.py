from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import BatchItem, InferenceTask
from app.models.schemas import TaskProcessResponse, TaskRetryRequest, TaskRetryResponse

RETRYABLE_FAILURE_CODES = {
    "MODEL_TIMEOUT",
    "MODEL_RUNTIME_ERROR",
    "MODEL_UNAVAILABLE",
    "TASK_EXECUTION_FAILED",
    "WORKER_LEASE_EXPIRED",
}

logger = logging.getLogger(__name__)


def recover_stale_tasks(service: Any) -> int:
    stale_task_ids: list[str] = []
    now = datetime.now(timezone.utc)
    with service.session_factory() as session:
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
        retry_task_id = service._mark_task_failed(
            task_id,
            decision=service.failure_decision_class(
                code="WORKER_LEASE_EXPIRED",
                message="Task lease expired before worker completed the job.",
                retryable=True,
            ),
            allow_auto_retry=True,
        )
        recovered += 1
        logger.warning("Recovered stale task %s -> retry=%s", task_id, retry_task_id)
    return recovered


def process_next_queued_task(service: Any) -> TaskProcessResponse:
    recovered_stale_tasks = service.recover_stale_tasks()
    with service.session_factory() as session:
        service._sync_alert_rules_from_db(session=session)
        task = service._claim_next_queued_task(session=session, worker_name="local-worker-1")
        if task is None:
            message = "No queued task found."
            if recovered_stale_tasks > 0:
                message = f"{message} Recovered stale tasks: {recovered_stale_tasks}"
            return TaskProcessResponse(processed=False, message=message)

        try:
            result_id = service._execute_task(session, task)
            session.commit()
            return TaskProcessResponse(processed=True, task_id=task.id, result_id=result_id)
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            decision = service._classify_failure(exc)
            retry_task_id = service._mark_task_failed(task.id, decision=decision, allow_auto_retry=True)
            message = decision.message
            if retry_task_id is not None:
                message = f"{message} Retry queued: {retry_task_id}"
            return TaskProcessResponse(processed=False, task_id=task.id, message=message)


def retry_task(service: Any, task_id: str, payload: TaskRetryRequest) -> TaskRetryResponse:
    with service.session_factory() as session:
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
        if not service._is_retryable_failure_code(task.failure_code):
            raise AppError(
                code="TASK_RETRY_NOT_ALLOWED",
                message="This failure type is not retryable.",
                status_code=status.HTTP_409_CONFLICT,
                details={"task_id": task_id, "failure_code": task.failure_code},
            )

        next_attempt = service._next_attempt_no(session=session, batch_item_id=task.batch_item_id)
        if next_attempt > service.max_attempts:
            raise AppError(
                code="TASK_RETRY_NOT_ALLOWED",
                message="Retry limit reached for this batch item.",
                status_code=status.HTTP_409_CONFLICT,
                details={"task_id": task_id, "next_attempt": next_attempt},
            )

        new_task = service._create_retry_task(
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
            service._refresh_batch_aggregates(session=session, batch_id=batch_item.batch_id)

        session.commit()
        return TaskRetryResponse(old_task_id=task_id, new_task_id=new_task.id, status="queued")


def mark_task_failed(
    service: Any,
    task_id: str,
    *,
    decision: Any,
    allow_auto_retry: bool,
) -> Optional[str]:
    with service.session_factory() as session:
        task = session.get(InferenceTask, task_id)
        if task is None:
            return None

        now = datetime.now(timezone.utc)
        task.status = "failed"
        task.finished_at = now
        task.heartbeat_at = now
        task.lease_expires_at = None
        task.failure_code = decision.code
        task.failure_message = decision.message[:2000]

        batch_item = session.get(BatchItem, task.batch_item_id)
        retry_task_id: Optional[str] = None

        if batch_item is not None:
            batch_item.processing_status = "failed"

            if allow_auto_retry and decision.retryable:
                next_attempt = service._next_attempt_no(session=session, batch_item_id=task.batch_item_id)
                if next_attempt <= service.max_attempts:
                    retry_task = service._create_retry_task(
                        session=session,
                        source_task=task,
                        attempt_no=next_attempt,
                        requested_by="system-worker",
                        reason=f"auto-retry after {decision.code}",
                    )
                    retry_task_id = retry_task.id
                    batch_item.processing_status = "queued"
                    batch_item.latest_task_id = retry_task.id

            service._refresh_batch_aggregates(session=session, batch_id=batch_item.batch_id)

        session.commit()
        return retry_task_id


def next_attempt_no(*, session: Session, batch_item_id: str) -> int:
    max_attempt = (
        session.scalar(
            select(func.coalesce(func.max(InferenceTask.attempt_no), 0)).where(
                InferenceTask.batch_item_id == batch_item_id
            )
        )
        or 0
    )
    return int(max_attempt) + 1


def create_retry_task(
    service: Any,
    *,
    session: Session,
    source_task: InferenceTask,
    attempt_no: int,
    requested_by: str,
    reason: Optional[str],
) -> InferenceTask:
    new_task = InferenceTask(
        id=service._new_id("tsk"),
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


def classify_failure(service: Any, exc: Exception) -> Any:
    if isinstance(exc, AppError):
        code = exc.code
        return service.failure_decision_class(
            code=code,
            message=exc.message,
            retryable=is_retryable_failure_code(code),
        )

    if isinstance(exc, TimeoutError):
        return service.failure_decision_class(
            code="MODEL_TIMEOUT",
            message="Model inference timed out.",
            retryable=True,
        )

    return service.failure_decision_class(
        code="TASK_EXECUTION_FAILED",
        message=str(exc)[:2000] or "Task execution failed.",
        retryable=True,
    )


def is_retryable_failure_code(code: Optional[str]) -> bool:
    if code is None:
        return False
    return code in RETRYABLE_FAILURE_CODES
