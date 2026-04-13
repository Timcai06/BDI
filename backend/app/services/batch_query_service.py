from __future__ import annotations

from typing import Any, Optional

from fastapi import status
from sqlalchemy import case, func, select

from app.core.errors import AppError
from app.services.protocols import BatchServiceLike
from app.db.models import BatchItem, Bridge, InferenceTask, InspectionBatch
from app.models.schemas import BatchListResponse, BatchResponse, BridgeListResponse, BridgeResponse

ACTIVE_BATCH_STATUSES = ("created", "ingesting", "running")


def _resolve_runtime_enhancement_mode(
    runtime_payload: Any,
    *,
    fallback: str = "auto",
) -> str:
    if isinstance(runtime_payload, dict):
        mode = runtime_payload.get("enhancement_mode")
        if isinstance(mode, str) and mode in {"off", "auto", "always"}:
            return mode
    return fallback


def _load_bridge_summary_maps(
    session: Any,
    *,
    bridge_ids: list[str],
) -> tuple[dict[str, dict[str, Any]], dict[str, tuple[int, int]]]:
    if not bridge_ids:
        return {}, {}

    latest_created_subquery = (
        select(
            InspectionBatch.bridge_id.label("bridge_id"),
            func.max(InspectionBatch.created_at).label("latest_created_at"),
        )
        .where(InspectionBatch.bridge_id.in_(bridge_ids))
        .group_by(InspectionBatch.bridge_id)
        .subquery()
    )
    latest_rows = session.execute(
        select(
            InspectionBatch.bridge_id,
            InspectionBatch.id,
            InspectionBatch.batch_code,
            InspectionBatch.status,
            InspectionBatch.created_at,
        )
        .join(
            latest_created_subquery,
            (latest_created_subquery.c.bridge_id == InspectionBatch.bridge_id)
            & (latest_created_subquery.c.latest_created_at == InspectionBatch.created_at),
        )
    ).all()
    latest_map = {
        bridge_id: {
            "latest_batch_id": batch_id,
            "latest_batch_code": batch_code,
            "latest_batch_status": batch_status,
            "latest_batch_created_at": created_at,
        }
        for bridge_id, batch_id, batch_code, batch_status, created_at in latest_rows
    }

    aggregate_rows = session.execute(
        select(
            InspectionBatch.bridge_id,
            func.sum(case((InspectionBatch.status.in_(ACTIVE_BATCH_STATUSES), 1), else_=0)).label("active_count"),
            func.sum(
                case(
                    (
                        (InspectionBatch.failed_item_count > 0)
                        | InspectionBatch.status.in_(("failed", "partial_failed")),
                        1,
                    ),
                    else_=0,
                )
            ).label("abnormal_count"),
        )
        .where(InspectionBatch.bridge_id.in_(bridge_ids))
        .group_by(InspectionBatch.bridge_id)
    ).all()
    aggregate_map = {
        bridge_id: (int(active_count or 0), int(abnormal_count or 0))
        for bridge_id, active_count, abnormal_count in aggregate_rows
    }
    return latest_map, aggregate_map


def _build_bridge_payload(
    *,
    bridge: Bridge,
    latest_map: dict[str, dict[str, Any]],
    aggregate_map: dict[str, tuple[int, int]],
) -> BridgeResponse:
    payload = BridgeResponse.model_validate(bridge).model_dump()
    payload.update(latest_map.get(bridge.id, {}))
    active_count, abnormal_count = aggregate_map.get(bridge.id, (0, 0))
    payload["active_batch_count"] = active_count
    payload["abnormal_batch_count"] = abnormal_count
    return BridgeResponse.model_validate(payload)


