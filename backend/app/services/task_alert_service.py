from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import ALERT_LEVEL_ORDER, ALERT_SLA_HOURS_BY_LEVEL, next_alert_level
from app.services.protocols import TaskServiceLike
from app.db.models import AlertEvent, BatchItem, InspectionBatch, OpsAuditLog, OpsConfig
from app.models.schemas import (
    AlertRulesConfigResponse,
    AlertRulesUpdateRequest,
    OpsAuditLogListResponse,
    OpsAuditLogResponse,
    RawPrediction,
)

__all__ = ["ALERT_LEVEL_ORDER", "ALERT_SLA_HOURS_BY_LEVEL"]


def get_alert_rule_config(service: TaskServiceLike) -> AlertRulesConfigResponse:
    with service.session_factory() as session:
        service._sync_alert_rules_from_db(session=session)
    return AlertRulesConfigResponse(
        profile_name=service.alert_profile_name,
        alert_auto_enabled=service.alert_auto_enabled,
        count_threshold=service.alert_count_threshold,
        category_watchlist=service.alert_category_watchlist,
        category_confidence_threshold=service.alert_category_confidence_threshold,
        repeat_escalation_hits=service.alert_repeat_escalation_hits,
        sla_hours_by_level=service.alert_sla_hours_by_level,
        near_due_hours=service.alert_near_due_hours,
        updated_at=service.alert_updated_at,
        updated_by=service.alert_updated_by,
    )


def update_alert_rule_config(service: TaskServiceLike, payload: AlertRulesUpdateRequest) -> AlertRulesConfigResponse:
    with service.session_factory() as session:
        service._sync_alert_rules_from_db(session=session)
        before_payload = service._build_alert_rules_payload()
        if payload.profile_name is not None:
            service.alert_profile_name = payload.profile_name
        if payload.alert_auto_enabled is not None:
            service.alert_auto_enabled = payload.alert_auto_enabled
        if payload.count_threshold is not None:
            service.alert_count_threshold = max(1, int(payload.count_threshold))
        if payload.category_watchlist is not None:
            service.alert_category_watchlist = [item for item in payload.category_watchlist if item]
        if payload.category_confidence_threshold is not None:
            service.alert_category_confidence_threshold = max(
                0.0,
                min(1.0, payload.category_confidence_threshold),
            )
        if payload.repeat_escalation_hits is not None:
            service.alert_repeat_escalation_hits = max(2, int(payload.repeat_escalation_hits))
        if payload.sla_hours_by_level is not None:
            merged = dict(service.alert_sla_hours_by_level)
            for level in ALERT_LEVEL_ORDER:
                if level in payload.sla_hours_by_level:
                    merged[level] = max(1, int(payload.sla_hours_by_level[level]))
            service.alert_sla_hours_by_level = merged
        if payload.near_due_hours is not None:
            service.alert_near_due_hours = max(1, int(payload.near_due_hours))
        service.alert_updated_at = datetime.now(timezone.utc)
        service.alert_updated_by = payload.updated_by
        config = session.get(OpsConfig, service.ALERT_RULES_CONFIG_KEY)
        if config is None:
            config = OpsConfig(config_key=service.ALERT_RULES_CONFIG_KEY)
            session.add(config)
        after_payload = service._build_alert_rules_payload()
        config.config_payload = after_payload
        config.updated_by = payload.updated_by
        session.add(
            OpsAuditLog(
                id=service._new_id("aud"),
                audit_type="alert_rules_updated",
                actor=payload.updated_by,
                target_key=service.ALERT_RULES_CONFIG_KEY,
                before_payload=before_payload,
                after_payload=after_payload,
                diff_payload=service._build_diff_payload(before_payload, after_payload),
                note=f"profile={after_payload.get('profile_name', 'JTG-v1')}",
            )
        )
        session.commit()
    return service.get_alert_rule_config()


