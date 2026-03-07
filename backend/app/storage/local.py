from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4


class LocalArtifactStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.uploads_dir = self.root / "uploads"
        self.results_dir = self.root / "results"
        self.overlays_dir = self.root / "overlays"
        self.ensure_dirs()

    def ensure_dirs(self) -> None:
        for directory in (self.root, self.uploads_dir, self.results_dir, self.overlays_dir):
            directory.mkdir(parents=True, exist_ok=True)

    def build_image_id(self, original_name: str) -> str:
        safe_name = original_name.replace(" ", "-").lower()
        return f"{uuid4().hex[:8]}-{safe_name}"

    def save_upload(self, *, image_id: str, content: bytes) -> str:
        destination = self.uploads_dir / image_id
        destination.write_bytes(content)
        return str(destination)

    def save_json(self, *, image_id: str, payload: dict) -> str:
        destination = self.results_dir / f"{image_id}.json"
        destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return str(destination)
