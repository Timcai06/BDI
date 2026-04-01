from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.core.errors import AppError
from app.db.models import BatchItem, InferenceTask
from app.models.schemas import TaskRetryRequest
from app.services.task_service import TaskService


class FakeSession:
    def __init__(self, *, task: Any | None = None, batch_item: Any | None = None) -> None:
        self._task = task
        self._batch_item = batch_item
        self.commit_called = False
        self.rollback_called = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def get(self, model, obj_id):
        if model is InferenceTask:
            return self._task if self._task is not None and self._task.id == obj_id else None
        if model is BatchItem:
            return self._batch_item if self._batch_item is not None and self._batch_item.id == obj_id else None
        return None

    def scalar(self, _query):
        return 0

    def commit(self) -> None:
        self.commit_called = True

    def rollback(self) -> None:
        self.rollback_called = True


class FakeSessionFactory:
    def __init__(self, session: FakeSession) -> None:
        self._session = session

    def __call__(self):
        return self._session


def build_service(session: FakeSession) -> TaskService:
    return TaskService(
        session_factory=FakeSessionFactory(session),
        store=SimpleNamespace(),
        runner_manager=SimpleNamespace(),
        max_attempts=3,
    )


def test_retry_task_rejects_non_failed_status() -> None:
    task = SimpleNamespace(
        id="tsk_1",
        batch_item_id="bit_1",
        status="queued",
        failure_code="TASK_EXECUTION_FAILED",
    )
    service = build_service(FakeSession(task=task))

    with pytest.raises(AppError) as exc:
        service.retry_task("tsk_1", TaskRetryRequest(requested_by="tester"))

    assert exc.value.code == "TASK_RETRY_NOT_ALLOWED"


def test_retry_task_rejects_non_retryable_failure() -> None:
    task = SimpleNamespace(
        id="tsk_1",
        batch_item_id="bit_1",
        status="failed",
        failure_code="INVALID_IMAGE_FORMAT",
    )
    service = build_service(FakeSession(task=task))

    with pytest.raises(AppError) as exc:
        service.retry_task("tsk_1", TaskRetryRequest(requested_by="tester"))

    assert exc.value.code == "TASK_RETRY_NOT_ALLOWED"


def test_retry_task_rejects_when_attempt_limit_reached(monkeypatch) -> None:
    task = SimpleNamespace(
        id="tsk_1",
        batch_item_id="bit_1",
        status="failed",
        failure_code="TASK_EXECUTION_FAILED",
    )
    service = build_service(FakeSession(task=task))
    monkeypatch.setattr(service, "_next_attempt_no", lambda **_: 4)

    with pytest.raises(AppError) as exc:
        service.retry_task("tsk_1", TaskRetryRequest(requested_by="tester"))

    assert exc.value.code == "TASK_RETRY_NOT_ALLOWED"


def test_retry_task_success_requeues_batch_item(monkeypatch) -> None:
    task = SimpleNamespace(
        id="tsk_1",
        batch_item_id="bit_1",
        task_type="inference",
        priority=5,
        model_policy="fusion-default",
        requested_model_version=None,
        inference_mode="direct",
        status="failed",
        failure_code="TASK_EXECUTION_FAILED",
    )
    batch_item = SimpleNamespace(id="bit_1", batch_id="bat_1", processing_status="failed", latest_task_id="tsk_1")
    session = FakeSession(task=task, batch_item=batch_item)
    service = build_service(session)

    monkeypatch.setattr(service, "_next_attempt_no", lambda **_: 2)
    monkeypatch.setattr(
        service,
        "_create_retry_task",
        lambda **_: SimpleNamespace(id="tsk_2"),
    )

    refreshed = {"called": False}

    def _refresh(**_kwargs):
        refreshed["called"] = True

    monkeypatch.setattr(service, "_refresh_batch_aggregates", _refresh)

    response = service.retry_task(
        "tsk_1",
        TaskRetryRequest(requested_by="tester", reason="manual retry"),
    )

    assert response.old_task_id == "tsk_1"
    assert response.new_task_id == "tsk_2"
    assert response.status == "queued"
    assert batch_item.processing_status == "queued"
    assert batch_item.latest_task_id == "tsk_2"
    assert refreshed["called"] is True
    assert session.commit_called is True


def test_process_next_queued_task_returns_retry_message(monkeypatch) -> None:
    service = build_service(FakeSession())
    monkeypatch.setattr(service, "_claim_next_queued_task", lambda **_: SimpleNamespace(id="tsk_1"))

    def _raise(*_args, **_kwargs):
        raise TimeoutError("timeout")

    monkeypatch.setattr(service, "_execute_task", _raise)
    monkeypatch.setattr(service, "_mark_task_failed", lambda *_args, **_kwargs: "tsk_2")

    response = service.process_next_queued_task()

    assert response.processed is False
    assert response.task_id == "tsk_1"
    assert "Retry queued: tsk_2" in (response.message or "")
