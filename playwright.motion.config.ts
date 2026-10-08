import { defineConfig, devices } from "@playwright/test";

const PORT = 3345;
const baseURL = `http://127.0.0.1:${PORT}`;

/** Vitrine de movimento, sem banco. O suite principal continua em playwright.config.ts. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "motion-preview.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
