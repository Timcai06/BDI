from __future__ import annotations

from types import SimpleNamespace

from app.db.models import InspectionBatch
from app.services.batch_aggregate_service import refresh_batch_aggregates


class _FakeExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeSession:
    def __init__(self, batch: InspectionBatch, rows):
        self._batch = batch
        self._rows = rows

    def get(self, model, batch_id):  # noqa: ANN001
        if model is InspectionBatch and batch_id == self._batch.id:
            return self._batch
        return None

    def execute(self, _query):  # noqa: ANN001
        return _FakeExecuteResult(self._rows)


def test_refresh_batch_aggregates_marks_running_when_queued_items_exist() -> None:
    batch = InspectionBatch(
        id="bat_1",
        bridge_id="br_1",
        batch_code="B-001-20260406-001",
        source_type="drone_image_stream",
        status="created",
    )
    session = _FakeSession(batch, [("queued", 2), ("running", 1)])

    refresh_batch_aggregates(SimpleNamespace(), session=session, batch_id=batch.id)

    assert batch.received_item_count == 3
    assert batch.queued_item_count == 2
    assert batch.running_item_count == 1
    assert batch.status == "running"


def test_refresh_batch_aggregates_marks_completed_when_all_items_succeed() -> None:
    batch = InspectionBatch(
        id="bat_1",
        bridge_id="br_1",
        batch_code="B-001-20260406-001",
        source_type="drone_image_stream",
        status="running",
    )
    session = _FakeSession(batch, [("succeeded", 4)])

    refresh_batch_aggregates(SimpleNamespace(), session=session, batch_id=batch.id)

    assert batch.received_item_count == 4
    assert batch.succeeded_item_count == 4
    assert batch.failed_item_count == 0
    assert batch.status == "completed"
    assert batch.finished_at is not None
