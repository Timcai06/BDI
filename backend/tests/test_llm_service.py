from __future__ import annotations

import asyncio

from app.core.config import Settings
from app.models.schemas import ArtifactLinks, Detection, BoundingBox, DetectionMetrics, PredictResponse
from app.services.llm_service import LLMService


def _build_result() -> PredictResponse:
    return PredictResponse(
        image_id="test-image",
        inference_ms=12,
        model_name="mock-runner",
        model_version="mock-v1",
        backend="mock",
        inference_mode="direct",
        detections=[
            Detection(
                id="det-1",
                category="crack",
                confidence=0.92,
                bbox=BoundingBox(x=1, y=2, width=30, height=10),
                metrics=DetectionMetrics(length_mm=12.3, width_mm=1.2, area_mm2=18.6),
            )
        ],
        artifacts=ArtifactLinks(upload_path="/tmp/upload", json_path="/tmp/result.json"),
    )


def test_generate_diagnosis_stream_returns_missing_key_message() -> None:
    service = LLMService(Settings(llm_api_key=None))

    async def collect_chunks() -> list[str]:
        return [chunk async for chunk in service.generate_diagnosis_stream(_build_result())]

    chunks = asyncio.run(collect_chunks())

    assert chunks == ["错误：未配置 LLM API Key，请检查后端 .env 配置。"]


def test_build_detection_summary_includes_measurements() -> None:
    service = LLMService(Settings(llm_api_key="test-key"))

    summary = service._build_detection_summary(_build_result())

    assert "病害1: crack" in summary
    assert "估计长度: 12.3mm" in summary
    assert "估计宽度: 1.20mm" in summary
    assert "面积: 18.6mm²" in summary


def test_format_error_message_mentions_base_url_for_invalid_key() -> None:
    service = LLMService(
        Settings(
            llm_api_key="test-key",
            llm_base_url="https://example.invalid/v1",
            llm_model_name="demo-model",
        )
    )

    message = service._format_error_message("Incorrect API key provided")

    assert "API Key 对该接口地址无效" in message
    assert "https://example.invalid/v1" in message
