import { fireEvent, render, screen } from "@testing-library/react";

import { ComparisonWorkbench } from "@/components/result-dashboard-parts/comparison-workbench";
import { demoResult } from "@/lib/mock-data";

describe("ComparisonWorkbench", () => {
  it("renders the empty comparison state and triggers manual compare", () => {
    const onRunComparison = vi.fn();

    render(
      <ComparisonWorkbench
        alignmentStrength={0}
        categoryDiffItems={[]}
        comp={null}
        compareDisabled={false}
        compareModelVersion="mock-v2"
        compareOptions={[{ value: "mock-v2", label: "mock-v2" }]}
        compareStatus={{ phase: "idle", message: "ready" }}
        comparisonMetrics={null}
        comparisonRecommendation=""
        comparisonResult={null}
        comparisonSourceBreakdown={[]}
        comparisonSummary={null}
        comparisonViewMode="master"
        mainMetrics={{ totalLength: 0, totalArea: 0, count: 2, averageConfidence: 0.5 }}
        onClearComparison={() => {}}
        onCompareModelVersionChange={() => {}}
        onComparisonViewModeChange={() => {}}
        onRunComparison={onRunComparison}
        onToggleComparisonDetails={() => {}}
        result={demoResult}
        showComparisonDetails={false}
        sourceBreakdown={[]}
      />,
    );

    expect(screen.getByText("多模型交叉验证")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "启动深度对比分析" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "启动深度对比分析" }));

    expect(onRunComparison).toHaveBeenCalledTimes(1);
  });
});
