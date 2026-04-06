from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import UploadFile, status
from sqlalchemy import func, select

from app.core.errors import AppError
from app.db.models import BatchItem, InferenceTask, InspectionBatch, MediaAsset
from app.models.schemas import BatchIngestItemError, BatchIngestItemSuccess, BatchIngestResponse


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


async def ingest_batch_items(
    service: Any,
    *,
    batch_id: str,
    files: list[UploadFile],
    relative_paths: Optional[list[str]],
    source_device: Optional[str],
    captured_at: Optional[datetime],
    model_policy: str,
    enhancement_mode: str,
) -> BatchIngestResponse:
    with service.session_factory() as session:
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
        requested_model_version = service._resolve_requested_model_version(model_policy_value)

        for index, file in enumerate(files):
            ok, error = await service._validate_upload(file)
            if not ok:
                if error is not None:
                    errors.append(error)
                continue
            media_asset_id = _new_id("med")
            batch_item_id = _new_id("bit")
            task_id = _new_id("tsk")
            storage_saved = False

            try:
                content = await service._read_upload_content(file)
                enhance_enabled = service._should_enable_enhancement(
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
                source_relative_path = service._normalize_relative_path(
                    relative_paths[index] if relative_paths and index < len(relative_paths) else None
                )
                service.store.save_upload(image_id=media_asset_id, content=content)
                storage_saved = True

                with session.begin_nested():
                    media_asset = MediaAsset(
                        id=media_asset_id,
                        media_type="image",
                        original_filename=file.filename or media_asset_id,
                        storage_uri=str(service.store.upload_path(media_asset_id)),
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
                    service.store.delete_upload(media_asset_id)
                errors.append(
                    BatchIngestItemError(
                        filename=file.filename or "",
                        code=exc.code,
                        message=exc.message,
                    )
                )
            except Exception:
                if storage_saved:
                    service.store.delete_upload(media_asset_id)
                errors.append(
                    BatchIngestItemError(
                        filename=file.filename or "",
                        code="INGEST_FAILED",
                        message="Failed to ingest image.",
                    )
                )

        batch.received_item_count = (batch.received_item_count or 0) + len(accepted)
        batch.expected_item_count = max(batch.expected_item_count or 0, batch.received_item_count)
        service._refresh_batch_aggregates(session=session, batch_id=batch_id)
        session.commit()
        return BatchIngestResponse(
            batch_id=batch_id,
            accepted_count=len(accepted),
            rejected_count=len(errors),
            items=accepted,
            errors=errors,
        )
