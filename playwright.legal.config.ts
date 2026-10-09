import { defineConfig, devices } from "@playwright/test";

const PORT = 3346;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Páginas legais com LEGAL_PAGES_PUBLISHED e um fixture sem rascunho.
 * Sobe sozinho, depois do e2e principal, para não disputar a pasta .next.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/legal-pages-published.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      BETTER_AUTH_URL: baseURL,
      PAYMENT_PROVIDER: "fake",
      LEGAL_PAGES_PUBLISHED: "true",
      LEGAL_CONTENT_DIR: "tests/fixtures/legal",
    },
  },
});
