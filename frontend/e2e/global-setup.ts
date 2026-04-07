import { spawnSync } from "node:child_process";
import path from "node:path";

import type { FullConfig } from "@playwright/test";

const FRONTEND_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8000";
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BDI_SCRIPT = path.join(PROJECT_ROOT, "bdi");

function assertBdiStatus() {
  const status = spawnSync(BDI_SCRIPT, ["status"], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  });

  if (status.status !== 0) {
    throw new Error(`bdi status 执行失败。\n${status.stderr || status.stdout}`);
  }

  const output = status.stdout || "";
  if (!output.includes("Mode: real")) {
    throw new Error(`当前不是 real 模式。\n${output}`);
  }
  if (!output.includes("[ok] frontend running on :3000")) {
    throw new Error(`前端未在线，无法执行 E2E。\n${output}`);
  }
  if (!output.includes("[ok] backend running on :8000")) {
    throw new Error(`后端未在线，无法执行 E2E。\n${output}`);
  }
}

async function assertHealthReady() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`健康检查失败：${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    ready?: boolean;
    active_runner_ready?: boolean;
    active_model_version?: string | null;
  };

  if (!payload.ready) {
    throw new Error(`后端 /health 未就绪：${JSON.stringify(payload)}`);
  }
  if (payload.active_runner_ready === false) {
    throw new Error(`当前 active runner 不可用：${JSON.stringify(payload)}`);
  }
}

export default async function globalSetup(_config: FullConfig) {
  assertBdiStatus();
  await assertHealthReady();

  process.env.PLAYWRIGHT_BASE_URL = FRONTEND_BASE_URL;
  process.env.PLAYWRIGHT_API_BASE_URL = API_BASE_URL;
}
