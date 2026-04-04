from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4


class LocalArtifactStore:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.uploads_dir = self.root / "uploads"
        self.results_dir = self.root / "results"
        self.overlays_dir = self.root / "overlays"
        self.enhanced_dir = self.root / "enhanced"
        self.diagnoses_dir = self.root / "diagnoses"
        self.ensure_dirs()

    def ensure_dirs(self) -> None:
        for directory in (self.root, self.uploads_dir, self.results_dir, self.overlays_dir, self.enhanced_dir, self.diagnoses_dir):
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

    def delete_upload(self, image_id: str) -> None:
        path = self.upload_path(image_id)
        if path.exists():
            path.unlink()

    def save_json(self, *, image_id: str, payload: dict) -> str:
        destination = self.results_dir / f"{image_id}.json"
        tmp = destination.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.rename(destination)
        return str(destination)

    def save_overlay(self, *, image_id: str, content: bytes) -> str:
        destination = self.overlays_dir / f"{image_id}.webp"
        tmp = destination.with_suffix(".webp.tmp")
        tmp.write_bytes(content)
        tmp.rename(destination)
        return str(destination)

    def save_enhanced(self, *, image_id: str, content: bytes) -> str:
        destination = self.enhanced_dir / f"{image_id}.webp"
        tmp = destination.with_suffix(".webp.tmp")
        tmp.write_bytes(content)
        tmp.rename(destination)
        return str(destination)

    def save_enhanced_overlay(self, *, image_id: str, content: bytes) -> str:
        destination = self.overlays_dir / f"{image_id}_enhanced.webp"
        tmp = destination.with_suffix(".webp.tmp")
        tmp.write_bytes(content)
        tmp.rename(destination)
        return str(destination)

    def enhanced_path(self, image_id: str) -> Path:
        return self.enhanced_dir / f"{image_id}.webp"

    def enhanced_overlay_path(self, image_id: str) -> Path:
        return self.overlays_dir / f"{image_id}_enhanced.webp"

    def result_path(self, image_id: str) -> Path:
        return self.results_dir / f"{image_id}.json"

    def overlay_path(self, image_id: str) -> Path:
        return self.overlays_dir / f"{image_id}.webp"

    def diagnosis_path(self, image_id: str) -> Path:
        return self.diagnoses_dir / f"{image_id}.md"

    def save_diagnosis(self, *, image_id: str, content: str) -> str:
        destination = self.diagnosis_path(image_id)
        tmp = destination.with_suffix(".md.tmp")
        tmp.write_text(content, encoding="utf-8")
        tmp.rename(destination)
        return str(destination)

    def load_diagnosis(self, *, image_id: str) -> Optional[str]:
        destination = self.diagnosis_path(image_id)
        if not destination.exists():
            return None
        return destination.read_text(encoding="utf-8")

    def load_result(self, *, image_id: str) -> Optional[Dict[str, Any]]:
        destination = self.result_path(image_id)
        if not destination.exists():
            return None
        return json.loads(destination.read_text(encoding="utf-8"))

    def list_results(self, *, limit: int = 20, offset: int = 0) -> tuple[List[Dict[str, Any]], int]:
        files = sorted(
            self.results_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        total = len(files)
        
        results: List[Dict[str, Any]] = []
        # Slice files first before reading
        paged_files = files[offset : offset + limit]
        
        for file_path in paged_files:
            try:
                payload = json.loads(file_path.read_text(encoding="utf-8"))
                results.append(payload)
            except Exception:
                continue
                
        return results, total

    def delete_result_artifacts(self, *, image_id: str) -> None:
        for path in (
            self.result_path(image_id),
            self.upload_path(image_id),
            self.overlay_path(image_id),
            self.diagnosis_path(image_id),
        ):
            if path.exists():
                path.unlink()
