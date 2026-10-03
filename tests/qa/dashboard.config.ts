import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "dashboard-real.spec.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 8000 },
  use: {
    baseURL: process.env.QA_DASHBOARD_URL ?? "http://127.0.0.1:3342",
    viewport: { width: 375, height: 812 },
    browserName: "chromium",
    // Links mágicos e cookies nunca entram em traces, vídeos ou screenshots automáticos.
    trace: "off", screenshot: "off", video: "off",
  },
});
