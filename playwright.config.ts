import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3343" },
  projects: [{ name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 } } }],
  webServer: { command: "pnpm dev --hostname 127.0.0.1 --port 3343", url: "http://127.0.0.1:3343", reuseExistingServer: !process.env.CI },
});
