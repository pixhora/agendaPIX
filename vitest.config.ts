import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      "server-only": fileURLToPath(new URL("./scripts/empty-server-only.mjs", import.meta.url)),
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
