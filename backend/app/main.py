from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.adapters.enhancement_runner import DualBranchEnhanceRunner
from app.adapters.manager import RunnerManager
from app.adapters.registry import ModelRegistry
from app.api.routes import router
from app.api.v1_routes import router as v1_router
from app.core.config import get_settings
from app.core.errors import (
    REQUEST_ID_HEADER,
    AppError,
    ErrorPayload,
    ErrorResponse,
    app_error_handler,
)
from app.core.runtime_state import RuntimeState
from app.db.session import create_session_factory
from app.models.schemas import HealthResponse
from app.services.batch_service import BatchService
from app.services.llm_service import LLMService
from app.services.predict_service import PredictService
from app.services.result_service import ResultService
from app.services.task_service import TaskService
from app.services.task_worker import TaskWorker
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
    db_session_factory = create_session_factory(settings)

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

    enhance_runner = None
    if settings.enhance_enabled:
        try:
            enhance_runner = DualBranchEnhanceRunner(
                revised_weights_path=settings.enhance_revised_weights,
                bridge_weights_path=settings.enhance_bridge_weights,
                device=settings.model_device,
            )
        except Exception:
            logger.warning("Enhancement runner failed to load", exc_info=True)

    predict_service = PredictService(
        store=store,
        runner_manager=runner_manager,
        enhance_runner=enhance_runner,
        max_upload_size_bytes=settings.max_upload_size_bytes,
    )
    result_service = ResultService(store=store, session_factory=db_session_factory)
    llm_service = LLMService(settings=settings)
    batch_service = BatchService(
        session_factory=db_session_factory,
        store=store,
        max_upload_size_bytes=settings.max_upload_size_bytes,
        runner_manager=runner_manager,
    )
    task_service = TaskService(
        session_factory=db_session_factory,
        store=store,
        runner_manager=runner_manager,
        enhance_runner=enhance_runner,
        max_attempts=settings.task_max_attempts,
        task_lease_seconds=settings.task_lease_seconds,
        alert_auto_enabled=settings.alert_auto_enabled,
        alert_count_threshold=settings.alert_count_threshold,
        alert_category_watchlist=settings.alert_category_watchlist,
        alert_category_confidence_threshold=settings.alert_category_confidence_threshold,
    )
    batch_service.set_alert_sla_hours_by_level(task_service.alert_sla_hours_by_level)
    task_worker = TaskWorker(
        task_service=task_service,
        poll_interval_seconds=settings.task_worker_interval_seconds,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        recovered = task_service.recover_stale_tasks()
        if recovered > 0:
            logger.warning("Recovered %s stale running tasks during startup.", recovered)
        if settings.task_worker_enabled:
            await task_worker.start()
        try:
            yield
        finally:
            await task_worker.stop()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(AppError, app_error_handler)

    @app.middleware("http")
    async def request_tracking_middleware(request: Request, call_next):
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid4().hex[:12]
        request.state.request_id = request_id
        started_at = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        response.headers[REQUEST_ID_HEADER] = request_id
        response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.2f}"
        logger.info(
            "request_id=%s method=%s path=%s status=%s duration_ms=%.2f",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response

    @app.exception_handler(RequestValidationError)
    async def request_validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        payload = ErrorResponse(
            error=ErrorPayload(
                code="INVALID_REQUEST",
                message="Request validation failed.",
                details={"errors": exc.errors()},
            )
        )
        request_id = getattr(request.state, "request_id", None)
        headers = {REQUEST_ID_HEADER: request_id} if request_id else None
        return JSONResponse(status_code=422, content=payload.model_dump(), headers=headers)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.exception(
            "Unhandled exception: request_id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
            exc_info=exc,
        )
        payload = ErrorResponse(
            error=ErrorPayload(
                code="INTERNAL_ERROR",
                message="Internal server error.",
            )
        )
        headers = {REQUEST_ID_HEADER: request_id} if request_id else None
        return JSONResponse(status_code=500, content=payload.model_dump(), headers=headers)

    app.state.predict_service = predict_service
    app.state.result_service = result_service
    app.state.llm_service = llm_service
    app.state.model_registry = registry
    app.state.batch_service = batch_service
    app.state.task_service = task_service
    app.state.task_worker = task_worker
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
    app.state.db_session_factory = db_session_factory
    app.state.database_url = settings.database_url
    app.include_router(router)
    app.include_router(v1_router)

    return app


app = create_app()
