import { defineConfig } from "@playwright/test";
import previewConfig from "./preview.config";

export default defineConfig({ ...previewConfig, testMatch: "mobile-smoke.spec.ts", workers: 1, use: { ...previewConfig.use, isMobile: true, hasTouch: true } });
