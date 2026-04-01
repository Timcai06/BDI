from __future__ import annotations

import os
import subprocess
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url

from app.main import create_app


@pytest.fixture()
def pg_database_url() -> str:
    base_url = os.getenv("BDI_INTEGRATION_DATABASE_URL")
    if not base_url:
        pytest.skip("Set BDI_INTEGRATION_DATABASE_URL to run PostgreSQL integration tests.")

    url = make_url(base_url)
    if not url.database:
        pytest.skip("BDI_INTEGRATION_DATABASE_URL must include a database name.")

    temp_db = f"{url.database}_it_{uuid4().hex[:8]}"
    admin_url = url.set(database="postgres")

    try:
        with psycopg.connect(str(admin_url), autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(f'DROP DATABASE IF EXISTS "{temp_db}"')
                cur.execute(f'CREATE DATABASE "{temp_db}"')
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Cannot create temporary database: {exc}")

    test_url = str(url.set(database=temp_db))

    env = os.environ.copy()
    env["BDI_DATABASE_URL"] = test_url
    subprocess.run(
        ["../.venv-yolo/bin/python", "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        check=True,
    )

    try:
        yield test_url
    finally:
        try:
            with psycopg.connect(str(admin_url), autocommit=True) as conn:
                with conn.cursor() as cur:
                    cur.execute(f'DROP DATABASE IF EXISTS "{temp_db}"')
        except Exception:
            pass


def test_phase5_batch_task_result_chain_with_real_postgres(
    pg_database_url: str,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("BDI_DATABASE_URL", pg_database_url)
    monkeypatch.setenv("BDI_DATABASE_ECHO", "false")
    monkeypatch.setenv("BDI_TASK_WORKER_ENABLED", "false")
    monkeypatch.setenv("BDI_ARTIFACT_ROOT", str(tmp_path / "artifacts"))

    client = TestClient(create_app())

    bridge = client.post(
        "/api/v1/bridges",
        json={"bridge_code": f"B-{uuid4().hex[:6]}", "bridge_name": "Bridge Integration"},
    )
    assert bridge.status_code == 201
    bridge_id = bridge.json()["id"]

    batch = client.post(
        "/api/v1/batches",
        json={
            "bridge_id": bridge_id,
            "batch_code": f"batch-{uuid4().hex[:6]}",
            "source_type": "drone_image_stream",
            "expected_item_count": 1,
        },
    )
    assert batch.status_code == 201
    batch_id = batch.json()["id"]

    ingest = client.post(
        f"/api/v1/batches/{batch_id}/items",
        files=[("files", ("bridge.jpg", b"fake-jpeg-data", "image/jpeg"))],
        data={"model_policy": "fusion-default"},
    )
    assert ingest.status_code == 200
    ingest_payload = ingest.json()
    assert ingest_payload["accepted_count"] == 1
    task_id = ingest_payload["items"][0]["task_id"]
    batch_item_id = ingest_payload["items"][0]["batch_item_id"]

    process = client.post("/api/v1/tasks/process-next")
    assert process.status_code == 200

    task = client.get(f"/api/v1/tasks/{task_id}")
    assert task.status_code == 200
    task_payload = task.json()
    assert task_payload["status"] == "succeeded"

    item = client.get(f"/api/v1/batch-items/{batch_item_id}")
    assert item.status_code == 200
    assert item.json()["processing_status"] == "succeeded"

    result = client.get(f"/api/v1/batch-items/{batch_item_id}/result")
    assert result.status_code == 200
    result_payload = result.json()
    assert result_payload["batch_item_id"] == batch_item_id
    assert isinstance(result_payload["detections"], list)
    assert result_payload["detection_count"] == len(result_payload["detections"])

    stats = client.get(f"/api/v1/batches/{batch_id}/stats")
    assert stats.status_code == 200
    stats_payload = stats.json()
    assert stats_payload["batch_id"] == batch_id
    assert stats_payload["status_breakdown"].get("succeeded", 0) >= 1
