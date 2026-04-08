import { expect, test } from "@playwright/test";

import {
  attachConsole,
  createProcessedBatchItemViaUi,
  uniqueToken,
} from "./helpers";

test.describe("real-mode smoke flow", () => {
  test("creates bridge and batch, uploads an image, and opens item detail", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = uniqueToken();
    attachConsole(page, testInfo);
    const { batchId: selectedBatchId, batchItemId: itemId, bridgeId } = await createProcessedBatchItemViaUi(page, request, suffix);
    await expect(page.getByText("素材列表")).toBeVisible();

    const detailPath =
      `/dashboard/ops/items/${encodeURIComponent(itemId)}` +
      `?returnTo=${encodeURIComponent(`/dashboard/ops?bridgeId=${bridgeId}&batchId=${selectedBatchId ?? ""}`)}`;
    await page.goto(detailPath);

    await expect(page.getByRole("heading", { name: "病害详情" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByAltText("分析视图")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("检出列表")).toBeVisible();
    await expect(
      page.locator("button").filter({ hasText: /^(增强|查看增强|回看原图|增强中\.\.\.)$/ }),
    ).toBeVisible();
  });
});
