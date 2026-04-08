import { expect, test } from "@playwright/test";

import {
  attachConsole,
  createAlertViaApi,
  createProcessedBatchItemViaUi,
  uniqueToken,
} from "./helpers";

test.describe("real-mode alerts flow", () => {
  test("loads seeded alerts and updates alert status from alerts center", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = uniqueToken();
    attachConsole(page, testInfo);
    const seeded = await createProcessedBatchItemViaUi(page, request, suffix);
    if (!seeded.detectionId) {
      throw new Error("当前样本没有检测结果，无法创建告警记录。");
    }

    const title = `E2E_ALERT_${suffix}`;
    await createAlertViaApi(request, {
      bridgeId: seeded.bridgeId,
      batchId: seeded.batchId,
      batchItemId: seeded.batchItemId,
      resultId: seeded.resultId,
      detectionId: seeded.detectionId,
      title,
    });

    await page.goto("/dashboard/ops/alerts");
    await expect(page.getByRole("heading", { name: "告警处理中心" })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible({ timeout: 60_000 });

    const alertCard = page.locator("h4", { hasText: title }).locator("..").locator("..").locator("..");
    await alertCard.getByRole("button", { name: "确认" }).click();
    await expect(alertCard.getByText("确认中")).toBeVisible({ timeout: 60_000 });

    await alertCard.getByRole("link").click();
    await expect(page).toHaveURL(/\/dashboard\/ops\/items\/.+/);
    await expect(page.getByRole("heading", { name: "病害详情" })).toBeVisible();
  });
});