def _load_batch_enhancement_modes(session: Any, *, batch_ids: list[str]) -> dict[str, str]:
    if not batch_ids:
        return {}

    latest_task_created_subquery = (
        select(
            BatchItem.batch_id.label("batch_id"),
            func.max(InferenceTask.created_at).label("latest_created_at"),
        )
        .join(BatchItem, BatchItem.id == InferenceTask.batch_item_id)
        .where(BatchItem.batch_id.in_(batch_ids))
        .group_by(BatchItem.batch_id)
        .subquery()
    )
    rows = session.execute(
        select(BatchItem.batch_id, InferenceTask.runtime_payload)
        .join(BatchItem, BatchItem.id == InferenceTask.batch_item_id)
        .join(
            latest_task_created_subquery,
            (latest_task_created_subquery.c.batch_id == BatchItem.batch_id)
            & (latest_task_created_subquery.c.latest_created_at == InferenceTask.created_at),
        )
    ).all()
    return {
        batch_id: _resolve_runtime_enhancement_mode(runtime_payload)
        for batch_id, runtime_payload in rows
    }


def list_bridges(service: BatchServiceLike, *, limit: int, offset: int) -> BridgeListResponse:
    with service.session_factory() as session:
        total = session.scalar(select(func.count()).select_from(Bridge)) or 0
        rows = session.scalars(select(Bridge).order_by(Bridge.created_at.desc()).offset(offset).limit(limit)).all()
        bridge_ids = [row.id for row in rows]
        latest_map, aggregate_map = _load_bridge_summary_maps(session, bridge_ids=bridge_ids)
        items = [
            _build_bridge_payload(bridge=row, latest_map=latest_map, aggregate_map=aggregate_map)
            for row in rows
        ]
        return BridgeListResponse(items=items, total=total, limit=limit, offset=offset)


def get_bridge(service: BatchServiceLike, bridge_id: str) -> BridgeResponse:
    with service.session_factory() as session:
        bridge = session.get(Bridge, bridge_id)
        if bridge is None:
            raise AppError(
                code="BRIDGE_NOT_FOUND",
                message="Bridge does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"bridge_id": bridge_id},
            )
        latest_map, aggregate_map = _load_bridge_summary_maps(session, bridge_ids=[bridge.id])
        return _build_bridge_payload(bridge=bridge, latest_map=latest_map, aggregate_map=aggregate_map)


def list_batches(
    service: BatchServiceLike,
    *,
    limit: int,
    offset: int,
    bridge_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    has_failures: Optional[bool] = None,
) -> BatchListResponse:
    with service.session_factory() as session:
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
        enhancement_modes = _load_batch_enhancement_modes(
            session,
            batch_ids=[batch.id for batch, _bridge in rows],
        )
        dirty = False
        items: list[BatchResponse] = []
        for batch, bridge in rows:
            dirty = service._reconcile_batch_aggregates(session=session, batch=batch) or dirty
            payload = BatchResponse.model_validate(batch).model_dump()
            payload["bridge_code"] = bridge.bridge_code
            payload["bridge_name"] = bridge.bridge_name
            payload["inspection_label"] = None
            payload["enhancement_mode"] = enhancement_modes.get(batch.id, "auto")
            items.append(BatchResponse.model_validate(payload))
        if dirty:
            session.commit()
        return BatchListResponse(items=items, total=total, limit=limit, offset=offset)


def get_batch(service: BatchServiceLike, batch_id: str) -> BatchResponse:
    with service.session_factory() as session:
        batch = session.get(InspectionBatch, batch_id)
        if batch is None:
            raise AppError(
                code="BATCH_NOT_FOUND",
                message="Batch does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"batch_id": batch_id},
            )
        if service._reconcile_batch_aggregates(session=session, batch=batch):
            session.commit()
        bridge = session.get(Bridge, batch.bridge_id)
        payload = BatchResponse.model_validate(batch).model_dump()
        payload["bridge_code"] = bridge.bridge_code if bridge is not None else None
        payload["bridge_name"] = bridge.bridge_name if bridge is not None else None
        payload["inspection_label"] = None
        payload["enhancement_mode"] = _load_batch_enhancement_modes(session, batch_ids=[batch.id]).get(batch.id, "auto")
        return BatchResponse.model_validate(payload)
