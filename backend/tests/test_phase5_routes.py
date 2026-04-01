from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.schemas import (
    AlertListResponse,
    AlertResponse,
    BatchCreateResponse,
    BatchIngestResponse,
    BatchItemDetailResponse,
    BatchItemListResponse,
    BatchItemResponse,
    BatchItemResultResponse,
    BatchListResponse,
    BatchResponse,
    BatchStatsResponse,
    BridgeListResponse,
    BridgeResponse,
    DetectionListResponse,
    DetectionRecordResponse,
    MediaAssetResponse,
    ReviewListResponse,
    ReviewRecordResponse,
    ResultDetectionResponse,
    TaskProcessResponse,
    TaskResponse,
    TaskRetryResponse,
)


class StubBatchService:
    def __init__(self) -> None:
        now = datetime.now(timezone.utc)
        self.bridge = BridgeResponse(
            id="br_1",
            bridge_code="B-001",
            bridge_name="Bridge 1",
            status="active",
            created_at=now,
            updated_at=now,
        )
        self.batch = BatchResponse(
            id="bat_1",
            bridge_id="br_1",
            batch_code="batch-1",
            source_type="drone_image_stream",
            status="running",
            sealed=False,
            expected_item_count=10,
            received_item_count=1,
            queued_item_count=1,
            running_item_count=0,
            succeeded_item_count=0,
            failed_item_count=0,
            created_at=now,
            updated_at=now,
        )

    def create_bridge(self, _payload):
        return self.bridge

    def list_bridges(self, *, limit: int, offset: int):
        return BridgeListResponse(items=[self.bridge], total=1, limit=limit, offset=offset)

    def get_bridge(self, _bridge_id: str):
        return self.bridge

    def create_batch(self, _payload):
        return BatchCreateResponse.model_validate(self.batch.model_dump())

    def list_batches(self, *, limit: int, offset: int):
        return BatchListResponse(items=[self.batch], total=1, limit=limit, offset=offset)

    def get_batch(self, _batch_id: str):
        return self.batch

    async def ingest_items(self, **_kwargs):
        return BatchIngestResponse(batch_id="bat_1", accepted_count=0, rejected_count=0, items=[], errors=[])

    def list_batch_items(self, *, batch_id: str, limit: int, offset: int):
        now = datetime.now(timezone.utc)
        item = BatchItemResponse(
            id="bit_1",
            batch_id=batch_id,
            media_asset_id="med_1",
            sequence_no=1,
            processing_status="queued",
            review_status="unreviewed",
            latest_task_id="tsk_1",
            latest_result_id=None,
            defect_count=0,
            alert_status="none",
            created_at=now,
            updated_at=now,
        )
        return BatchItemListResponse(items=[item], total=1, limit=limit, offset=offset)

    def get_batch_stats(self, *, batch_id: str):
        return BatchStatsResponse(
            batch_id=batch_id,
            status_breakdown={"queued": 1},
            review_breakdown={"unreviewed": 1},
            category_breakdown={},
            alert_breakdown={"open": 0},
        )

    def get_batch_item_detail(self, *, batch_item_id: str):
        now = datetime.now(timezone.utc)
        item = BatchItemResponse(
            id=batch_item_id,
            batch_id="bat_1",
            media_asset_id="med_1",
            sequence_no=1,
            processing_status="succeeded",
            review_status="unreviewed",
            latest_task_id="tsk_1",
            latest_result_id="res_1",
            defect_count=1,
            alert_status="none",
            created_at=now,
            updated_at=now,
        )
        media = MediaAssetResponse(
            id="med_1",
            media_type="image",
            original_filename="a.jpg",
            storage_uri="/tmp/a.jpg",
            mime_type="image/jpeg",
            file_size_bytes=12,
            uploaded_at=now,
        )
        payload = item.model_dump()
        payload["media_asset"] = media.model_dump()
        return BatchItemDetailResponse.model_validate(payload)

    def get_batch_item_result(self, *, batch_item_id: str):
        now = datetime.now(timezone.utc)
        return BatchItemResultResponse(
            id="res_1",
            task_id="tsk_1",
            batch_item_id=batch_item_id,
            schema_version="2.0.0",
            model_name="m",
            model_version="v",
            backend="mock",
            inference_mode="direct",
            inference_ms=10,
            detection_count=1,
            has_masks=False,
            mask_detection_count=0,
            created_at=now,
            detections=[
                ResultDetectionResponse(
                    id="det_1",
                    category="crack",
                    confidence=0.9,
                    bbox={"x": 1.0, "y": 2.0, "width": 3.0, "height": 4.0},
                    metrics={"length_mm": 1.0, "width_mm": 2.0, "area_mm2": 3.0},
                )
            ],
        )

    def list_detections(
        self,
        *,
        batch_id: Optional[str],
        batch_item_id: Optional[str],
        category: Optional[str],
        min_confidence: Optional[float],
        max_confidence: Optional[float],
        min_area_mm2: Optional[float],
        is_valid: Optional[bool],
        sort_by: str,
        sort_order: str,
        limit: int,
        offset: int,
    ):
        now = datetime.now(timezone.utc)
        item = DetectionRecordResponse(
            id="det_1",
            result_id="res_1",
            batch_item_id=batch_item_id or "bit_1",
            category=category or "crack",
            confidence=min_confidence or 0.9,
            bbox_x=1.0,
            bbox_y=2.0,
            bbox_width=3.0,
            bbox_height=4.0,
            is_valid=True if is_valid is None else is_valid,
            created_at=now,
        )
        return DetectionListResponse(items=[item], total=1, limit=limit, offset=offset)

    def create_review(self, _payload):
        now = datetime.now(timezone.utc)
        return ReviewRecordResponse(
            id="rev_1",
            batch_item_id="bit_1",
            result_id="res_1",
            detection_id="det_1",
            review_action="confirm",
            review_decision="confirmed",
            reviewer="qa_user",
            reviewed_at=now,
            created_at=now,
        )

    def list_reviews(
        self,
        *,
        batch_id: Optional[str],
        batch_item_id: Optional[str],
        detection_id: Optional[str],
        reviewer: Optional[str],
        sort_by: str,
        sort_order: str,
        limit: int,
        offset: int,
    ):
        now = datetime.now(timezone.utc)
        item = ReviewRecordResponse(
            id="rev_1",
            batch_item_id=batch_item_id or "bit_1",
            result_id="res_1",
            detection_id=detection_id or "det_1",
            review_action="confirm",
            review_decision="confirmed",
            reviewer=reviewer or "qa_user",
            reviewed_at=now,
            created_at=now,
        )
        return ReviewListResponse(items=[item], total=1, limit=limit, offset=offset)

    def create_alert(self, payload):
        now = datetime.now(timezone.utc)
        return AlertResponse(
            id="alt_1",
            bridge_id=payload.bridge_id,
            batch_id=payload.batch_id,
            batch_item_id=payload.batch_item_id,
            result_id=payload.result_id,
            detection_id=payload.detection_id,
            event_type=payload.event_type,
            alert_level=payload.alert_level,
            status="open",
            title=payload.title,
            trigger_payload=payload.trigger_payload,
            triggered_at=now,
            note=payload.note,
            created_at=now,
            updated_at=now,
        )

    def list_alerts(
        self,
        *,
        batch_id: Optional[str],
        status_filter: Optional[str],
        event_type: Optional[str],
        sort_by: str,
        sort_order: str,
        limit: int,
        offset: int,
    ):
        now = datetime.now(timezone.utc)
        item = AlertResponse(
            id="alt_1",
            bridge_id="br_1",
            batch_id=batch_id or "bat_1",
            event_type=event_type or "count_exceeded",
            alert_level="medium",
            status=status_filter or "open",
            title="Alert title",
            trigger_payload={"count": 3},
            triggered_at=now,
            created_at=now,
            updated_at=now,
        )
        return AlertListResponse(items=[item], total=1, limit=limit, offset=offset)

    def update_alert_status(self, _alert_id: str, _payload):
        now = datetime.now(timezone.utc)
        return AlertResponse(
            id="alt_1",
            bridge_id="br_1",
            batch_id="bat_1",
            event_type="count_exceeded",
            alert_level="medium",
            status="acknowledged",
            title="Alert title",
            trigger_payload={"count": 3},
            triggered_at=now,
            acknowledged_by="reviewer",
            acknowledged_at=now,
            created_at=now,
            updated_at=now,
        )


