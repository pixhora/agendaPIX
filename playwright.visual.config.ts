import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Regressão visual: só tests/e2e/visual.spec.ts, com os baselines Linux em tests/e2e/visual.spec.ts-snapshots.
 * Roda pela etapa `visual` de scripts/ci-local.sh, dentro do container, para o resultado ser reproduzível.
 */
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "visual.spec.ts",
});
