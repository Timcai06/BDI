import path from "node:path";

import { expect, test } from "@playwright/test";

const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8000";
const FIXTURE_IMAGE_PATH = path.resolve(
  __dirname,
  "../../backend/external_runtimes/water_ultralytics/ultralytics/assets/bus.jpg",
);

function uniqueToken() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function waitForBatchItemId(batchId: string, request: import("@playwright/test").APIRequestContext) {
  const deadline = Date.now() + 180_000;
  let lastBody = "";

  while (Date.now() < deadline) {
    const response = await request.get(
      `${API_BASE_URL}/api/v1/batches/${encodeURIComponent(batchId)}/items?limit=50&offset=0`,
    );
    lastBody = await response.text();
    if (!response.ok) {
      throw new Error(`查询批次素材失败：${response.status()} ${lastBody}`);
    }

    const payload = JSON.parse(lastBody) as {
      items?: Array<{ id: string }>;
    };

    const itemId = payload.items?.[0]?.id;
    if (itemId) {
      return itemId;
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(`等待批次素材超时。最近响应：${lastBody}`);
}

async function waitForBatchItemResult(
  batchItemId: string,
  request: import("@playwright/test").APIRequestContext,
) {
  const deadline = Date.now() + 240_000;
  let lastStatus = 0;
  let lastBody = "";

  while (Date.now() < deadline) {
    const response = await request.get(
      `${API_BASE_URL}/api/v1/batch-items/${encodeURIComponent(batchItemId)}/result`,
    );
    lastStatus = response.status();
    lastBody = await response.text();

    if (response.ok) {
      return;
    }

    if (response.status() !== 404) {
      throw new Error(`查询单图结果失败：${response.status()} ${lastBody}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error(`等待单图结果超时：status=${lastStatus} body=${lastBody}`);
}

async function findBridgeIdByCode(
  bridgeCode: string,
  request: import("@playwright/test").APIRequestContext,
) {
  const response = await request.get(`${API_BASE_URL}/api/v1/bridges?limit=200&offset=0`);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`查询桥梁列表失败：${response.status()} ${body}`);
  }

  const payload = JSON.parse(body) as {
    items?: Array<{ id: string; bridge_code: string }>;
  };
  const bridge = payload.items?.find((item) => item.bridge_code === bridgeCode);
  if (!bridge) {
    throw new Error(`未找到刚创建的桥梁：${bridgeCode}`);
  }
  return bridge.id;
}

async function waitForBatchIdByBridge(
  bridgeId: string,
  request: import("@playwright/test").APIRequestContext,
) {
  const deadline = Date.now() + 60_000;
  let lastBody = "";

  while (Date.now() < deadline) {
    const response = await request.get(
      `${API_BASE_URL}/api/v1/batches?limit=20&offset=0&bridge_id=${encodeURIComponent(bridgeId)}`,
    );
    lastBody = await response.text();
    if (!response.ok) {
      throw new Error(`查询桥梁批次失败：${response.status()} ${lastBody}`);
    }

    const payload = JSON.parse(lastBody) as {
      items?: Array<{ id: string }>;
    };
    const batchId = payload.items?.[0]?.id;
    if (batchId) {
      return batchId;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`等待桥梁批次超时。最近响应：${lastBody}`);
}

test.describe("real-mode smoke flow", () => {
  test("creates bridge and batch, uploads an image, and opens item detail", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = uniqueToken();
    const bridgeCode = `E2E-${suffix}`;
    const bridgeName = `E2E 桥梁 ${suffix}`;

    page.on("console", (message) => {
      testInfo.attach(`console-${Date.now()}`, {
        body: `[${message.type()}] ${message.text()}`,
        contentType: "text/plain",
      }).catch(() => {});
    });

    await page.goto("/dashboard/bridges");

    await expect(page.getByRole("heading", { name: "桥梁", exact: true })).toBeVisible();
    await page.getByPlaceholder("例如：NJ-Y001").fill(bridgeCode);
    await page.getByPlaceholder("例如：南京长江大桥一期").fill(bridgeName);
    await page.getByRole("button", { name: "新增桥梁" }).click();
    await expect(page.getByText(`桥梁创建成功：${bridgeCode}`)).toBeVisible({ timeout: 20_000 });

    const bridgeId = await findBridgeIdByCode(bridgeCode, request);
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
