import { defineConfig, devices } from "@playwright/test";
const PORT = 3360;
const baseURL = `http://127.0.0.1:${PORT}`;
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "capture-brand-screens.spec.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "off" },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
