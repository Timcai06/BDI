import { render, screen } from "@testing-library/react";

import { OpsPageHeader } from "@/components/ops/ops-page-header";

describe("OpsPageHeader", () => {
  it("renders eyebrow, title, subtitle and actions", () => {
    render(
      <OpsPageHeader
        eyebrow="SEARCH"
        title="病害检索"
        subtitle={
          <>
            CROSS-BATCH RETRIEVAL / <span className="font-mono">3 RESULTS</span>
          </>
        }
        actions={<button type="button">INVOKE SEARCH</button>}
      />,
    );

    expect(screen.getByText("SEARCH")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "病害检索" })).toBeInTheDocument();
    expect(screen.getByText(/CROSS-BATCH RETRIEVAL/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "INVOKE SEARCH" })).toBeInTheDocument();
  });
});
