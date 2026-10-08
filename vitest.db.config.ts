import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./scripts/empty-server-only.mjs", import.meta.url)) },
  },
  test: { include: ["tests/integration/**/*.test.ts"], fileParallelism: false },
});
