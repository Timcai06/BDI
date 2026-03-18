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
    assert payload["artifacts"]["overlay_path"].endswith(".webp")


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


def test_predict_accepts_25mb_png_by_default() -> None:
    client = TestClient(create_app())
    content = b"0" * (25 * 1024 * 1024)

    response = client.post(
        "/predict",
        files={"file": ("bridge.png", content, "image/png")},
        data={"confidence": "0.35", "model_version": "mock-v1"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["image_id"]


def test_predict_returns_model_runtime_error_when_runner_raises() -> None:
    client = TestClient(create_app())

    class BrokenRunner:
        def __init__(self) -> None:
            self.name = "broken-runner"
            self.ready = False

        def predict(self, **_) -> None:
            raise RuntimeError("runner boom")

    registry = client.app.state.model_registry
    spec = registry.get("mock-v1")
    client.app.state.predict_service.runner_manager.resolve = lambda *_: (spec, BrokenRunner())

    response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"model_version": "mock-v1"},
    )

    assert response.status_code == 503
    payload = response.json()
    assert payload["error"]["code"] == "MODEL_RUNTIME_ERROR"


def test_predict_returns_model_timeout_error_when_runner_times_out() -> None:
    client = TestClient(create_app())

    class TimeoutRunner:
        def __init__(self) -> None:
            self.name = "timeout-runner"
            self.ready = False

        def predict(self, **_) -> None:
            raise TimeoutError("timeout")

    registry = client.app.state.model_registry
    spec = registry.get("mock-v1")
    client.app.state.predict_service.runner_manager.resolve = lambda *_: (spec, TimeoutRunner())

    response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"model_version": "mock-v1"},
    )

    assert response.status_code == 504
    payload = response.json()
    assert payload["error"]["code"] == "MODEL_TIMEOUT"


def test_predict_returns_model_output_invalid_when_runner_output_is_bad() -> None:
    client = TestClient(create_app())

    class InvalidOutputRunner:
        def __init__(self) -> None:
            self.name = "invalid-output-runner"
            self.ready = False

        def predict(self, **_) -> None:
            raise ValueError("invalid output")

    registry = client.app.state.model_registry
    spec = registry.get("mock-v1")
    client.app.state.predict_service.runner_manager.resolve = lambda *_: (spec, InvalidOutputRunner())

    response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"model_version": "mock-v1"},
    )

    assert response.status_code == 502
    payload = response.json()
    assert payload["error"]["code"] == "MODEL_OUTPUT_INVALID"


def test_predict_rejects_overlay_for_model_without_mask_capability() -> None:
    client = TestClient(create_app())

    class DummyRunner:
        def __init__(self) -> None:
            self.name = "dummy-runner"
            self.ready = True

        def predict(self, **_):
            raise AssertionError("predict should not be called when capability check fails")

    spec = client.app.state.model_registry.get("mock-v1").model_copy(
        update={"supports_masks": False}
    )
    client.app.state.predict_service.runner_manager.resolve = lambda *_: (spec, DummyRunner())

    response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"model_version": "mock-v1", "return_overlay": "true"},
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["error"]["code"] == "MODEL_CAPABILITY_UNSUPPORTED"
