from __future__ import annotations

from typing import Protocol

from app.models.schemas import PredictOptions, RawPrediction


class ModelRunner(Protocol):
    name: str
    ready: bool

    def predict(
        self,
        *,
        image_bytes: bytes,
        image_name: str,
        options: PredictOptions,
    ) -> RawPrediction:
        ...

    def warmup(self) -> None:
        """Optional: Perform a dummy inference to warm up GPU kernels."""
        ...

    def health_check(self) -> dict:
        """Optional: Return detailed health status."""
        ...

    def close(self) -> None:
        """Optional: Release resources (GPU memory, file handles)."""
        ...
