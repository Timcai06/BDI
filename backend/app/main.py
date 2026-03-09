from __future__ import annotations

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.adapters.factory import load_runner
from app.api.routes import router
from app.core.config import get_settings
from app.core.errors import AppError, ErrorPayload, ErrorResponse, app_error_handler
from app.models.schemas import HealthResponse
from app.services.predict_service import PredictService
from app.services.result_service import ResultService
from app.storage.local import LocalArtifactStore


def create_app() -> FastAPI:
    settings = get_settings()
    store = LocalArtifactStore(settings.artifact_root)
    runner = load_runner(settings)
    predict_service = PredictService(
        store=store,
        runner=runner,
        max_upload_size_bytes=settings.max_upload_size_bytes,
    )
    result_service = ResultService(store=store)

    app = FastAPI(title=settings.app_name, version=settings.app_version)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(AppError, app_error_handler)

    @app.exception_handler(RequestValidationError)
    async def request_validation_error_handler(_, exc: RequestValidationError) -> JSONResponse:
        payload = ErrorResponse(
            error=ErrorPayload(
                code="INVALID_REQUEST",
                message="Request validation failed.",
                details={"errors": exc.errors()},
            )
        )
        return JSONResponse(status_code=422, content=payload.model_dump())

    app.state.predict_service = predict_service
    app.state.result_service = result_service
    app.state.health_payload = HealthResponse(
        service=settings.app_name,
        version=settings.app_version,
        ready=runner.ready,
        active_runner=runner.name,
        storage_root=str(store.root),
    )
    app.include_router(router)
    return app


app = create_app()
