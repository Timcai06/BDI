from __future__ import annotations

ALERT_LEVEL_ORDER = ["low", "medium", "high", "critical"]

ALERT_SLA_HOURS_BY_LEVEL = {
    "low": 72,
    "medium": 48,
    "high": 24,
    "critical": 12,
}

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}

MAX_BATCH_UPLOAD_FILES = 200

SCHEMA_VERSION = "2.0.0"

ENHANCEMENT_WEBP_QUALITY = 95


def next_alert_level(level: str) -> str:
    try:
        idx = ALERT_LEVEL_ORDER.index(level)
    except ValueError:
        return "critical"
    if idx >= len(ALERT_LEVEL_ORDER) - 1:
        return ALERT_LEVEL_ORDER[-1]
    return ALERT_LEVEL_ORDER[idx + 1]