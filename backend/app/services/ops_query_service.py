from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import status
from sqlalchemy import func, select

from app.core.errors import AppError
from app.services.protocols import BatchServiceLike
from app.db.models import AlertEvent, BatchItem, Detection, InferenceTask, InspectionBatch, ReviewRecord
from app.models.schemas import (
    AlertListResponse,
    AlertResponse,
    BatchStatsResponse,
    DetectionListResponse,
    DetectionRecordResponse,
    OpsMetricsResponse,
    ReviewListResponse,
    ReviewRecordResponse,
)


def get_batch_stats(service: BatchServiceLike, *, batch_id: str) -> BatchStatsResponse:
    with service.session_factory() as session:
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


def get_ops_metrics(service: BatchServiceLike, *, window_hours: int) -> OpsMetricsResponse:
    hours = max(1, window_hours)
    now = datetime.now(timezone.utc)
    window_start = now.timestamp() - float(hours * 3600)
    with service.session_factory() as session:
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
            recovered_stale_tasks=int(failure_code_breakdown.get("WORKER_LEASE_EXPIRED", 0)),
            p50_queue_wait_ms=service._percentile_int(queue_wait_ms, 0.50),
            p95_queue_wait_ms=service._percentile_int(queue_wait_ms, 0.95),
            p50_run_ms=service._percentile_int(run_ms, 0.50),
            p95_run_ms=service._percentile_int(run_ms, 0.95),
            status_breakdown=status_breakdown,
            failure_code_breakdown=failure_code_breakdown,
        )


def list_detections(
    service: BatchServiceLike,
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
    with service.session_factory() as session:
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


def list_reviews(
    service: BatchServiceLike,
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
    with service.session_factory() as session:
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


def list_alerts(
    service: BatchServiceLike,
    *,
    batch_id: Optional[str],
    status_filter: Optional[str],
    event_type: Optional[str],
    sort_by: str,
    sort_order: str,
    limit: int,
    offset: int,
) -> AlertListResponse:
    with service.session_factory() as session:
        service._apply_overdue_alert_escalation(session=session)
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
