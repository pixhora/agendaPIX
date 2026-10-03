import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3103";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL },
  projects: [{ name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 } } }],
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3103",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    env: { BETTER_AUTH_URL: baseURL, PAYMENT_PROVIDER: "fake" },
  },
});
