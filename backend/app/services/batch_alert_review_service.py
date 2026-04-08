from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import AlertEvent, BatchItem, Bridge, Detection, InspectionBatch, ReviewRecord
from app.models.schemas import (
    AlertCreateRequest,
    AlertResponse,
    AlertStatusUpdateRequest,
    ReviewCreateRequest,
    ReviewRecordResponse,
)

ALERT_LEVEL_ORDER = ["low", "medium", "high", "critical"]


def create_review(service: Any, payload: ReviewCreateRequest) -> ReviewRecordResponse:
    with service.session_factory() as session:
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
            id=service._new_id("rev"),
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
                    select(func.count()).select_from(Detection).where(Detection.batch_item_id == detection.batch_item_id)
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


def create_alert(service: Any, payload: AlertCreateRequest) -> AlertResponse:
    with service.session_factory() as session:
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
            id=service._new_id("alt"),
            bridge_id=payload.bridge_id,
            batch_id=payload.batch_id,
            batch_item_id=payload.batch_item_id,
            result_id=payload.result_id,
            detection_id=payload.detection_id,
            event_type=payload.event_type,
            alert_level=payload.alert_level,
            status="open",
            title=payload.title,
            trigger_payload=service._build_alert_trigger_payload(payload.trigger_payload, payload.alert_level),
            note=payload.note,
            triggered_at=datetime.now(timezone.utc),
        )
        session.add(alert)
        session.flush()

        if payload.batch_item_id is not None:
            service._refresh_batch_item_alert_status(session=session, batch_item_id=payload.batch_item_id)

        session.commit()
        session.refresh(alert)
        return AlertResponse.model_validate(alert)


def update_alert_status(service: Any, alert_id: str, payload: AlertStatusUpdateRequest) -> AlertResponse:
    with service.session_factory() as session:
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
            service._refresh_batch_item_alert_status(session=session, batch_item_id=alert.batch_item_id)

        session.commit()
        session.refresh(alert)
        return AlertResponse.model_validate(alert)


def refresh_batch_item_alert_status(service: Any, *, session: Session, batch_item_id: str) -> None:
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


def build_alert_trigger_payload(service: Any, base_payload: dict[str, Any], alert_level: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    payload = dict(base_payload)
    payload.setdefault("repeat_hits", 1)
    payload.setdefault("first_triggered_at", now.isoformat())
    payload["last_triggered_at"] = now.isoformat()
    payload["sla_due_at"] = service._build_sla_due_at_iso(alert_level, now)
    return payload


def apply_overdue_alert_escalation(service: Any, *, session: Session) -> None:
    now = datetime.now(timezone.utc)
    alerts = session.scalars(select(AlertEvent).where(AlertEvent.status.in_(["open", "acknowledged"]))).all()
    changed = False
    for alert in alerts:
        payload = dict(alert.trigger_payload or {})
        due_at_raw = payload.get("sla_due_at")
        if not due_at_raw:
            continue
        due_at = parse_iso_datetime(due_at_raw)
        if due_at is None or now <= due_at:
            continue
        next_level = next_alert_level(alert.alert_level)
        if next_level == alert.alert_level:
            continue
        alert.alert_level = next_level
        payload["overdue_escalated_at"] = now.isoformat()
        payload["sla_due_at"] = service._build_sla_due_at_iso(next_level, now)
        alert.trigger_payload = payload
        changed = True
    if changed:
        session.commit()


def parse_iso_datetime(value: Any) -> Optional[datetime]:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def next_alert_level(level: str) -> str:
    try:
        idx = ALERT_LEVEL_ORDER.index(level)
    except ValueError:
        return "critical"
    if idx >= len(ALERT_LEVEL_ORDER) - 1:
        return ALERT_LEVEL_ORDER[-1]
    return ALERT_LEVEL_ORDER[idx + 1]


def build_sla_due_at_iso(service: Any, level: str, start_at: datetime) -> str:
    hours = service.alert_sla_hours_by_level.get(level, service.alert_sla_hours_by_level.get("critical", 12))
    due_at = start_at + timedelta(hours=hours)
    return due_at.isoformat()
