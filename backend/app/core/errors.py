from typing import Any, Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

REQUEST_ID_HEADER = "X-Request-ID"


class ErrorPayload(BaseModel):
    code: str
    message: str
    details: Optional[dict[str, Any]] = None


class ErrorResponse(BaseModel):
    error: ErrorPayload


class AppError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def _build_error_response(request: Request, *, status_code: int, payload: ErrorResponse) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    headers = {REQUEST_ID_HEADER: request_id} if request_id else None
    return JSONResponse(status_code=status_code, content=payload.model_dump(), headers=headers)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    payload = ErrorResponse(error=ErrorPayload(code=exc.code, message=exc.message, details=exc.details))
    return _build_error_response(request, status_code=exc.status_code, payload=payload)
