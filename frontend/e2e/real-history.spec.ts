import { expect, test } from "@playwright/test";

import {
  attachConsole,
  createProcessedBatchItemViaUi,
  uniqueToken,
} from "./helpers";

test.describe("real-mode history flow", () => {
  test("opens history, expands single-history view, and enters detail", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = uniqueToken();
    attachConsole(page, testInfo);
    await createProcessedBatchItemViaUi(page, request, suffix);

    await page.goto("/dashboard/history");
    await expect(page.getByRole("heading", { name: "历史记录" })).toBeVisible();
    await page.getByRole("button", { name: "查看单图历史" }).click();
    await expect(page.getByRole("heading", { name: "单图历史全局回顾" })).toBeVisible();

    const firstCard = page.locator("article").first();
    await expect(firstCard).toBeVisible({ timeout: 60_000 });
    await firstCard.click();

    await expect(page).toHaveURL(/\/dashboard\/history\/.+/);
    await expect(page.getByRole("heading", { name: "历史记录详情" })).toBeVisible();
    await expect(page.getByRole("button", { name: "结果图" })).toBeVisible();
  });
});
