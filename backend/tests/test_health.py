from fastapi.testclient import TestClient

from app.main import create_app


def test_health_endpoint_returns_runtime_status() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "bridge-defect-api"
    assert payload["ready"] is True
    assert "active_runner" in payload
    assert "storage_root" in payload
    assert "details" in payload
    assert payload["details"]["ready"] is True


def test_health_options_request_includes_cors_headers() -> None:
    client = TestClient(create_app())

    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
