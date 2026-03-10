from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse

from app.models.schemas import (
    DeleteResultResponse,
    HealthResponse,
    PredictOptions,
    PredictResponse,
    ResultListResponse,
)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    return request.app.state.health_payload


@router.post("/predict", response_model=PredictResponse)
async def predict(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    confidence: Annotated[float, Form()] = 0.25,
    iou: Annotated[float, Form()] = 0.45,
    inference_mode: Annotated[str, Form()] = "direct",
    model_version: Annotated[str, Form()] = "mock-v1",
    return_overlay: Annotated[bool, Form()] = False,
) -> PredictResponse:
    options = PredictOptions(
        confidence=confidence,
        iou=iou,
        inference_mode=inference_mode,
        model_version=model_version,
        return_overlay=return_overlay,
    )
    return await request.app.state.predict_service.predict(file=file, options=options)


@router.get("/results", response_model=ResultListResponse)
async def list_results(
    request: Request,
    limit: int = 20,
) -> ResultListResponse:
    return request.app.state.result_service.list_results(limit=limit)


@router.get("/results/{image_id}", response_model=PredictResponse)
async def get_result(request: Request, image_id: str) -> PredictResponse:
    return request.app.state.result_service.get_result(image_id=image_id)


@router.get("/results/{image_id}/overlay")
async def get_result_overlay(request: Request, image_id: str) -> FileResponse:
    overlay_path = request.app.state.result_service.get_overlay_path(image_id=image_id)
    return FileResponse(overlay_path, media_type="image/png", filename=overlay_path.name)


@router.get("/results/{image_id}/image")
async def get_result_image(request: Request, image_id: str) -> FileResponse:
    image_path = request.app.state.result_service.get_upload_path(image_id=image_id)
    return FileResponse(image_path, filename=image_path.name)


@router.delete("/results/{image_id}", response_model=DeleteResultResponse)
async def delete_result(request: Request, image_id: str) -> DeleteResultResponse:
    return request.app.state.result_service.delete_result(image_id=image_id)
