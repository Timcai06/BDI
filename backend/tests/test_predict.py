from fastapi.testclient import TestClient

from app.main import create_app


def test_predict_returns_standardized_response_for_supported_image() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"confidence": "0.35", "model_version": "mock-v1"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["schema_version"] == "1.0.0"
    assert payload["model_name"] == "yolov8-seg"
    assert payload["model_version"] == "mock-v1"
    assert payload["backend"] == "mock"
    assert payload["artifacts"]["json_path"].endswith(".json")
    assert len(payload["detections"]) == 2
    assert payload["detections"][0]["category"] == "crack"


def test_predict_uses_active_model_version_when_not_provided() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"confidence": "0.35"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["model_version"] == "mock-v1"


def test_predict_saves_overlay_when_requested() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"return_overlay": "true"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["artifacts"]["overlay_path"].endswith(".png")


def test_predict_rejects_unsupported_extension() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/predict",
        files={"file": ("bridge.txt", b"not-an-image", "text/plain")},
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["error"]["code"] == "INVALID_IMAGE_FORMAT"


def test_predict_rejects_unknown_model_version() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"model_version": "unknown-v9"},
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["error"]["code"] == "UNKNOWN_MODEL_VERSION"


def test_predict_rejects_missing_file_field() -> None:
    client = TestClient(create_app())

    response = client.post("/predict", data={"confidence": "0.2"})

    assert response.status_code == 422
    payload = response.json()
    assert payload["error"]["code"] == "INVALID_REQUEST"
