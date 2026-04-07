from __future__ import annotations

import asyncio
import io
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import UploadFile

from app.db.models import InspectionBatch
from app.core.errors import AppError
from app.services.batch_ingest_service import ingest_batch_items
from app.services.batch_service import BatchService
from app.storage.local import LocalArtifactStore


class _FakeSession:
    def __init__(self, batch: InspectionBatch) -> None:
        self.batch = batch
        self.scalar_values = [0, 0]
        self.added = []
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def get(self, model, batch_id):  # noqa: ANN001
        if model is InspectionBatch and batch_id == self.batch.id:
            return self.batch
        return None

    def scalar(self, _query):  # noqa: ANN001
        return self.scalar_values.pop(0)

    def add(self, obj):  # noqa: ANN001
        self.added.append(obj)

    def flush(self):
        return None

    @contextmanager
    def begin_nested(self):
        yield self

    def commit(self):
        self.committed = True


class _FakeRunnerManager:
    def __init__(self) -> None:
        self.registry = SimpleNamespace(
            active_version="mock-v1",
            specs={"mock-v1": object()},
            get_active=lambda: SimpleNamespace(model_version="mock-v1", runner_kind="mock", primary_model_version=None),
            list_specs=lambda: [],
        )


def test_batch_ingest_service_accepts_image_and_refreshes_batch(tmp_path: Path, monkeypatch) -> None:
    batch = InspectionBatch(
        id="bat_1",
        bridge_id="br_1",
        batch_code="B-001-20260406-001",
        source_type="drone_image_stream",
        status="created",
    )
    session = _FakeSession(batch)
    service = BatchService(
        session_factory=lambda: session,
        store=LocalArtifactStore(tmp_path / "artifacts"),
        max_upload_size_bytes=30 * 1024 * 1024,
        runner_manager=_FakeRunnerManager(),
    )
    refreshed_batch_ids: list[str] = []
    monkeypatch.setattr(
        service,
        "_refresh_batch_aggregates",
        lambda *, session, batch_id: refreshed_batch_ids.append(batch_id),
    )

    upload = UploadFile(
        filename="bridge.jpg",
        file=io.BytesIO(b"fake-jpeg-data"),
        headers={"content-type": "image/jpeg"},
    )

    response = asyncio.run(
        ingest_batch_items(
            service,
            batch_id=batch.id,
            files=[upload],
            relative_paths=["bridge-A/segment-01/bridge.jpg"],
            source_device="drone-A",
            captured_at=None,
            model_policy="fusion-default",
            enhancement_mode="off",
        )
    )

    assert response.accepted_count == 1
    assert response.rejected_count == 0
    assert response.items[0].source_relative_path == "bridge-A/segment-01/bridge.jpg"
    assert batch.received_item_count == 1
    assert refreshed_batch_ids == [batch.id]
    assert session.committed is True


def test_batch_ingest_service_rejects_empty_file_list(tmp_path: Path) -> None:
    batch = InspectionBatch(
        id="bat_1",
        bridge_id="br_1",
        batch_code="B-001-20260406-001",
        source_type="drone_image_stream",
        status="created",
    )
    session = _FakeSession(batch)
    service = BatchService(
        session_factory=lambda: session,
        store=LocalArtifactStore(tmp_path / "artifacts"),
        max_upload_size_bytes=30 * 1024 * 1024,
        runner_manager=_FakeRunnerManager(),
    )

    with pytest.raises(AppError) as exc:
        asyncio.run(
            ingest_batch_items(
                service,
                batch_id=batch.id,
                files=[],
                relative_paths=None,
                source_device="drone-A",
                captured_at=None,
                model_policy="fusion-default",
                enhancement_mode="off",
            )
        )

    assert exc.value.code == "EMPTY_UPLOAD_BATCH"


