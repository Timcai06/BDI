from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

from app.db.models import BatchItem, Bridge, InferenceTask, InspectionBatch, MediaAsset
from app.services.batch_read_service import (
    get_batch_item_detail,
    list_batch_items,
    list_batches,
    list_bridges,
)


class FakeExecuteResult:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None


class FakeScalarRows:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def all(self):
        return self._rows


class FakeReadSession:
    def __init__(
        self,
        *,
        get_map: dict[tuple[type[Any], str], Any] | None = None,
        scalar_values: list[Any] | None = None,
        scalar_rows: list[list[Any]] | None = None,
        execute_rows: list[list[Any]] | None = None,
    ) -> None:
        self._get_map = get_map or {}
        self._scalar_values = list(scalar_values or [])
        self._scalar_rows = list(scalar_rows or [])
        self._execute_rows = list(execute_rows or [])
        self.commit_called = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return None

    def get(self, model: type[Any], obj_id: str):
        if model is InferenceTask:
            raise AssertionError("unexpected per-item InferenceTask lookup")
        return self._get_map.get((model, obj_id))

    def scalar(self, _query):
        if not self._scalar_values:
            raise AssertionError("unexpected scalar query")
        return self._scalar_values.pop(0)

    def scalars(self, _query):
        if not self._scalar_rows:
            raise AssertionError("unexpected scalars query")
        return FakeScalarRows(self._scalar_rows.pop(0))

    def execute(self, _query):
        if not self._execute_rows:
            raise AssertionError("unexpected execute query")
        return FakeExecuteResult(self._execute_rows.pop(0))

    def commit(self) -> None:
        self.commit_called = True


def _build_media_asset(now: datetime) -> MediaAsset:
    asset = MediaAsset(
        id="med_1",
        media_type="image",
        original_filename="frame.jpg",
        storage_uri="/tmp/frame.jpg",
        sha256="sha256",
        mime_type="image/jpeg",
        file_size_bytes=128,
        uploaded_at=now,
        source_device="drone",
        source_relative_path="deck/frame.jpg",
    )
    asset.created_at = now
    asset.updated_at = now
    return asset


def _build_batch_item(now: datetime) -> BatchItem:
    item = BatchItem(
        id="bit_1",
        batch_id="bat_1",
        media_asset_id="med_1",
        sequence_no=1,
        processing_status="failed",
        review_status="unreviewed",
        latest_task_id="tsk_1",
        latest_result_id=None,
        defect_count=0,
        alert_status="none",
    )
    item.created_at = now
    item.updated_at = now
    return item


def _build_task(now: datetime) -> InferenceTask:
    task = InferenceTask(
        id="tsk_1",
        batch_item_id="bit_1",
        task_type="inference",
        status="failed",
        attempt_no=2,
        priority=5,
        model_policy="fusion-default",
        requested_model_version="main-v1",
        resolved_model_version="fusion-v1",
        inference_mode="direct",
        failure_code="TASK_EXECUTION_FAILED",
        failure_message="mock failure",
        runtime_payload={"enhancement_mode": "always"},
        timing_payload={},
    )
    task.created_at = now
    task.updated_at = now
    return task


def test_list_batch_items_reads_latest_task_from_joined_row() -> None:
    now = datetime.now(timezone.utc)
    session = FakeReadSession(
        get_map={(InspectionBatch, "bat_1"): InspectionBatch(id="bat_1", bridge_id="br_1", batch_code="B-001", source_type="drone", status="running", sealed=False)},
        scalar_values=[1],
        execute_rows=[[(_build_batch_item(now), _build_media_asset(now), _build_task(now))]],
    )
    service = SimpleNamespace(
        session_factory=lambda: session,
        _normalize_relative_path=lambda value: value,
    )

    response = list_batch_items(service, batch_id="bat_1", limit=20, offset=0)

    assert response.total == 1
    assert response.items[0].latest_task_status == "failed"
    assert response.items[0].latest_task_attempt_no == 2
    assert response.items[0].model_policy == "fusion-default"


def test_get_batch_item_detail_reads_latest_task_from_joined_row() -> None:
    now = datetime.now(timezone.utc)
    session = FakeReadSession(
        execute_rows=[[(_build_batch_item(now), _build_media_asset(now), _build_task(now))]],
    )
    service = SimpleNamespace(session_factory=lambda: session)

    response = get_batch_item_detail(service, batch_item_id="bit_1")

    assert response.id == "bit_1"
    assert response.latest_failure_code == "TASK_EXECUTION_FAILED"
    assert response.media_asset.original_filename == "frame.jpg"


def test_list_bridges_builds_summary_from_prefetched_aggregates() -> None:
    now = datetime.now(timezone.utc)
    bridge = Bridge(id="br_1", bridge_code="BR-001", bridge_name="Bridge 1", status="active")
    bridge.created_at = now
    bridge.updated_at = now
    session = FakeReadSession(
        scalar_values=[1],
        scalar_rows=[[bridge]],
        execute_rows=[
            [[("br_1", "bat_1", "BAT-001", "completed", now)]][0],
            [[("br_1", 2, 1)]][0],
        ],
    )
    service = SimpleNamespace(
        session_factory=lambda: session,
        _build_bridge_response=lambda **_: (_ for _ in ()).throw(AssertionError("should not be used")),
    )

    response = list_bridges(service, limit=20, offset=0)

    assert response.items[0].latest_batch_id == "bat_1"
    assert response.items[0].active_batch_count == 2
    assert response.items[0].abnormal_batch_count == 1


def test_list_batches_prefetches_enhancement_modes_for_current_page() -> None:
    now = datetime.now(timezone.utc)
    batch = InspectionBatch(
        id="bat_1",
        bridge_id="br_1",
        batch_code="BAT-001",
        source_type="drone",
        status="completed",
        sealed=False,
        expected_item_count=10,
        received_item_count=10,
        queued_item_count=0,
        running_item_count=0,
        succeeded_item_count=10,
        failed_item_count=0,
    )
    batch.created_at = now
    batch.updated_at = now
    bridge = Bridge(id="br_1", bridge_code="BR-001", bridge_name="Bridge 1", status="active")
    bridge.created_at = now
    bridge.updated_at = now
    session = FakeReadSession(
        scalar_values=[1],
        execute_rows=[
            [(batch, bridge)],
            [("bat_1", {"enhancement_mode": "always"})],
        ],
    )
    service = SimpleNamespace(
        session_factory=lambda: session,
        _reconcile_batch_aggregates=lambda **_: False,
        _build_batch_payload=lambda **_: (_ for _ in ()).throw(AssertionError("should not be used")),
    )

    response = list_batches(service, limit=20, offset=0)

    assert response.items[0].bridge_code == "BR-001"
    assert response.items[0].enhancement_mode == "always"
    assert session.commit_called is False
