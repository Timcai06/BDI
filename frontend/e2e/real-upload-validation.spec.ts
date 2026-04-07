import { expect, test } from "@playwright/test";

import { attachConsole, createBridgeViaUi, uniqueToken } from "./helpers";

test.describe("real-mode upload validation", () => {
  test("prevents empty batch upload and rejects invalid file types", async ({ page, request }, testInfo) => {
    attachConsole(page, testInfo);
    const { bridgeId } = await createBridgeViaUi(page, request, uniqueToken());

    await page.goto(`/dashboard/ops?bridgeId=${encodeURIComponent(bridgeId)}`);
    await page.getByTitle("新建批次").click();
    await page.getByRole("heading", { name: "批次扫描属性" }).waitFor();
    await page.getByRole("button", { name: "下一步流程" }).click();

    const submit = page.getByRole("button", { name: "立即启动云端扫描" });
    await expect(submit).toBeDisabled();

    await page.locator("input[type='file']").setInputFiles({
      name: "not-image.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("invalid upload"),
    });

    await expect(page.getByText(/至少选择一张图片后才能启动批次。|失败原因：/)).toBeHidden({ timeout: 1000 }).catch(() => {});
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText(/INVALID_IMAGE_FORMAT|INVALID_CONTENT_TYPE|失败原因：/)).toBeVisible({
      timeout: 30_000,
    });
  });
});
