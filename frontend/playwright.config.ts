import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const FRONTEND_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: path.resolve(__dirname, "../artifacts/playwright-report") }],
  ],
  globalSetup: path.resolve(__dirname, "e2e/global-setup.ts"),
  use: {
    baseURL: FRONTEND_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 960 },
  },
  outputDir: path.resolve(__dirname, "../artifacts/playwright-artifacts"),
  projects: [
    {
      name: "chromium-real",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  metadata: {
    frontendBaseUrl: FRONTEND_BASE_URL,
    apiBaseUrl: API_BASE_URL,
    mode: "real",
  },
});