class StubTaskService:
    def __init__(self) -> None:
        self.retry_called = False

    def get_task(self, _task_id: str):
        now = datetime.now(timezone.utc)
        return TaskResponse(
            id="tsk_1",
            batch_item_id="bit_1",
            task_type="inference",
            status="queued",
            attempt_no=1,
            priority=5,
            model_policy="fusion-default",
            inference_mode="direct",
            created_at=now,
            updated_at=now,
        )

    def process_next_queued_task(self):
        return TaskProcessResponse(processed=True, task_id="tsk_1", result_id="res_1")

    def retry_task(self, task_id: str, _payload):
        self.retry_called = True
        return TaskRetryResponse(old_task_id=task_id, new_task_id="tsk_2", status="queued")


def create_phase5_client() -> tuple[TestClient, StubTaskService]:
    app = create_app()
    app.state.batch_service = StubBatchService()
    task_service = StubTaskService()
    app.state.task_service = task_service
    return TestClient(app), task_service


def test_phase5_stats_endpoint_returns_payload() -> None:
    client, _ = create_phase5_client()

    response = client.get("/api/v1/batches/bat_1/stats")

    assert response.status_code == 200
    payload = response.json()
    assert payload["batch_id"] == "bat_1"
    assert payload["status_breakdown"]["queued"] == 1


