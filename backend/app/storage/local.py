from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
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

    def upload_path(self, image_id: str) -> Path:
        return self.uploads_dir / image_id

    def save_json(self, *, image_id: str, payload: dict) -> str:
        destination = self.results_dir / f"{image_id}.json"
        destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return str(destination)

    def save_overlay(self, *, image_id: str, content: bytes) -> str:
        destination = self.overlays_dir / f"{image_id}.png"
        destination.write_bytes(content)
        return str(destination)

    def result_path(self, image_id: str) -> Path:
        return self.results_dir / f"{image_id}.json"

    def overlay_path(self, image_id: str) -> Path:
        return self.overlays_dir / f"{image_id}.png"

    def load_result(self, *, image_id: str) -> Optional[Dict[str, Any]]:
        destination = self.result_path(image_id)
        if not destination.exists():
            return None
        return json.loads(destination.read_text(encoding="utf-8"))

    def list_results(self, *, limit: int = 20) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        files = sorted(self.results_dir.glob("*.json"), reverse=True)
        for file_path in files:
            payload = json.loads(file_path.read_text(encoding="utf-8"))
            results.append(payload)
            if len(results) >= limit:
                break
        results.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        return results

    def delete_result_artifacts(self, *, image_id: str) -> None:
        for path in (
            self.result_path(image_id),
            self.upload_path(image_id),
            self.overlay_path(image_id),
        ):
            if path.exists():
                path.unlink()
