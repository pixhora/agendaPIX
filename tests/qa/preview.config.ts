import { defineConfig } from "@playwright/test";
import bookingConfig from "./playwright.config";

export default defineConfig({
  ...bookingConfig,
  testMatch: ["preview.spec.ts", "preview-visual.spec.ts"],
  timeout: 120000,
  expect: { timeout: 10000 },
  use: { ...bookingConfig.use, baseURL: process.env.PREVIEW_BASE_URL ?? bookingConfig.use?.baseURL },
});