def test_phase5_batch_item_result_endpoint_returns_detections() -> None:
    client, _ = create_phase5_client()

    response = client.get("/api/v1/batch-items/bit_1/result")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "res_1"
    assert payload["detections"][0]["category"] == "crack"


def test_phase5_retry_task_endpoint_returns_accepted_and_calls_service() -> None:
    client, task_service = create_phase5_client()

    response = client.post(
        "/api/v1/tasks/tsk_old/retry",
        json={"requested_by": "tester", "reason": "retry"},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["old_task_id"] == "tsk_old"
    assert payload["status"] == "queued"
    assert task_service.retry_called is True


def test_phase5_detections_endpoint_supports_filter() -> None:
    client, _ = create_phase5_client()

    response = client.get("/api/v1/detections", params={"category": "crack", "min_confidence": 0.8})

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["category"] == "crack"
    assert payload["items"][0]["confidence"] >= 0.8


def test_phase5_create_review_endpoint_returns_created_record() -> None:
    client, _ = create_phase5_client()

    response = client.post(
        "/api/v1/reviews",
        json={
            "detection_id": "det_1",
            "review_action": "confirm",
            "reviewer": "qa_user",
            "review_note": "looks good",
            "after_payload": {},
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["review_action"] == "confirm"
    assert payload["review_decision"] == "confirmed"


def test_phase5_alert_endpoints_create_and_update_status() -> None:
    client, _ = create_phase5_client()

    create_response = client.post(
        "/api/v1/alerts",
        json={
            "bridge_id": "br_1",
            "batch_id": "bat_1",
            "event_type": "count_exceeded",
            "alert_level": "medium",
            "title": "count alert",
            "trigger_payload": {"count": 3},
        },
    )
    assert create_response.status_code == 201
    assert create_response.json()["status"] == "open"

    update_response = client.post(
        "/api/v1/alerts/alt_1/status",
        json={"action": "acknowledge", "operator": "reviewer", "note": "received"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "acknowledged"
