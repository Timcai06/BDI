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
