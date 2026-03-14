import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { ResultDashboard } from "@/components/result-dashboard";
import { buildDemoResultForModelVersion, demoResult } from "@/lib/mock-data";

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
        comparisonResult={null}
        compareStatus={{ phase: "idle", message: "ready" }}
        compareModelVersion="mock-v2"
        compareOptions={[{ value: "mock-v2", label: "mock-v2" }]}
        categoryFilter="裂缝"
        minConfidence={0.9}
        previewUrl="/uploads/bridge-deck-demo.jpg"
        overlayPreviewUrl={demoResult.artifacts.overlay_path ?? null}
        comparisonPreviewUrl={null}
        comparisonOverlayPreviewUrl={null}
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
        onCompareModelVersionChange={() => {}}
        onRunComparison={() => {}}
        onClearComparison={() => {}}
        compareDisabled={false}
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
        comparisonResult={null}
        compareStatus={{ phase: "idle", message: "ready" }}
        compareModelVersion="mock-v2"
        compareOptions={[{ value: "mock-v2", label: "mock-v2" }]}
        categoryFilter="全部"
        minConfidence={0.3}
        previewUrl="/uploads/bridge-deck-demo.jpg"
        overlayPreviewUrl="/mock-artifacts/bridge-deck-demo-overlay.png"
        comparisonPreviewUrl={null}
        comparisonOverlayPreviewUrl={null}
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
        onCompareModelVersionChange={() => {}}
        onRunComparison={() => {}}
        onClearComparison={() => {}}
        compareDisabled={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "查看叠加图" }));

    expect(onViewModeChange).toHaveBeenCalledWith("overlay");
  });

  it("renders model comparison summary when a comparison result exists", () => {
    render(
      <ResultDashboard
        result={demoResult}
        comparisonResult={buildDemoResultForModelVersion("mock-v2")}
        compareStatus={{ phase: "success", message: "comparison-ready" }}
        compareModelVersion="mock-v2"
        compareOptions={[{ value: "mock-v2", label: "mock-v2" }]}
        categoryFilter="全部"
        minConfidence={0.3}
        previewUrl="/uploads/bridge-deck-demo.jpg"
        overlayPreviewUrl="/mock-artifacts/bridge-deck-demo-overlay.png"
        comparisonPreviewUrl="/uploads/bridge-deck-demo.jpg"
        comparisonOverlayPreviewUrl="/mock-artifacts/bridge-deck-demo-overlay.png"
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
        onCompareModelVersionChange={() => {}}
        onRunComparison={() => {}}
        onClearComparison={() => {}}
        rerunDisabled={false}
        compareDisabled={false}
      />
    );

    expect(screen.getByText("模型对比")).toBeInTheDocument();
    expect(screen.getByText("差异摘要")).toBeInTheDocument();
    expect(screen.getByText("图像级对比")).toBeInTheDocument();
    expect(screen.getByText("病害差异")).toBeInTheDocument();
    expect(screen.getByText("主模型更多")).toBeInTheDocument();
    expect(screen.getByText(/v1-demo vs mock-v2/i)).toBeInTheDocument();
  });
});
