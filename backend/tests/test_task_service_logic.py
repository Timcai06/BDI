from __future__ import annotations

from types import SimpleNamespace

from app.core.errors import AppError
from app.models.schemas import BoundingBox, RawDetection, RawPrediction
from app.services.task_service import TaskService


def test_retryable_failure_code_set_is_enforced() -> None:
    assert TaskService._is_retryable_failure_code("MODEL_TIMEOUT") is True
    assert TaskService._is_retryable_failure_code("TASK_EXECUTION_FAILED") is True
    assert TaskService._is_retryable_failure_code("INVALID_IMAGE_FORMAT") is False
    assert TaskService._is_retryable_failure_code(None) is False


def test_classify_failure_for_app_error_uses_original_code() -> None:
    exc = AppError(
        code="MODEL_UNAVAILABLE",
        message="model unavailable",
        status_code=503,
    )

    decision = TaskService._classify_failure(exc)

    assert decision.code == "MODEL_UNAVAILABLE"
    assert decision.retryable is True
    assert decision.message == "model unavailable"


def test_classify_failure_for_timeout_maps_to_retryable_timeout_code() -> None:
    decision = TaskService._classify_failure(TimeoutError("timeout"))

    assert decision.code == "MODEL_TIMEOUT"
    assert decision.retryable is True


def test_classify_failure_for_unknown_exception_maps_to_generic_retryable_code() -> None:
    decision = TaskService._classify_failure(RuntimeError("boom"))

    assert decision.code == "TASK_EXECUTION_FAILED"
    assert decision.retryable is True
    assert "boom" in decision.message


def test_build_auto_alert_candidates_emits_count_and_watchlist_alerts() -> None:
    service = TaskService(
        session_factory=SimpleNamespace(),
        store=SimpleNamespace(),
        runner_manager=SimpleNamespace(),
        alert_auto_enabled=True,
        alert_count_threshold=2,
        alert_category_watchlist=["seepage"],
        alert_category_confidence_threshold=0.8,
    )
    raw = RawPrediction(
        model_name="m",
        model_version="v",
        backend="mock",
        inference_mode="direct",
        inference_ms=10,
        detections=[
            RawDetection(category="seepage", confidence=0.91, bbox=BoundingBox(x=1, y=1, width=10, height=10)),
            RawDetection(category="crack", confidence=0.77, bbox=BoundingBox(x=2, y=2, width=10, height=10)),
        ],
    )

    candidates = service._build_auto_alert_candidates(raw)
    event_types = {item.event_type for item in candidates}

    assert "count_exceeded" in event_types
    assert "category_hit" in event_types


def test_build_auto_alert_candidates_skips_watchlist_below_confidence_threshold() -> None:
    service = TaskService(
        session_factory=SimpleNamespace(),
        store=SimpleNamespace(),
        runner_manager=SimpleNamespace(),
        alert_auto_enabled=True,
        alert_count_threshold=10,
        alert_category_watchlist=["seepage"],
        alert_category_confidence_threshold=0.95,
    )
    raw = RawPrediction(
        model_name="m",
        model_version="v",
        backend="mock",
        inference_mode="direct",
        inference_ms=10,
        detections=[
            RawDetection(category="seepage", confidence=0.9, bbox=BoundingBox(x=1, y=1, width=10, height=10)),
        ],
    )

    candidates = service._build_auto_alert_candidates(raw)

    assert candidates == []
