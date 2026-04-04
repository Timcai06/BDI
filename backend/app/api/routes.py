from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, Response

from app.core.runtime_state import refresh_runtime_state
from app.models.schemas import (
    BatchDeleteResultsRequest,
    BatchDeleteResultsResponse,
    DeleteResultResponse,
    DiagnosisResponse,
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
        refresh_runtime_state(
            runtime_state=runtime_state,
            spec=spec,
            runner=runner,
            resolution=resolution,
        )
    except Exception as exc:
        runtime_state.last_error = str(exc)

    return runtime_state


def _build_export_response(
    request: Request,
    *,
    image_ids: list[str],
    asset_type: str,
) -> Response:
    content, filename, exported_count, skipped_count = (
        request.app.state.result_service.export_results_archive(
            image_ids=image_ids,
            asset_type=asset_type,
        )
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
            supports_overlay=spec.supports_overlay,
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


@router.get("/results/{image_id}/enhanced")
async def get_enhanced_image(request: Request, image_id: str) -> FileResponse:
    image_path = request.app.state.result_service.get_enhanced_path(image_id=image_id)
    return FileResponse(image_path, filename=image_path.name)


@router.get("/results/{image_id}/enhanced-overlay")
async def get_enhanced_overlay(request: Request, image_id: str) -> FileResponse:
    overlay_path = request.app.state.result_service.get_enhanced_overlay_path(image_id=image_id)
    return FileResponse(overlay_path, media_type="image/webp", filename=overlay_path.name)


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
    return _build_export_response(
        request,
        image_ids=payload.image_ids,
        asset_type="json",
    )


@router.post("/results/batch-export/overlay")
async def batch_export_result_overlay(
    request: Request,
    payload: BatchDeleteResultsRequest,
) -> Response:
    return _build_export_response(
        request,
        image_ids=payload.image_ids,
        asset_type="overlay",
    )


@router.get("/results/{image_id}/diagnosis", response_model=DiagnosisResponse)
async def get_result_diagnosis(request: Request, image_id: str) -> DiagnosisResponse:
    """Return the saved diagnosis record only. This endpoint never triggers generation."""
    result_service = request.app.state.result_service
    return result_service.get_diagnosis_response(image_id=image_id)


@router.post("/results/{image_id}/diagnosis")
async def generate_result_diagnosis(
    request: Request,
    image_id: str,
    regenerate: bool = False,
):
    """
    Generate an expert diagnosis on demand and persist it to disk.
    If a cached report exists and regenerate is false, return the saved content directly.
    """
    from fastapi.responses import PlainTextResponse, StreamingResponse

    result_service = request.app.state.result_service
    llm_service = request.app.state.llm_service
    cached = result_service.get_cached_diagnosis(image_id=image_id)
    if cached and not regenerate:
        return PlainTextResponse(cached, media_type="text/plain; charset=utf-8")

    result = result_service.get_result(image_id=image_id)

    async def stream_and_save():
        full_content = []
        async for chunk in llm_service.generate_diagnosis_stream(result):
            full_content.append(chunk)
            yield chunk
        complete_text = "".join(full_content)
        if complete_text and not complete_text.startswith("错误：") and not complete_text.startswith("诊断生成失败"):
            result_service.save_diagnosis(image_id=image_id, content=complete_text)

    return StreamingResponse(
        stream_and_save(),
        media_type="text/event-stream"
    )
