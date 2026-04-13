from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import BatchItem, InspectionBatch
from app.services.protocols import BatchServiceLike


def refresh_batch_aggregates(service: BatchServiceLike, *, session: Session, batch_id: str) -> None:
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
