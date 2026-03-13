import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { ResultDashboard } from "@/components/result-dashboard";
import { demoResult } from "@/lib/mock-data";

/* eslint-disable @next/next/no-img-element */
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    unoptimized?: boolean;
  }) => {
    const { alt, fill, unoptimized, ...imgProps } = props;
    void fill;
    void unoptimized;
    return <img {...imgProps} alt={alt} />;
  }
}));

describe("ResultDashboard", () => {
  it("only renders overlay markers that match the active filters", () => {
    const { container } = render(
      <ResultDashboard
        result={demoResult}
        categoryFilter="裂缝"
        minConfidence={0.9}
        previewUrl="/uploads/bridge-deck-demo.jpg"
        overlayPreviewUrl={demoResult.artifacts.overlay_path ?? null}
        viewMode="image"
        onViewModeChange={() => {}}
        onExportJson={() => {}}
        onExportOverlay={() => {}}
        overlayDisabled={false}
        selectedDetectionId={demoResult.detections[0]?.id ?? null}
        onSelectDetection={() => {}}
        onOpenHistory={() => {}}
        onReset={() => {}}
        onRerun={() => {}}
        rerunDisabled={false}
      />
    );

    expect(screen.getByText("1 项")).toBeInTheDocument();
    expect(screen.getAllByText(/裂缝/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/剥落/i)).toHaveLength(0);
    expect(container.querySelectorAll(".cursor-crosshair")).toHaveLength(1);
  });

  it("switches between original image and overlay view", () => {
    const onViewModeChange = vi.fn();

    render(
      <ResultDashboard
        result={demoResult}
        categoryFilter="全部"
        minConfidence={0.3}
        previewUrl="/uploads/bridge-deck-demo.jpg"
        overlayPreviewUrl="/mock-artifacts/bridge-deck-demo-overlay.png"
        viewMode="image"
        onViewModeChange={onViewModeChange}
        onExportJson={() => {}}
        onExportOverlay={() => {}}
        overlayDisabled={false}
        selectedDetectionId={demoResult.detections[0]?.id ?? null}
        onSelectDetection={() => {}}
        onOpenHistory={() => {}}
        onReset={() => {}}
        onRerun={() => {}}
        rerunDisabled={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "查看叠加图" }));

    expect(onViewModeChange).toHaveBeenCalledWith("overlay");
  });
});
