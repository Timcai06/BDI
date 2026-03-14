from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def create_test_client(tmp_path: Path, monkeypatch) -> TestClient:
    monkeypatch.setenv("BDI_ARTIFACT_ROOT", str(tmp_path / "artifacts"))
    return TestClient(create_app())


def test_list_results_returns_recent_saved_predictions(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    first = client.post(
        "/predict",
        files={"file": ("bridge-a.jpg", b"fake-jpeg-data", "image/jpeg")},
    )
    second = client.post(
        "/predict",
        files={"file": ("bridge-b.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"return_overlay": "true"},
    )

    assert first.status_code == 200
    assert second.status_code == 200

    response = client.get("/results")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 2
    assert payload["items"][0]["image_id"] == second.json()["image_id"]
    assert payload["items"][0]["detection_count"] == len(second.json()["detections"])
    assert payload["items"][0]["categories"]


def test_list_models_returns_registered_catalog(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("BDI_ARTIFACT_ROOT", str(tmp_path / "artifacts"))
    monkeypatch.setenv(
        "BDI_EXTRA_MODELS",
        '[{"model_version":"mock-v2","backend":"mock","runner_kind":"mock"}]',
    )
    client = TestClient(create_app())

    response = client.get("/models")

    assert response.status_code == 200
    payload = response.json()
    assert payload["active_version"] in {"mock-v1", "mock-v2"}
    assert payload["items"][0]["model_version"] == payload["active_version"]
    assert payload["items"][0]["is_active"] is True
    assert payload["items"][0]["is_available"] is True
    assert any(item["model_version"] == "mock-v1" for item in payload["items"])
    assert any(item["model_version"] == "mock-v2" for item in payload["items"])


def test_get_result_returns_saved_prediction_payload(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    predict_response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
    )

    image_id = predict_response.json()["image_id"]
    response = client.get(f"/results/{image_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["image_id"] == image_id
    assert payload["schema_version"] == "1.0.0"


def test_get_result_returns_not_found_for_unknown_result(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    response = client.get("/results/missing-image")

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "RESULT_NOT_FOUND"


def test_get_result_overlay_returns_png_file(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    predict_response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"return_overlay": "true"},
    )

    image_id = predict_response.json()["image_id"]
    response = client.get(f"/results/{image_id}/overlay")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content


def test_get_result_overlay_returns_not_found_when_missing(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    response = client.get("/results/missing-image/overlay")

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "OVERLAY_NOT_FOUND"


def test_get_result_image_returns_uploaded_file(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    predict_response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
    )

    image_id = predict_response.json()["image_id"]
    response = client.get(f"/results/{image_id}/image")

    assert response.status_code == 200
    assert response.content == b"fake-jpeg-data"


def test_get_result_image_returns_not_found_when_missing(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    response = client.get("/results/missing-image/image")

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "IMAGE_NOT_FOUND"


def test_delete_result_removes_saved_artifacts(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    predict_response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"return_overlay": "true"},
    )

    image_id = predict_response.json()["image_id"]

    response = client.delete(f"/results/{image_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["deleted"] is True
    assert payload["image_id"] == image_id

    assert client.get(f"/results/{image_id}").status_code == 404
    assert client.get(f"/results/{image_id}/image").status_code == 404
    assert client.get(f"/results/{image_id}/overlay").status_code == 404


def test_delete_result_returns_not_found_for_unknown_result(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    response = client.delete("/results/missing-image")

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "RESULT_NOT_FOUND"
