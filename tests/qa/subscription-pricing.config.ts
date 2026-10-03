import { defineConfig } from "@playwright/test";
import previewConfig from "./preview.config";

export default defineConfig({
  ...previewConfig,
  testMatch: "subscription-pricing.spec.ts",
});
