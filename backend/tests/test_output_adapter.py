from __future__ import annotations

from types import SimpleNamespace

from app.adapters.output_adapter import UltralyticsOutputAdapter


class _FakeTensor:
    def __init__(self, value):
        self._value = value

    def cpu(self):
        return self

    def tolist(self):
        return self._value


class _FakeBoxes(SimpleNamespace):
    def __len__(self) -> int:
        return len(self.xyxy.tolist())


class _FakePoint:
    def __init__(self, x: float, y: float) -> None:
        self._point = [x, y]

    def tolist(self):
        return self._point


def _build_result(category_name: str = "Spalling"):
    return SimpleNamespace(
        names={0: category_name},
        boxes=_FakeBoxes(
            xyxy=_FakeTensor([[1.0, 2.0, 11.0, 22.0]]),
            conf=_FakeTensor([0.92]),
            cls=_FakeTensor([0.0]),
        ),
        masks=SimpleNamespace(
            xy=[
                [_FakePoint(1, 2), _FakePoint(11, 2), _FakePoint(11, 22), _FakePoint(1, 22)],
            ]
        ),
    )


def test_output_adapter_normalizes_categories_via_schema_validation() -> None:
    adapted = UltralyticsOutputAdapter().adapt(_build_result("Spalling"))

    assert len(adapted) == 1
    assert adapted[0].category == "breakage"


def test_output_adapter_handles_empty_box_results() -> None:
    result = SimpleNamespace(names={}, boxes=[], masks=None)
    adapted = UltralyticsOutputAdapter().adapt(result)

    assert adapted == []


def test_output_adapter_raises_on_inconsistent_result_lengths() -> None:
    result = SimpleNamespace(
        names={0: "crack"},
        boxes=_FakeBoxes(
            xyxy=_FakeTensor([[1.0, 2.0, 11.0, 22.0]]),
            conf=_FakeTensor([0.92, 0.75]),
            cls=_FakeTensor([0.0]),
        ),
        masks=None,
    )

    try:
        UltralyticsOutputAdapter().adapt(result)
    except RuntimeError as exc:
        assert "length mismatch" in str(exc)
    else:
        raise AssertionError("Expected RuntimeError for inconsistent output lengths")
