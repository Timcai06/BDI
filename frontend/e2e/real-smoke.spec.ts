import { expect, test } from "@playwright/test";

import {
  FIXTURE_IMAGE_PATH,
  attachConsole,
  createBridgeViaUi,
  uniqueToken,
  waitForBatchIdByBridge,
  waitForBatchItemId,
  waitForBatchItemResult,
} from "./helpers";

test.describe("real-mode smoke flow", () => {
  test("creates bridge and batch, uploads an image, and opens item detail", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = uniqueToken();
    attachConsole(page, testInfo);
    const { bridgeId } = await createBridgeViaUi(page, request, suffix);
    await page.goto(`/dashboard/ops?bridgeId=${encodeURIComponent(bridgeId)}`);
    await expect(page).toHaveURL(/\/dashboard\/ops/);

    await page.getByTitle("新建批次").click();
    await expect(page.getByRole("heading", { name: "批次扫描属性" })).toBeVisible();

    await page.getByPlaceholder("例如：主桥上行 4 月无人机巡检").fill(`E2E 巡检 ${suffix}`);
    await page.getByRole("button", { name: "下一步流程" }).click();

    await expect(page.getByRole("heading", { name: "素材导入" })).toBeVisible();
    await page.locator("input[type='file']").setInputFiles(FIXTURE_IMAGE_PATH);
    await expect(page.getByText("已就绪：1 张原始影像")).toBeVisible();

    await page.getByRole("button", { name: "立即启动云端扫描" }).click();
    await expect(page.getByText(/上传完成：accepted=/)).toBeVisible({ timeout: 120_000 });

    const selectedBatchId = await waitForBatchIdByBridge(bridgeId, request);

    const itemId = await waitForBatchItemId(selectedBatchId!, request);
    await waitForBatchItemResult(itemId, request);
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
