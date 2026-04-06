from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace

from app.adapters.mock_runner import MockRunner
from app.db.models import BatchItem, Detection, InferenceResult, InferenceTask, MediaAsset
from app.services.task_execution_service import execute_task
from app.services.task_service import TaskService
from app.storage.local import LocalArtifactStore


class _FakeSession:
    def __init__(self, *, batch_item: BatchItem, media_asset: MediaAsset) -> None:
        self.batch_item = batch_item
        self.media_asset = media_asset
        self.added: list[object] = []

    def get(self, model, object_id):  # noqa: ANN001
        if model is BatchItem and object_id == self.batch_item.id:
            return self.batch_item
        if model is MediaAsset and object_id == self.media_asset.id:
            return self.media_asset
        return None

    def add(self, obj):  # noqa: ANN001
        self.added.append(obj)

    def flush(self):
        return None

    @contextmanager
    def begin_nested(self):
        yield self


class _FakeRunnerManager:
    def resolve(self, version=None):  # noqa: ANN001
        spec = SimpleNamespace(model_version=version or "mock-v1", model_name="mock-runner", backend="mock")
        return spec, MockRunner()


def test_task_execution_service_writes_result_and_updates_batch_item(tmp_path: Path, monkeypatch) -> None:
    image_path = tmp_path / "demo.jpg"
    image_path.write_bytes(b"fake-image-bytes")

    batch_item = BatchItem(
        id="bit_1",
        batch_id="bat_1",
        media_asset_id="med_1",
        sequence_no=1,
        processing_status="running",
        review_status="unreviewed",
        alert_status="none",
        defect_count=0,
    )
    media_asset = MediaAsset(
        id="med_1",
        media_type="image",
        original_filename="demo.jpg",
        storage_uri=str(image_path),
        sha256="sha256",
        mime_type="image/jpeg",
        file_size_bytes=16,
    )
    task = InferenceTask(
        id="tsk_1",
        batch_item_id=batch_item.id,
        status="running",
        model_policy="fusion-default",
        requested_model_version="mock-v1",
        runtime_payload={"enhance": False},
        timing_payload={},
    )
    session = _FakeSession(batch_item=batch_item, media_asset=media_asset)

    service = TaskService(
        session_factory=lambda: None,
        store=LocalArtifactStore(tmp_path / "artifacts"),
        runner_manager=_FakeRunnerManager(),
        enhance_runner=None,
    )
    monkeypatch.setattr(service, "_emit_auto_alerts", lambda **kwargs: None)
    refreshed_batch_ids: list[str] = []
    monkeypatch.setattr(
        service,
        "_refresh_batch_aggregates",
        lambda *, session, batch_id: refreshed_batch_ids.append(batch_id),
    )

    result_id = execute_task(service, session, task)

    assert result_id.startswith("res_")
    assert task.status == "succeeded"
    assert batch_item.processing_status == "succeeded"
    assert batch_item.latest_result_id == result_id
    assert refreshed_batch_ids == [batch_item.batch_id]
    assert any(isinstance(item, InferenceResult) for item in session.added)
    assert any(isinstance(item, Detection) for item in session.added)
    assert service.store.result_path(result_id).exists()
