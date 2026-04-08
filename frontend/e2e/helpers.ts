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

export async function getBatchItemResult(batchItemId: string, request: APIRequestContext) {
  const response = await request.get(
    `${API_BASE_URL}/api/v1/batch-items/${encodeURIComponent(batchItemId)}/result`,
  );
  const body = await response.text();
  if (!response.ok()) {
    throw new Error(`读取单图结果失败：${response.status()} ${body}`);
  }
  return JSON.parse(body) as {
    id: string;
    batch_item_id: string;
    detections: Array<{ id: string; category: string; confidence: number }>;
  };
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

export async function createProcessedBatchItemViaUi(page: Page, request: APIRequestContext, suffix: string) {
  const bridge = await createBridgeViaUi(page, request, suffix);
  await page.goto(`/dashboard/ops?bridgeId=${encodeURIComponent(bridge.bridgeId)}`);
  await page.getByTitle("新建批次").click();
  await page.getByPlaceholder("例如：主桥上行 4 月无人机巡检").fill(`E2E 巡检 ${suffix}`);
  await page.getByRole("button", { name: "下一步流程" }).click();
  await page.locator("input[type='file']").setInputFiles(FIXTURE_IMAGE_PATH);
  await page.getByRole("button", { name: "立即启动云端扫描" }).click();
  await page.getByText(/上传完成：accepted=/).waitFor({ timeout: 120_000 });

  const batchId = await waitForBatchIdByBridge(bridge.bridgeId, request);
  const batchItemId = await waitForBatchItemId(batchId, request);
  await waitForBatchItemResult(batchItemId, request);
  const result = await getBatchItemResult(batchItemId, request);

  return {
    ...bridge,
    batchId,
    batchItemId,
    resultId: result.id,
    detectionId: result.detections[0]?.id ?? null,
  };
}

export async function createReviewViaApi(
  request: APIRequestContext,
  payload: {
    detectionId: string;
    reviewer: string;
    reviewNote: string;
  },
) {
  const response = await request.post(`${API_BASE_URL}/api/v1/reviews`, {
    data: {
      detection_id: payload.detectionId,
      review_action: "confirm",
      reviewer: payload.reviewer,
      review_note: payload.reviewNote,
      after_payload: {},
    },
  });
  const body = await response.text();
  if (!response.ok()) {
    throw new Error(`创建复核记录失败：${response.status()} ${body}`);
  }
  return JSON.parse(body) as { id: string; reviewer: string; batch_item_id: string };
}

export async function createAlertViaApi(
  request: APIRequestContext,
  payload: {
    bridgeId: string;
    batchId: string;
    batchItemId: string;
    resultId: string;
    detectionId: string;
    title: string;
  },
) {
  const response = await request.post(`${API_BASE_URL}/api/v1/alerts`, {
    data: {
      bridge_id: payload.bridgeId,
      batch_id: payload.batchId,
      batch_item_id: payload.batchItemId,
      result_id: payload.resultId,
      detection_id: payload.detectionId,
      event_type: "count_exceeded",
      alert_level: "high",
      title: payload.title,
      trigger_payload: { source: "playwright-e2e" },
      note: "seeded by playwright",
    },
  });
  const body = await response.text();
  if (!response.ok()) {
    throw new Error(`创建告警失败：${response.status()} ${body}`);
  }
  return JSON.parse(body) as { id: string; title: string; status: string };
}
