from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import status
from sqlalchemy import delete, func, select, update

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
from app.models.schemas import BatchCreateRequest, BatchCreateResponse, BatchDeleteResponse, BridgeCreateRequest


def create_bridge(service: Any, payload: BridgeCreateRequest):
    with service.session_factory() as session:
        existing = session.scalar(select(Bridge).where(Bridge.bridge_code == payload.bridge_code))
        if existing is not None:
            raise AppError(
                code="BRIDGE_CODE_CONFLICT",
                message="Bridge code already exists.",
                status_code=status.HTTP_409_CONFLICT,
                details={"bridge_code": payload.bridge_code},
            )

        bridge = Bridge(
            id=service._new_id("br"),
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
        return service._build_bridge_response(session=session, bridge=bridge)


def delete_bridge(service: Any, bridge_id: str):
    with service.session_factory() as session:
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
        service.delete_batch(batch_id)

    with service.session_factory() as session:
        bridge = session.get(Bridge, bridge_id)
        if bridge is None:
            return {"bridge_id": bridge_id, "deleted": True}
        session.delete(bridge)
        session.commit()
    return {"bridge_id": bridge_id, "deleted": True}


def create_batch(service: Any, payload: BatchCreateRequest) -> BatchCreateResponse:
    with service.session_factory() as session:
        bridge = session.get(Bridge, payload.bridge_id)
        if bridge is None:
            raise AppError(
                code="BRIDGE_NOT_FOUND",
                message="Bridge does not exist.",
                status_code=status.HTTP_404_NOT_FOUND,
                details={"bridge_id": payload.bridge_id},
            )

        batch_code = service._generate_batch_code(session=session, bridge=bridge)
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
            batch_code = service._generate_batch_code(session=session, bridge=bridge, attempt_offset=1)

        batch = InspectionBatch(
            id=service._new_id("bat"),
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
            service._build_batch_payload(session=session, batch=batch, bridge=bridge, payload=payload)
        )


def delete_batch(service: Any, batch_id: str) -> BatchDeleteResponse:
    with service.session_factory() as session:
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
            session.execute(select(MediaAsset.id, MediaAsset.storage_uri).where(MediaAsset.id.in_(media_asset_ids))).all()
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