def list_alert_rule_audit_logs(
    service: TaskServiceLike,
    *,
    limit: int,
    offset: int,
    actor: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> OpsAuditLogListResponse:
    with service.session_factory() as session:
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


def emit_auto_alerts(
    service: TaskServiceLike,
    *,
    session: Session,
    batch_item: BatchItem,
    result_id: str,
    raw: RawPrediction,
) -> None:
    if not service.alert_auto_enabled:
        return

    batch = session.get(InspectionBatch, batch_item.batch_id)
    if batch is None:
        return

    candidates = service._build_auto_alert_candidates(raw)
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
            service._apply_repeat_trigger_escalation(existing_alert)
            continue

        session.add(
            AlertEvent(
                id=service._new_id("alt"),
                bridge_id=batch.bridge_id,
                batch_id=batch_item.batch_id,
                batch_item_id=batch_item.id,
                result_id=result_id,
                detection_id=None,
                event_type=candidate.event_type,
                alert_level=candidate.alert_level,
                status="open",
                title=candidate.title,
                trigger_payload=service._build_alert_trigger_payload(
                    candidate.trigger_payload,
                    candidate.alert_level,
                ),
                triggered_at=datetime.now(timezone.utc),
            )
        )
        created_count += 1

    if created_count > 0:
        batch_item.alert_status = "open"


def build_auto_alert_candidates(service: TaskServiceLike, raw: RawPrediction) -> list[Any]:
    candidates: list[Any] = []
    detection_count = len(raw.detections)

    if detection_count >= service.alert_count_threshold:
        level = "high" if detection_count >= service.alert_count_threshold * 2 else "medium"
        candidates.append(
            service.auto_alert_candidate_class(
                event_type="count_exceeded",
                alert_level=level,
                title="Defect count exceeds threshold",
                trigger_payload={
                    "count": detection_count,
                    "threshold": service.alert_count_threshold,
                },
            )
        )

    for category in service.alert_category_watchlist:
        matched = [item for item in raw.detections if service.normalize_category(item.category) == category]
        if not matched:
            continue
        max_confidence = max(item.confidence for item in matched)
        if max_confidence < service.alert_category_confidence_threshold:
            continue
        candidates.append(
            service.auto_alert_candidate_class(
                event_type="category_hit",
                alert_level="high",
                title="Watchlist category detected",
                trigger_payload={
                    "category": category,
                    "count": len(matched),
                    "max_confidence": max_confidence,
                    "threshold": service.alert_category_confidence_threshold,
                },
            )
        )

    return candidates


def apply_repeat_trigger_escalation(service: TaskServiceLike, alert: AlertEvent) -> None:
    now = datetime.now(timezone.utc)
    payload = dict(alert.trigger_payload or {})
    repeat_hits = int(payload.get("repeat_hits", 1)) + 1
    payload["repeat_hits"] = repeat_hits
    payload["last_triggered_at"] = now.isoformat()
    if repeat_hits >= service.alert_repeat_escalation_hits:
        next_level = service._next_alert_level(alert.alert_level)
        if next_level != alert.alert_level:
            alert.alert_level = next_level
            payload["repeat_escalated_at"] = now.isoformat()
            payload["sla_due_at"] = service._build_sla_due_at_iso(next_level, now)
    alert.trigger_payload = payload
    alert.updated_at = now


def build_alert_trigger_payload(service: TaskServiceLike, base_payload: dict[str, Any], alert_level: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    payload = dict(base_payload)
    payload.setdefault("repeat_hits", 1)
    payload.setdefault("first_triggered_at", now.isoformat())
    payload["last_triggered_at"] = now.isoformat()
    payload["sla_due_at"] = service._build_sla_due_at_iso(alert_level, now)
    return payload


def build_sla_due_at_iso(service: TaskServiceLike, level: str, start_at: datetime) -> str:
    hours = service.alert_sla_hours_by_level.get(level, service.alert_sla_hours_by_level.get("critical", 12))
    due_at = start_at + timedelta(hours=hours)
    return due_at.isoformat()


def sync_alert_rules_from_db(service: TaskServiceLike, *, session: Session) -> None:
    try:
        config = session.get(OpsConfig, service.ALERT_RULES_CONFIG_KEY)
    except Exception:
        return
    if config is None or not isinstance(config.config_payload, dict):
        return
    payload = config.config_payload
    service.alert_profile_name = str(payload.get("profile_name", service.alert_profile_name))
    service.alert_auto_enabled = bool(payload.get("alert_auto_enabled", service.alert_auto_enabled))
    service.alert_count_threshold = max(1, int(payload.get("count_threshold", service.alert_count_threshold)))
    watchlist = payload.get("category_watchlist", service.alert_category_watchlist)
    if isinstance(watchlist, list):
        normalized = [service.normalize_category(str(item)) for item in watchlist if str(item).strip()]
        if normalized:
            service.alert_category_watchlist = normalized
    service.alert_category_confidence_threshold = max(
        0.0,
        min(1.0, float(payload.get("category_confidence_threshold", service.alert_category_confidence_threshold))),
    )
    service.alert_repeat_escalation_hits = max(
        2,
        int(payload.get("repeat_escalation_hits", service.alert_repeat_escalation_hits)),
    )
    service.alert_near_due_hours = max(1, int(payload.get("near_due_hours", service.alert_near_due_hours)))
    sla = payload.get("sla_hours_by_level")
    if isinstance(sla, dict):
        merged = dict(service.alert_sla_hours_by_level)
        for level in ALERT_LEVEL_ORDER:
            value = sla.get(level)
            if value is not None:
                merged[level] = max(1, int(value))
        service.alert_sla_hours_by_level = merged
    updated_by = config.updated_by
    if updated_by is not None:
        service.alert_updated_by = updated_by
    service.alert_updated_at = config.updated_at


def build_alert_rules_payload(service: TaskServiceLike) -> dict[str, Any]:
    return {
        "profile_name": service.alert_profile_name,
        "alert_auto_enabled": service.alert_auto_enabled,
        "count_threshold": service.alert_count_threshold,
        "category_watchlist": service.alert_category_watchlist,
        "category_confidence_threshold": service.alert_category_confidence_threshold,
        "repeat_escalation_hits": service.alert_repeat_escalation_hits,
        "sla_hours_by_level": service.alert_sla_hours_by_level,
        "near_due_hours": service.alert_near_due_hours,
    }


def build_diff_payload(before_payload: dict[str, Any], after_payload: dict[str, Any]) -> dict[str, Any]:
    diff: dict[str, Any] = {}
    keys = set(before_payload.keys()) | set(after_payload.keys())
    for key in sorted(keys):
        before_value = before_payload.get(key)
        after_value = after_payload.get(key)
        if before_value != after_value:
            diff[key] = {"before": before_value, "after": after_value}
    return diff
