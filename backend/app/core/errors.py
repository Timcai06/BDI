from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorPayload(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    error: ErrorPayload


class AppError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorPayload(code=exc.code, message=exc.message, details=exc.details)
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())
