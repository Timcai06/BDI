from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, Response

from app.models.schemas import (
    BatchDeleteResultsRequest,
    BatchDeleteResultsResponse,
    DeleteResultResponse,
    HealthResponse,
    ModelCatalogItem,
    ModelCatalogResponse,
    PredictOptions,
    PredictResponse,
    ResultListResponse,
)

router = APIRouter()


def _refresh_runtime_state(request: Request):
    predict_service = request.app.state.predict_service
    runtime_state = request.app.state.runtime_state

    try:
        spec, runner = predict_service.runner_manager.resolve()
        resolution = getattr(predict_service.runner_manager, "last_resolution", {})
        details = {}
        if hasattr(runner, "health_check"):
            details = runner.health_check()

        changed = runtime_state.active_model_version != spec.model_version
        runtime_state.active_model_version = spec.model_version
        runtime_state.active_runner = f"{runner.name}:{spec.model_version}"
        runtime_state.active_backend = spec.backend
        runtime_state.ready = runner.ready
        runtime_state.details = details
        runtime_state.fallback_from = resolution.get("fallback_from")
        runtime_state.last_load_ms = resolution.get("load_ms")
        runtime_state.cache_hit = resolution.get("cache_hit")
        if changed:
            runtime_state.last_transition_at = datetime.now(timezone.utc).isoformat()
        runtime_state.last_error = None
    except Exception as exc:
        runtime_state.last_error = str(exc)

    return runtime_state


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    runtime_state = _refresh_runtime_state(request)
    details = dict(runtime_state.details)
    details["active_backend"] = runtime_state.active_backend
    details["fallback_from"] = runtime_state.fallback_from
    details["last_transition_at"] = runtime_state.last_transition_at
    details["last_load_ms"] = runtime_state.last_load_ms
    details["cache_hit"] = runtime_state.cache_hit
    if runtime_state.last_error:
        details["last_error"] = runtime_state.last_error

    return HealthResponse(
        service=request.app.state.health_payload.service,
        version=request.app.state.health_payload.version,
        ready=runtime_state.ready,
        active_runner=runtime_state.active_runner,
        storage_root=request.app.state.health_payload.storage_root,
        details=details,
    )


@router.get("/models", response_model=ModelCatalogResponse)
async def list_models(request: Request) -> ModelCatalogResponse:
    runtime_state = _refresh_runtime_state(request)
    registry = request.app.state.model_registry
    active_model_version = runtime_state.active_model_version or registry.active_version

    items = [
        ModelCatalogItem(
            model_name=spec.model_name,
            model_version=spec.model_version,
            backend=spec.backend,
            supports_masks=spec.supports_masks,
            supports_sliced_inference=spec.supports_sliced_inference,
            is_active=spec.model_version == active_model_version,
            is_available=spec.is_available,
        )
        for spec in registry.list_specs()
    ]
    items.sort(key=lambda item: (not item.is_active, item.model_version))
    return ModelCatalogResponse(active_version=active_model_version, items=items)


@router.post("/predict", response_model=PredictResponse)
async def predict(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    confidence: Annotated[float, Form()] = 0.25,
    iou: Annotated[float, Form()] = 0.45,
    inference_mode: Annotated[str, Form()] = "direct",
    model_version: Annotated[Optional[str], Form()] = None,
    return_overlay: Annotated[bool, Form()] = False,
    pixels_per_mm: Annotated[float, Form()] = 10.0,
) -> PredictResponse:
    options = PredictOptions(
        confidence=confidence,
        iou=iou,
        inference_mode=inference_mode,
        model_version=model_version,
        return_overlay=return_overlay,
        pixels_per_mm=pixels_per_mm,
    )
    return await request.app.state.predict_service.predict(file=file, options=options)


@router.get("/results", response_model=ResultListResponse)
async def list_results(
    request: Request,
    limit: int = 20,
    offset: int = 0,
) -> ResultListResponse:
    return request.app.state.result_service.list_results(limit=limit, offset=offset)


@router.get("/results/{image_id}", response_model=PredictResponse)
async def get_result(request: Request, image_id: str) -> PredictResponse:
    return request.app.state.result_service.get_result(image_id=image_id)


@router.get("/results/{image_id}/overlay")
async def get_result_overlay(request: Request, image_id: str) -> FileResponse:
    overlay_path = request.app.state.result_service.get_overlay_path(image_id=image_id)
    return FileResponse(overlay_path, media_type="image/webp", filename=overlay_path.name)


@router.get("/results/{image_id}/image")
async def get_result_image(request: Request, image_id: str) -> FileResponse:
    image_path = request.app.state.result_service.get_upload_path(image_id=image_id)
    return FileResponse(image_path, filename=image_path.name)


@router.delete("/results/{image_id}", response_model=DeleteResultResponse)
async def delete_result(request: Request, image_id: str) -> DeleteResultResponse:
    return request.app.state.result_service.delete_result(image_id=image_id)


@router.post("/results/batch-delete", response_model=BatchDeleteResultsResponse)
async def batch_delete_results(
    request: Request,
    payload: BatchDeleteResultsRequest,
) -> BatchDeleteResultsResponse:
    return request.app.state.result_service.batch_delete_results(image_ids=payload.image_ids)


@router.post("/results/batch-export/json")
async def batch_export_result_json(
    request: Request,
    payload: BatchDeleteResultsRequest,
) -> Response:
    content, filename, exported_count, skipped_count = request.app.state.result_service.export_results_archive(
        image_ids=payload.image_ids,
        asset_type="json",
    )
    return Response(
        content=content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Exported-Count": str(exported_count),
            "X-Skipped-Count": str(skipped_count),
        },
    )


@router.post("/results/batch-export/overlay")
async def batch_export_result_overlay(
    request: Request,
    payload: BatchDeleteResultsRequest,
) -> Response:
    content, filename, exported_count, skipped_count = request.app.state.result_service.export_results_archive(
        image_ids=payload.image_ids,
        asset_type="overlay",
    )
    return Response(
        content=content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Exported-Count": str(exported_count),
            "X-Skipped-Count": str(skipped_count),
        },
    )


@router.get("/results/{image_id}/diagnosis")
async def get_result_diagnosis(request: Request, image_id: str):
    """
    根据识别结果调用 LLM 生成专家诊断（流式返回）。
    首次调用将持久化到磁盘，后续请求直接返回缓存结果。
    """
    from fastapi.responses import PlainTextResponse, StreamingResponse

    result_service = request.app.state.result_service
    llm_service = request.app.state.llm_service

    # 1. 检查磁盘缓存
    cached = result_service.get_cached_diagnosis(image_id=image_id)
    if cached:
        return PlainTextResponse(cached, media_type="text/plain; charset=utf-8")

    # 2. 获取已有的识别结果
    result = result_service.get_result(image_id=image_id)

    # 3. 调用 LLM 服务生成流式输出，同时收集完整文本以便持久化
    async def stream_and_save():
        full_content = []
        async for chunk in llm_service.generate_diagnosis_stream(result):
            full_content.append(chunk)
            yield chunk
        # 流式输出完成后将完整文本持久化到磁盘
        complete_text = "".join(full_content)
        if complete_text and not complete_text.startswith("错误：") and not complete_text.startswith("诊断生成失败"):
            result_service.save_diagnosis(image_id=image_id, content=complete_text)

    return StreamingResponse(
        stream_and_save(),
        media_type="text/event-stream"
    )
