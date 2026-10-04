import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "dashboard-login.spec.ts",
  outputDir: "../../test-results/dashboard-login",
  workers: 1,
  use: {
    baseURL: process.env.QA_DASHBOARD_URL ?? "http://127.0.0.1:3343",
    browserName: "chromium",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
