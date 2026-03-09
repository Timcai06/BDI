import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { HistoryPanel } from "@/components/history-panel";

describe("HistoryPanel", () => {
  it("renders history items and lets the user select one", () => {
    const onSelect = vi.fn();

    render(
      <HistoryPanel
        items={[
          {
            image_id: "bridge-001.jpg",
            created_at: "2026-03-09T10:00:00Z",
            model_name: "yolov8-seg",
            model_version: "v1-real",
            backend: "pytorch",
            inference_mode: "direct",
            inference_ms: 231,
            detection_count: 3,
            artifacts: {
              upload_path: "uploads/bridge-001.jpg",
              json_path: "results/bridge-001.json",
              overlay_path: "overlays/bridge-001.png"
            }
          }
        ]}
        loading={false}
        errorMessage={null}
        onRefresh={() => {}}
        onOpenUploader={() => {}}
        onSelect={onSelect}
        getImageUrl={() => null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /bridge-001.jpg/i }));

    expect(onSelect).toHaveBeenCalledWith("bridge-001.jpg");
  });
});
