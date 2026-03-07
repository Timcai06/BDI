from fastapi.testclient import TestClient

from app.main import create_app


def test_health_endpoint_returns_runtime_status() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["ready"] is True
    assert payload["active_runner"] == "mock-runner"
