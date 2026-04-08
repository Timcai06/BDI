import { expect, test } from "@playwright/test";

import {
  attachConsole,
  createAlertViaApi,
  createProcessedBatchItemViaUi,
  uniqueToken,
} from "./helpers";

test.describe("real-mode bridge detail flow", () => {
  test("opens bridge detail and shows recent batch plus open alert context", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = uniqueToken();
    attachConsole(page, testInfo);
    const seeded = await createProcessedBatchItemViaUi(page, request, suffix);

    if (!seeded.detectionId) {
      throw new Error("当前样本没有检测结果，无法创建桥梁详情告警种子。");
    }

    const alertTitle = `E2E_BRIDGE_ALERT_${suffix}`;
    await createAlertViaApi(request, {
      bridgeId: seeded.bridgeId,
      batchId: seeded.batchId,
      batchItemId: seeded.batchItemId,
      resultId: seeded.resultId,
      detectionId: seeded.detectionId,
      title: alertTitle,
    });

    await page.goto(`/dashboard/bridges/${encodeURIComponent(seeded.bridgeId)}`);
    await expect(page.getByRole("heading", { name: seeded.bridgeName })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(seeded.bridgeCode, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "最新巡检动态" })).toBeVisible();
    await expect(page.getByText(alertTitle)).toBeVisible({ timeout: 60_000 });

    await page.getByRole("link", { name: "批次中心" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/ops\\?bridgeId=${seeded.bridgeId}`));
    await expect(page.getByRole("heading", { name: "批次中心" })).toBeVisible();
  });
});
