import { expect, test } from "@playwright/test";

import { attachConsole } from "./helpers";

test.describe("real-mode settings flow", () => {
  test("loads settings, updates config, and restores the edited value", async ({
    page,
  }, testInfo) => {
    attachConsole(page, testInfo);

    await page.goto("/dashboard/ops/settings");
    await expect(page.getByRole("heading", { name: "全局配置与审计" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "告警规则管理" })).toBeVisible();

    const nearDueInput = page.locator("input[type='number']").first();
    await expect(nearDueInput).toBeVisible();

    const originalValue = await nearDueInput.inputValue();
    const nextValue = String(Number(originalValue) + 1);

    await nearDueInput.fill(nextValue);
    await page.getByRole("button", { name: "SYNC GLOBAL PREFERENCES" }).click();
    await expect(page.getByText("全局巡检配置已持久化")).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: /操作审计/i }).click();
    await expect(page.getByText("规则变更审计 / RULE AUDIT STREAM")).toBeVisible();

    await page.getByRole("button", { name: /配置管理/i }).click();
    await expect(nearDueInput).toHaveValue(nextValue);

    await nearDueInput.fill(originalValue);
    await page.getByRole("button", { name: "SYNC GLOBAL PREFERENCES" }).click();
    await expect(page.getByText("全局巡检配置已持久化")).toBeVisible({ timeout: 60_000 });
    await expect(nearDueInput).toHaveValue(originalValue);
  });
});
