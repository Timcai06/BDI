import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

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

vi.mock("@/lib/predict-client", () => ({
  getDiagnosisText: vi.fn(async () => "mock diagnosis")
}));

describe("ResultDashboard", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  const baseProps = {
    compareStatus: { phase: "idle", message: "ready" } as const,
    compareModelVersion: "mock-v2",
    compareOptions: [{ value: "mock-v2", label: "mock-v2" }],
    previewUrl: "/uploads/bridge-deck-demo.jpg",
    overlayPreviewUrl: demoResult.artifacts.overlay_path ?? null,
    comparisonPreviewUrl: null,
    comparisonOverlayPreviewUrl: null,
    onViewModeChange: () => {},
    onExportJson: () => {},
    onExportOverlay: () => {},
    resultDisabled: false,
    maskDisabled: false,
    onSelectDetection: () => {},
    onOpenHistory: () => {},
    onReset: () => {},
    onRerun: () => {},
    rerunDisabled: false,
    onCompareModelVersionChange: () => {},
    onRunComparison: () => {},
    onClearComparison: () => {},
    compareDisabled: false,
    status: { phase: "success", message: "done" } as const,
    onCategoryFilterChange: () => {},
    onMinConfidenceChange: () => {},
    categories: ["裂缝", "破损"]
  };

  async function renderDashboard(
    overrideProps: Partial<React.ComponentProps<typeof ResultDashboard>> = {}
  ) {
    await act(async () => {
      render(
        <ResultDashboard
          result={demoResult}
          comparisonResult={null}
          {...baseProps}
          categoryFilter="全部"
          minConfidence={0.3}
          viewMode="image"
          selectedDetectionId={demoResult.detections[0]?.id ?? null}
          {...overrideProps}
        />
      );
      await Promise.resolve();
    });
  }

  it("only renders overlay markers that match the active filters", async () => {
    let container: HTMLElement;
    await act(async () => {
      const rendered = render(
        <ResultDashboard
          result={demoResult}
          comparisonResult={null}
          {...baseProps}
          categoryFilter="裂缝"
          minConfidence={0.9}
          viewMode="image"
          selectedDetectionId={demoResult.detections[0]?.id ?? null}
        />
      );
      container = rendered.container;
      await Promise.resolve();
    });

    expect(screen.getByText("1 项")).toBeInTheDocument();
    expect(screen.getAllByText(/裂缝/i).length).toBeGreaterThan(0);
    expect(container!.querySelectorAll(".cursor-crosshair")).toHaveLength(1);
  });

  it("switches between original image and result view", async () => {
    const onViewModeChange = vi.fn();

    await renderDashboard({
      overlayPreviewUrl: "/mock-artifacts/bridge-deck-demo-overlay.png",
      onViewModeChange: onViewModeChange
    });

    fireEvent.click(screen.getByRole("button", { name: "结果图" }));

    expect(onViewModeChange).toHaveBeenCalledWith("result");
  });

  it("renders model comparison summary when a comparison result exists", async () => {
    await renderDashboard({
      comparisonResult: buildDemoResultForModelVersion("mock-v2"),
      compareStatus: { phase: "success", message: "comparison-ready" },
      comparisonPreviewUrl: "/uploads/bridge-deck-demo.jpg",
      comparisonOverlayPreviewUrl: "/mock-artifacts/bridge-deck-demo-overlay.png"
    });

    expect(screen.getByText("模型对比")).toBeInTheDocument();
    expect(screen.getByText("差异摘要")).toBeInTheDocument();
    expect(screen.getByText("图像级对比")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开明细" }));
    expect(screen.getByText("病害差异")).toBeInTheDocument();
    expect(screen.getByText("主模型更多")).toBeInTheDocument();
    expect(screen.getAllByText(/v1-demo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/mock-v2/i).length).toBeGreaterThan(0);
  });

  it("jumps to the highest priority detection from the conclusion card", async () => {
    const onSelectDetection = vi.fn();

    await renderDashboard({
      selectedDetectionId: demoResult.detections[1]?.id ?? null,
      onSelectDetection
    });

    fireEvent.click(document.querySelector('[data-detection-id="det-crack-001"]') as HTMLElement);

    expect(onSelectDetection).toHaveBeenCalledWith(
      expect.objectContaining({ id: "det-crack-001" })
    );
    expect(screen.getByText("优先查看")).toBeInTheDocument();
  });
});