def test_batch_ingest_service_rejects_relative_path_count_mismatch(tmp_path: Path) -> None:
    batch = InspectionBatch(
        id="bat_1",
        bridge_id="br_1",
        batch_code="B-001-20260406-001",
        source_type="drone_image_stream",
        status="created",
    )
    session = _FakeSession(batch)
    service = BatchService(
        session_factory=lambda: session,
        store=LocalArtifactStore(tmp_path / "artifacts"),
        max_upload_size_bytes=30 * 1024 * 1024,
        runner_manager=_FakeRunnerManager(),
    )
    upload = UploadFile(
        filename="bridge.jpg",
        file=io.BytesIO(b"fake-jpeg-data"),
        headers={"content-type": "image/jpeg"},
    )

    with pytest.raises(AppError) as exc:
        asyncio.run(
            ingest_batch_items(
                service,
                batch_id=batch.id,
                files=[upload],
                relative_paths=[],
                source_device="drone-A",
                captured_at=None,
                model_policy="fusion-default",
                enhancement_mode="off",
            )
        )

    assert exc.value.code == "RELATIVE_PATH_COUNT_MISMATCH"


def test_batch_ingest_service_rejects_invalid_relative_path(tmp_path: Path) -> None:
    batch = InspectionBatch(
        id="bat_1",
        bridge_id="br_1",
        batch_code="B-001-20260406-001",
        source_type="drone_image_stream",
        status="created",
    )
    session = _FakeSession(batch)
    service = BatchService(
        session_factory=lambda: session,
        store=LocalArtifactStore(tmp_path / "artifacts"),
        max_upload_size_bytes=30 * 1024 * 1024,
        runner_manager=_FakeRunnerManager(),
    )
    upload = UploadFile(
        filename="bridge.jpg",
        file=io.BytesIO(b"fake-jpeg-data"),
        headers={"content-type": "image/jpeg"},
    )

    with pytest.raises(AppError) as exc:
        asyncio.run(
            ingest_batch_items(
                service,
                batch_id=batch.id,
                files=[upload],
                relative_paths=["../unsafe.jpg"],
                source_device="drone-A",
                captured_at=None,
                model_policy="fusion-default",
                enhancement_mode="off",
            )
        )

    assert exc.value.code == "INVALID_RELATIVE_PATH"


def test_batch_ingest_service_rejects_invalid_enhancement_mode(tmp_path: Path) -> None:
    batch = InspectionBatch(
        id="bat_1",
        bridge_id="br_1",
        batch_code="B-001-20260406-001",
        source_type="drone_image_stream",
        status="created",
    )
    session = _FakeSession(batch)
    service = BatchService(
        session_factory=lambda: session,
        store=LocalArtifactStore(tmp_path / "artifacts"),
        max_upload_size_bytes=30 * 1024 * 1024,
        runner_manager=_FakeRunnerManager(),
    )
    upload = UploadFile(
        filename="bridge.jpg",
        file=io.BytesIO(b"fake-jpeg-data"),
        headers={"content-type": "image/jpeg"},
    )

    with pytest.raises(AppError) as exc:
        asyncio.run(
            ingest_batch_items(
                service,
                batch_id=batch.id,
                files=[upload],
                relative_paths=["bridge-A/segment-01/bridge.jpg"],
                source_device="drone-A",
                captured_at=None,
                model_policy="fusion-default",
                enhancement_mode="invalid-mode",
            )
        )

    assert exc.value.code == "INVALID_ENHANCEMENT_MODE"


def test_batch_ingest_service_rejects_invalid_model_policy(tmp_path: Path) -> None:
    batch = InspectionBatch(
        id="bat_1",
        bridge_id="br_1",
        batch_code="B-001-20260406-001",
        source_type="drone_image_stream",
        status="created",
    )
    session = _FakeSession(batch)
    service = BatchService(
        session_factory=lambda: session,
        store=LocalArtifactStore(tmp_path / "artifacts"),
        max_upload_size_bytes=30 * 1024 * 1024,
        runner_manager=_FakeRunnerManager(),
    )
    upload = UploadFile(
        filename="bridge.jpg",
        file=io.BytesIO(b"fake-jpeg-data"),
        headers={"content-type": "image/jpeg"},
    )

    with pytest.raises(AppError) as exc:
        asyncio.run(
            ingest_batch_items(
                service,
                batch_id=batch.id,
                files=[upload],
                relative_paths=["bridge-A/segment-01/bridge.jpg"],
                source_device="drone-A",
                captured_at=None,
                model_policy="non-existent-policy",
                enhancement_mode="off",
            )
        )

    assert exc.value.code == "INVALID_MODEL_POLICY"
