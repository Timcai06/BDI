from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from fastapi.testclient import TestClient
from PIL import Image
from app.main import create_app
from app.services.result_service import ResultService


def create_test_client(tmp_path: Path, monkeypatch) -> TestClient:
    monkeypatch.setenv("BDI_ARTIFACT_ROOT", str(tmp_path / "artifacts"))
    return TestClient(create_app())


def make_test_png_bytes(color: tuple[int, int, int] = (32, 48, 64)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (16, 16), color).save(buffer, format="PNG")
    return buffer.getvalue()


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
    assert "items" in payload
    assert "total" in payload
    assert "offset" in payload
    assert len(payload["items"]) == 2
    assert payload["total"] == 2
    assert payload["offset"] == 0
    assert payload["items"][0]["image_id"] == second.json()["image_id"]
    assert payload["items"][0]["detection_count"] == len(second.json()["detections"])
    assert payload["items"][0]["categories"]
    assert payload["items"][0]["has_diagnosis"] is False


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


def test_list_models_uses_runtime_active_version(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("BDI_ARTIFACT_ROOT", str(tmp_path / "artifacts"))
    client = TestClient(create_app())

    # Simulate stale state to ensure /models relies on runner_manager.resolve().
    client.app.state.model_registry.active_version = "v1"

    response = client.get("/models")

    assert response.status_code == 200
    payload = response.json()
    assert payload["active_version"] == "mock-v1"
    assert payload["items"][0]["model_version"] == "mock-v1"
    assert payload["items"][0]["is_active"] is True


def test_health_and_models_share_same_runtime_active_version(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("BDI_ARTIFACT_ROOT", str(tmp_path / "artifacts"))
    monkeypatch.setenv(
        "BDI_EXTRA_MODELS",
        '[{"model_version":"mock-v2","backend":"mock","runner_kind":"mock"}]',
    )
    client = TestClient(create_app())

    class DummyRunner:
        name = "mock-runner"
        ready = True

        @staticmethod
        def health_check():
            return {"marker": "ok"}

    spec = client.app.state.model_registry.get("mock-v2")
    client.app.state.predict_service.runner_manager.resolve = lambda *_: (spec, DummyRunner())

    health_response = client.get("/health")
    models_response = client.get("/models")

    assert health_response.status_code == 200
    assert models_response.status_code == 200
    health_payload = health_response.json()
    models_payload = models_response.json()
    assert health_payload["active_runner"].endswith(":mock-v2")
    assert models_payload["active_version"] == "mock-v2"
    assert models_payload["items"][0]["model_version"] == "mock-v2"
    assert models_payload["items"][0]["is_active"] is True


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


def test_predict_with_enhancement_exposes_secondary_result_metadata(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    class DummyEnhanceRunner:
        def enhance(self, img):
            return img

        @staticmethod
        def describe() -> dict[str, str]:
            return {
                "algorithm": "Img_Enhance",
                "pipeline": "dual_branch_fusion",
                "revised_weights": "best_psnr_revised.pth",
                "bridge_weights": "best_psnr_bridge.pth",
            }

    client.app.state.predict_service.enhance_runner = DummyEnhanceRunner()

    response = client.post(
        "/predict",
        files={"file": ("bridge.png", make_test_png_bytes(), "image/png")},
        data={"return_overlay": "true", "enhance": "true"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["result_variant"] == "original"
    assert payload["secondary_result"]["result_variant"] == "enhanced"
    assert payload["secondary_result"]["enhancement_info"]["algorithm"] == "Img_Enhance"
    assert payload["secondary_result"]["enhancement_info"]["pipeline"] == "dual_branch_fusion"
    assert payload["secondary_result"]["enhancement_info"]["revised_weights"] == "best_psnr_revised.pth"
    assert payload["secondary_result"]["enhancement_info"]["bridge_weights"] == "best_psnr_bridge.pth"


def test_get_result_returns_not_found_for_unknown_result(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    response = client.get("/results/missing-image")

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "RESULT_NOT_FOUND"


def test_get_result_diagnosis_returns_missing_when_not_generated(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    predict_response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
    )

    image_id = predict_response.json()["image_id"]
    response = client.get(f"/results/{image_id}/diagnosis")

    assert response.status_code == 200
    payload = response.json()
    assert payload["image_id"] == image_id
    assert payload["exists"] is False
    assert payload["content"] is None


def test_post_result_diagnosis_returns_cached_markdown_without_regeneration(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    predict_response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
    )

    image_id = predict_response.json()["image_id"]
    diagnosis_path = client.app.state.predict_service.store.diagnoses_dir / f"{image_id}.md"
    diagnosis_path.write_text("cached diagnosis", encoding="utf-8")

    response = client.post(f"/results/{image_id}/diagnosis")

    assert response.status_code == 200
    assert response.text == "cached diagnosis"


def test_list_results_marks_saved_diagnosis_in_summary(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    predict_response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"model_version": "mock-v1"},
    )

    image_id = predict_response.json()["image_id"]
    client.app.state.result_service.save_diagnosis(image_id=image_id, content="saved report")

    response = client.get("/results")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["image_id"] == image_id
    assert payload["items"][0]["has_diagnosis"] is True


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
    assert response.headers["content-type"] == "image/webp"
    assert response.content


def test_get_result_overlay_returns_not_found_when_missing(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    response = client.get("/results/missing-image/overlay")

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "OVERLAY_NOT_FOUND"


def test_get_result_image_falls_back_to_db_media_asset_path_for_batch_results(tmp_path: Path, monkeypatch) -> None:
    upload_bytes = b"batch-image-bytes"
    monkeypatch.setenv("BDI_ARTIFACT_ROOT", str(tmp_path / "artifacts"))
    app = create_app()
    store = app.state.predict_service.store
    upload_path = store.save_upload(image_id="med_test", content=upload_bytes)
    store.save_json(
        image_id="res_test",
        payload={
            "schema_version": "2.0.0",
            "image_id": "res_test",
            "batch_item_id": "bit_test",
            "model_name": "mock",
            "model_version": "mock-v1",
            "backend": "mock",
            "inference_mode": "direct",
            "inference_ms": 10,
            "inference_breakdown": {},
            "detections": [],
            "artifacts": {
                "upload_path": "",
                "json_path": "",
                "overlay_path": None,
                "enhanced_path": None,
                "enhanced_overlay_path": None,
            },
        },
    )
    class FakeResult:
        def first(self):
            return (upload_path,)

    class FakeSession:
        def execute(self, _query):
            return FakeResult()

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    service = ResultService(store=store, session_factory=lambda: FakeSession())

    resolved = service.get_upload_path(image_id="res_test")

    assert resolved.read_bytes() == upload_bytes


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


def test_batch_export_json_returns_zip_archive(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    predict_response = client.post(
        "/predict",
        files={"file": ("bridge.jpg", b"fake-jpeg-data", "image/jpeg")},
    )
    image_id = predict_response.json()["image_id"]

    response = client.post("/results/batch-export/json", json={"image_ids": [image_id]})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.headers["x-exported-count"] == "1"
    assert response.headers["x-skipped-count"] == "0"

    archive = ZipFile(BytesIO(response.content))
    names = archive.namelist()
    assert names == [f"{image_id}.json"]
    exported_payload = archive.read(names[0]).decode("utf-8")
    assert image_id in exported_payload


def test_batch_export_overlay_skips_missing_overlay_files(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    no_overlay_response = client.post(
        "/predict",
        files={"file": ("bridge-a.jpg", b"fake-jpeg-data", "image/jpeg")},
    )
    overlay_response = client.post(
        "/predict",
        files={"file": ("bridge-b.jpg", b"fake-jpeg-data", "image/jpeg")},
        data={"return_overlay": "true"},
    )

    response = client.post(
        "/results/batch-export/overlay",
        json={
            "image_ids": [
                no_overlay_response.json()["image_id"],
                overlay_response.json()["image_id"],
            ]
        },
    )

    assert response.status_code == 200
    assert response.headers["x-exported-count"] == "1"
    assert response.headers["x-skipped-count"] == "1"

    archive = ZipFile(BytesIO(response.content))
    names = archive.namelist()
    assert names == [f'{overlay_response.json()["image_id"]}.webp']


def test_batch_export_overlay_returns_not_found_when_nothing_is_exportable(tmp_path: Path, monkeypatch) -> None:
    client = create_test_client(tmp_path, monkeypatch)

    predict_response = client.post(
        "/predict",
        files={"file": ("bridge-a.jpg", b"fake-jpeg-data", "image/jpeg")},
    )

    response = client.post(
        "/results/batch-export/overlay",
        json={"image_ids": [predict_response.json()["image_id"]]},
    )

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "EXPORT_NOT_FOUND"
