from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.adapters.manager import RunnerManager
from app.adapters.registry import ModelRegistry
from app.api.routes import router
from app.core.config import get_settings
from app.core.errors import AppError, ErrorPayload, ErrorResponse, app_error_handler
from app.core.runtime_state import RuntimeState
from app.models.schemas import HealthResponse
from app.services.predict_service import PredictService
from app.services.result_service import ResultService
from app.services.llm_service import LLMService
from app.storage.local import LocalArtifactStore


def create_app() -> FastAPI:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logger = logging.getLogger(__name__)

    settings = get_settings()
    store = LocalArtifactStore(settings.artifact_root)
    registry = ModelRegistry.from_settings(settings)
    runner_manager = RunnerManager(
        registry=registry,
        allow_fallback=settings.allow_mock_fallback,
        pixels_per_mm=settings.pixels_per_mm,
    )

    try:
        active_spec, active_runner = runner_manager.resolve()
        logger.info(
            "Primary runner loaded: %s:%s",
            active_runner.name,
            active_spec.model_version,
        )
    except Exception:
        logger.warning(
            "Primary runner failed to load — falling back to mock",
            exc_info=True,
        )
        active_spec, active_runner = runner_manager.resolve("mock-v1")
    predict_service = PredictService(
        store=store,
        runner_manager=runner_manager,
        max_upload_size_bytes=settings.max_upload_size_bytes,
    )
    result_service = ResultService(store=store)
    llm_service = LLMService(settings=settings)

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
    app.state.llm_service = llm_service
    app.state.model_registry = registry
    app.state.runtime_state = RuntimeState(
        active_model_version=active_spec.model_version,
        active_runner=f"{active_runner.name}:{active_spec.model_version}",
        ready=active_runner.ready,
        active_backend=active_spec.backend,
        last_transition_at=datetime.now(timezone.utc).isoformat(),
    )
    app.state.health_payload = HealthResponse(
        service=settings.app_name,
        version=settings.app_version,
        ready=active_runner.ready,
        active_runner=f"{active_runner.name}:{active_spec.model_version}",
        storage_root=str(store.root),
    )
    app.include_router(router)
    return app


app = create_app()
