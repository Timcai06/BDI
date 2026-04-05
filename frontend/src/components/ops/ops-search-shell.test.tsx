import { render, screen, waitFor } from "@testing-library/react";

import { OpsSearchShell } from "@/components/ops/ops-search-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/ops/search",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/predict-client", () => ({
  listV1Batches: vi.fn(async () => ({
    items: [{ id: "bat_1", batch_code: "BATCH-1" }],
    total: 1,
    limit: 200,
    offset: 0,
  })),
  listV1Detections: vi.fn(async () => ({
    items: [
      {
        id: "det_1",
        batch_item_id: "bit_1",
        category: "crack",
        confidence: 0.92,
        is_valid: true,
        area_mm2: 12.5,
      },
    ],
    total: 1,
    limit: 200,
    offset: 0,
  })),
}));

describe("OpsSearchShell", () => {
  it("links detection cards to the real item detail route with returnTo context", async () => {
    render(<OpsSearchShell />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "VIEW ITEM DETAIL" })).toBeInTheDocument();
    });

    const detailLink = screen.getByRole("link", { name: "VIEW ITEM DETAIL" });
    expect(detailLink).toHaveAttribute(
      "href",
      "/dashboard/ops/items/bit_1?returnTo=%2Fdashboard%2Fops%2Fsearch",
    );
  });
});
