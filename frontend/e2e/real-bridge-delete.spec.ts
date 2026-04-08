import { expect, test } from "@playwright/test";

import {
  API_BASE_URL,
  attachConsole,
  createProcessedBatchItemViaUi,
  uniqueToken,
} from "./helpers";

test.describe("real-mode bridge delete flow", () => {
  test("deletes a bridge and cascades related batch data", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = uniqueToken();
    attachConsole(page, testInfo);
    const seeded = await createProcessedBatchItemViaUi(page, request, suffix);

    await page.goto(`/dashboard/bridges/${encodeURIComponent(seeded.bridgeId)}`);
    await expect(page.getByRole("heading", { name: seeded.bridgeName })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "移除资产" }).click();

    await expect(page).toHaveURL("/dashboard/bridges", { timeout: 60_000 });
    await expect(page.getByText(seeded.bridgeCode)).not.toBeVisible({ timeout: 60_000 });

    const bridgesResponse = await request.get(`${API_BASE_URL}/api/v1/bridges?limit=200&offset=0`);
    const bridgesBody = await bridgesResponse.text();
    expect(bridgesResponse.ok(), bridgesBody).toBeTruthy();
    expect(bridgesBody).not.toContain(seeded.bridgeId);
    expect(bridgesBody).not.toContain(seeded.bridgeCode);

    const batchesResponse = await request.get(
      `${API_BASE_URL}/api/v1/batches?limit=20&offset=0&bridge_id=${encodeURIComponent(seeded.bridgeId)}`,
    );
    const batchesBody = await batchesResponse.text();
    expect(batchesResponse.ok(), batchesBody).toBeTruthy();
    expect(batchesBody).not.toContain(seeded.batchId);

    const batchDetailResponse = await request.get(
      `${API_BASE_URL}/api/v1/batches/${encodeURIComponent(seeded.batchId)}`,
    );
    expect(batchDetailResponse.status()).toBe(404);
  });
});
