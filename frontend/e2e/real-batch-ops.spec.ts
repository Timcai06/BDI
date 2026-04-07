import { expect, test } from "@playwright/test";

import { API_BASE_URL, attachConsole, uniqueToken } from "./helpers";

test.describe("real-mode batch workbench ops", () => {
  test("filters batches by bridge and keeps batch selector in sync after creation", async ({
    page,
    request,
  }, testInfo) => {
    attachConsole(page, testInfo);
    const suffixA = uniqueToken();
    const suffixB = uniqueToken();

    const bridgeA = await request.post(`${API_BASE_URL}/api/v1/bridges`, {
      data: { bridge_code: `OPS-${suffixA}`, bridge_name: `OPS 桥 ${suffixA}` },
    });
    expect(bridgeA.ok()).toBeTruthy();
    const bridgeAData = await bridgeA.json();

    const bridgeB = await request.post(`${API_BASE_URL}/api/v1/bridges`, {
      data: { bridge_code: `OPS-${suffixB}`, bridge_name: `OPS 桥 ${suffixB}` },
    });
    expect(bridgeB.ok()).toBeTruthy();
    const bridgeBData = await bridgeB.json();

    const batchA = await request.post(`${API_BASE_URL}/api/v1/batches`, {
      data: {
        bridge_id: bridgeAData.id,
        source_type: "manual-capture",
        expected_item_count: 0,
        inspection_label: `OPS-${suffixA}`,
        enhancement_mode: "always",
      },
    });
    expect(batchA.ok()).toBeTruthy();
    const batchAData = await batchA.json();

    const batchB = await request.post(`${API_BASE_URL}/api/v1/batches`, {
      data: {
        bridge_id: bridgeBData.id,
        source_type: "manual-capture",
        expected_item_count: 0,
        inspection_label: `OPS-${suffixB}`,
        enhancement_mode: "always",
      },
    });
    expect(batchB.ok()).toBeTruthy();
    const batchBData = await batchB.json();

    await page.goto(`/dashboard/ops?bridgeId=${encodeURIComponent(bridgeAData.id)}`);
    const bridgeSelect = page.locator("select").first();
    const batchSelect = page.locator("select").nth(1);
    await expect(bridgeSelect).toHaveValue(bridgeAData.id);
    await expect(batchSelect).toHaveValue(batchAData.id);
    await expect(batchSelect.locator("option", { hasText: batchAData.batch_code })).toHaveCount(1);
    await expect(batchSelect.locator("option", { hasText: batchBData.batch_code })).toHaveCount(0);

    await bridgeSelect.selectOption({ value: bridgeBData.id });
    await expect(page).toHaveURL(new RegExp(`bridgeId=${bridgeBData.id}`));
    await expect(batchSelect).toHaveValue(batchBData.id);
    await expect(batchSelect.locator("option", { hasText: batchBData.batch_code })).toHaveCount(1);
    await expect(batchSelect.locator("option", { hasText: batchAData.batch_code })).toHaveCount(0);
  });
});
