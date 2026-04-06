from fastapi.testclient import TestClient

from app.main import create_app


def test_success_response_includes_request_tracing_headers() -> None:
    app = create_app()
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["x-request-id"]
    assert response.headers["x-process-time-ms"]


def test_validation_error_keeps_standard_error_shape_and_request_id() -> None:
    app = create_app()
    client = TestClient(app)

    response = client.post("/predict")

    assert response.status_code == 422
    assert response.headers["x-request-id"]
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_unhandled_exception_returns_internal_error_with_request_id() -> None:
    app = create_app()

    @app.get("/__test__/boom")
    def boom():
        raise RuntimeError("boom")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/__test__/boom")

    assert response.status_code == 500
    assert response.headers["x-request-id"]
    payload = response.json()
    assert payload["error"]["code"] == "INTERNAL_ERROR"
    assert payload["error"]["message"] == "Internal server error."
