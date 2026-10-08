// Empacota os entrypoints de processo da imagem Docker (o output standalone do Next não inclui scripts):
//   scripts/migrate.mjs   -> dist/migrate.cjs    (sempre)
//   scripts/reconcile.ts  -> dist/reconcile.mjs  (quando existir; chega com o backend do PR #7)
// O reconciliador sai em ESM porque usa top-level await, que o formato CJS do esbuild não suporta.
import { existsSync, rmSync } from "node:fs";
import { build } from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  target: "node22",
  external: ["pg-native"],
  alias: { "server-only": "./scripts/empty-server-only.mjs" },
  logLevel: "info",
};

rmSync("dist", { recursive: true, force: true });
await build({ ...common, entryPoints: ["scripts/migrate.mjs"], format: "cjs", outfile: "dist/migrate.cjs" });

if (existsSync("scripts/reconcile.ts")) {
  await build({
    ...common,
    entryPoints: ["scripts/reconcile.ts"],
    format: "esm",
    outfile: "dist/reconcile.mjs",
    // Dependências CJS (pg, etc.) chamam require(); em ESM ele precisa existir.
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  });
} else {
  process.stdout.write("scripts/reconcile.ts ausente nesta versão: dist/reconcile.mjs não foi gerado.\n");
}
