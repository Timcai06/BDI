from pathlib import Path

from pydantic import BaseModel, Field


class Settings(BaseModel):
    app_name: str = "bridge-defect-api"
    app_version: str = "0.1.0"
    artifact_root: Path = Field(default=Path("artifacts"))
    max_upload_size_bytes: int = 10 * 1024 * 1024


def get_settings() -> Settings:
    return Settings()
