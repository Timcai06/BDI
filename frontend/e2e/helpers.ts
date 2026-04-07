import path from "node:path";

import type { APIRequestContext, Page, TestInfo } from "@playwright/test";

export const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8000";
export const FIXTURE_IMAGE_PATH = path.resolve(
  __dirname,
  "../../backend/external_runtimes/water_ultralytics/ultralytics/assets/bus.jpg",
);

export function uniqueToken() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function attachConsole(page: Page, testInfo: TestInfo) {
  page.on("console", (message) => {
    testInfo.attach(`console-${Date.now()}`, {
      body: `[${message.type()}] ${message.text()}`,
      contentType: "text/plain",
    }).catch(() => {});
  });
}

export async function waitForBatchItemId(batchId: string, request: APIRequestContext) {
  const deadline = Date.now() + 180_000;
  let lastBody = "";

  while (Date.now() < deadline) {
    const response = await request.get(
      `${API_BASE_URL}/api/v1/batches/${encodeURIComponent(batchId)}/items?limit=50&offset=0`,
    );
    lastBody = await response.text();
    if (!response.ok()) {
      throw new Error(`查询批次素材失败：${response.status()} ${lastBody}`);
    }

    const payload = JSON.parse(lastBody) as { items?: Array<{ id: string }> };
    const itemId = payload.items?.[0]?.id;
    if (itemId) {
      return itemId;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(`等待批次素材超时。最近响应：${lastBody}`);
}

export async function waitForBatchItemResult(batchItemId: string, request: APIRequestContext) {
  const deadline = Date.now() + 240_000;
  let lastStatus = 0;
  let lastBody = "";

  while (Date.now() < deadline) {
    const response = await request.get(
      `${API_BASE_URL}/api/v1/batch-items/${encodeURIComponent(batchItemId)}/result`,
    );
    lastStatus = response.status();
    lastBody = await response.text();
    if (response.ok()) {
      return;
    }
    if (response.status() !== 404) {
      throw new Error(`查询单图结果失败：${response.status()} ${lastBody}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error(`等待单图结果超时：status=${lastStatus} body=${lastBody}`);
}

export async function findBridgeIdByCode(bridgeCode: string, request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/api/v1/bridges?limit=200&offset=0`);
  const body = await response.text();
  if (!response.ok()) {
    throw new Error(`查询桥梁列表失败：${response.status()} ${body}`);
  }

  const payload = JSON.parse(body) as { items?: Array<{ id: string; bridge_code: string }> };
  const bridge = payload.items?.find((item) => item.bridge_code === bridgeCode);
  if (!bridge) {
    throw new Error(`未找到刚创建的桥梁：${bridgeCode}`);
  }
  return bridge.id;
}

export async function waitForBatchIdByBridge(bridgeId: string, request: APIRequestContext) {
  const deadline = Date.now() + 60_000;
  let lastBody = "";

  while (Date.now() < deadline) {
    const response = await request.get(
      `${API_BASE_URL}/api/v1/batches?limit=20&offset=0&bridge_id=${encodeURIComponent(bridgeId)}`,
    );
    lastBody = await response.text();
    if (!response.ok()) {
      throw new Error(`查询桥梁批次失败：${response.status()} ${lastBody}`);
    }

    const payload = JSON.parse(lastBody) as { items?: Array<{ id: string; batch_code?: string }> };
    const batchId = payload.items?.[0]?.id;
    if (batchId) {
      return batchId;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`等待桥梁批次超时。最近响应：${lastBody}`);
}

export async function createBridgeViaUi(page: Page, request: APIRequestContext, suffix: string) {
  const bridgeCode = `E2E-${suffix}`;
  const bridgeName = `E2E 桥梁 ${suffix}`;

  await page.goto("/dashboard/bridges");
  await page.getByRole("heading", { name: "桥梁", exact: true }).waitFor();
  await page.getByPlaceholder("例如：NJ-Y001").fill(bridgeCode);
  await page.getByPlaceholder("例如：南京长江大桥一期").fill(bridgeName);
  await page.getByRole("button", { name: "新增桥梁" }).click();
  await page.getByText(`桥梁创建成功：${bridgeCode}`).waitFor({ timeout: 20_000 });

  const bridgeId = await findBridgeIdByCode(bridgeCode, request);
  return { bridgeId, bridgeCode, bridgeName };
}
