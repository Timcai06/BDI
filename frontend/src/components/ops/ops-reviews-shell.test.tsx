import { render, screen, waitFor } from "@testing-library/react";

import { OpsReviewsShell } from "@/components/ops/ops-reviews-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/ops/reviews",
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
  listV1Reviews: vi.fn(async () => ({
    items: [
      {
        id: "rev_1",
        detection_id: "det_1",
        batch_item_id: "bit_7",
        review_action: "confirm",
        review_decision: "confirm",
        reviewer: "ops-center",
        review_note: "verified",
        reviewed_at: "2026-04-05T10:00:00Z",
        created_at: "2026-04-05T09:55:00Z",
      },
    ],
    total: 1,
    limit: 200,
    offset: 0,
  })),
}));

describe("OpsReviewsShell", () => {
  it("links review cards to the real item detail route with returnTo context", async () => {
    render(<OpsReviewsShell />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "VIEW IMAGE" })).toBeInTheDocument();
    });

    const detailLink = screen.getByRole("link", { name: "VIEW IMAGE" });
    expect(detailLink).toHaveAttribute(
      "href",
      "/dashboard/ops/items/bit_7?returnTo=%2Fdashboard%2Fops%2Freviews",
    );
  });
});
