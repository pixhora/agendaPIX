import { defineConfig, devices } from "@playwright/test";

const PORT = 3345;
const baseURL = `http://127.0.0.1:${PORT}`;

// O globalSetup grava o cookie contra esta origem. Tem de bater com o `next start`.
process.env.BETTER_AUTH_URL = baseURL;

/**
 * O 308 do slug antigo no build de produção. `next dev` junta os bundles e a página
 * também redireciona, então o teste do dev não prova o proxy.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.prod.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm exec next start --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 360_000,
    env: {
      ...process.env,
      BETTER_AUTH_URL: baseURL,
      PAYMENT_PROVIDER: "fake",
    },
  },
});
