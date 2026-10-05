import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://127.0.0.1:3344" },
  projects: [{ name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 } } }],
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3344",
    url: "http://127.0.0.1:3344",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      BETTER_AUTH_URL: "http://127.0.0.1:3344",
      MAGIC_LINK_CAPTURE_FILE: "tests/e2e/.auth/magic-link-runtime.txt",
    },
  },
});
