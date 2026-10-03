import "dotenv/config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "booking-ui.spec.ts",
  outputDir: "../../dogfood-output/playwright",
  workers: 1,
  timeout: 15000,
  expect: { timeout: 2500 },
  use: {
    baseURL: process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3104",
    viewport: { width: 375, height: 812 },
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
