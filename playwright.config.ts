import { defineConfig, devices } from "@playwright/test";

const PORT = 3344;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * E2E em dois projetos (mobile 390×844 e desktop 1440×900).
 * Roda em série (workers: 1): as jornadas de link mágico compartilham um único arquivo de captura.
 * Requisitos (ver docs/E2E.md): Postgres migrado em DATABASE_URL, BETTER_AUTH_SECRET, FAKE_WEBHOOK_SECRET,
 * PIX_KEY_ENCRYPTION_KEY e PAYMENT_PROVIDER=fake. O webServer sobe `next dev` na porta 3344.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/capture-icons-screens.spec.ts"],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
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
      MAGIC_LINK_CAPTURE_FILE: "tests/e2e/.auth/magic-link-runtime.txt",
    },
  },
});
