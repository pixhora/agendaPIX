import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "dashboard-login.spec.ts",
  outputDir: "../test-results/dashboard-login-b02",
  use: { baseURL: "http://localhost:3343", browserName: "chromium", trace: "off" },
});
