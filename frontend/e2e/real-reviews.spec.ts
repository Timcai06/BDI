import { expect, test } from "@playwright/test";

import {
  attachConsole,
  createProcessedBatchItemViaUi,
  createReviewViaApi,
  uniqueToken,
} from "./helpers";

test.describe("real-mode reviews flow", () => {
  test("loads seeded review records and opens detail from reviews", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = uniqueToken();
    attachConsole(page, testInfo);
    const seeded = await createProcessedBatchItemViaUi(page, request, suffix);
    if (!seeded.detectionId) {
      throw new Error("当前样本没有检测结果，无法创建复核记录。");
    }

    const reviewer = `e2e-reviewer-${suffix}`;
    await createReviewViaApi(request, {
      detectionId: seeded.detectionId,
      reviewer,
      reviewNote: `review note ${suffix}`,
    });

    await page.goto(`/dashboard/ops/reviews?reviewer=${encodeURIComponent(reviewer)}`);
    await expect(page.getByRole("heading", { name: "复核中心" })).toBeVisible();
    await expect(page.getByText(`Review by ${reviewer}`)).toBeVisible({ timeout: 60_000 });

    await page.getByRole("link", { name: "VIEW IMAGE" }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/ops\/items\/.+/);
    await expect(page.getByRole("heading", { name: "病害详情" })).toBeVisible();
  });
});
