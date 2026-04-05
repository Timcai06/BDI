from __future__ import annotations

from pathlib import Path

from app.adapters.enhancement_runner import DualBranchEnhanceRunner


def test_enhancement_runner_uses_weights_only_false_when_loading_checkpoints(monkeypatch) -> None:
    calls: list[tuple[Path, object, object]] = []

    def fake_torch_load(path, map_location=None, weights_only=None):  # noqa: ANN001
        calls.append((path, map_location, weights_only))
        return {
            "config": {"model": {}},
            "G": {},
            "G_ema": {},
        }

    class DummyGenerator:
        def __init__(self, **kwargs):  # noqa: ANN003
            self.kwargs = kwargs

        def to(self, device):  # noqa: ANN001
            return self

        def load_state_dict(self, state_dict, strict=True):  # noqa: ANN001
            return None

        def eval(self):
            return self

    monkeypatch.setattr("app.adapters.enhancement_runner.torch.load", fake_torch_load)
    monkeypatch.setattr("app.adapters.enhancement_runner.RevisedGenerator", DummyGenerator)
    monkeypatch.setattr("app.adapters.enhancement_runner.BridgeGenerator", DummyGenerator)

    runner = DualBranchEnhanceRunner(
        revised_weights_path="/tmp/revised.pth",
        bridge_weights_path="/tmp/bridge.pth",
        device="cpu",
    )

    assert runner.describe()["algorithm"] == "Img_Enhance"
    assert calls[0][2] is False
    assert calls[1][2] is False
