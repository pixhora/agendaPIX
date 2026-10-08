import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { describe, expect, it } from "vitest";

const BUDGET = 2048;
const USE_CLIENT = /["']use client["']/;
const IMPORT_RE = /import\s+(?:[^'"\n]+from\s+)?["']([^"']+)["']/g;

const SERVER_COMPONENTS = [
  "components/motion/rolling-number.tsx",
  "components/motion/booking-island.tsx",
  "components/motion/segmented-thumb.tsx",
  "components/motion/segmented-thumb-view.tsx",
  "components/motion/countdown-ring.tsx",
  "components/motion/grade-loader.tsx",
];

const ENTRIES = {
  rolling: "components/motion/rolling-number.tsx",
  island: "components/motion/booking-island.tsx",
  copy: "components/motion/copy-button.tsx",
  segmented: "components/motion/segmented-thumb.tsx",
  grade: "components/motion/grade-loader.tsx",
  countdown: "components/motion/countdown-ring.tsx",
} as const;

const cssAsEmpty: Plugin = {
  name: "css-as-empty",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /\.css$/ }, () => ({ contents: "", loader: "js" }));
  },
};

function resolveLocal(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@/")) return path.join(process.cwd(), spec.slice(2));
  if (spec.startsWith(".")) return path.resolve(path.dirname(fromFile), spec);
  return null;
}

function materialize(target: string): string | null {
  const candidates = [target, `${target}.tsx`, `${target}.ts`, `${target}.css`];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function isMotionSource(file: string): boolean {
  const rel = path.relative(process.cwd(), file);
  return rel.startsWith(`components${path.sep}motion${path.sep}`) || rel.endsWith(".css");
}

type Graph = { css: string[]; clients: string[] };

function walk(file: string, seen: Set<string>, graph: Graph) {
  const abs = path.resolve(file);
  if (seen.has(abs)) return;
  seen.add(abs);
  if (abs.endsWith(".css")) {
    graph.css.push(abs);
    return;
  }
  const source = readFileSync(abs, "utf8");
  if (USE_CLIENT.test(source)) graph.clients.push(abs);
  for (const match of source.matchAll(IMPORT_RE)) {
    const resolved = resolveLocal(abs, match[1]);
    if (!resolved) continue;
    const next = materialize(resolved);
    if (!next || !isMotionSource(next)) continue;
    walk(next, seen, graph);
  }
}

async function gzipText(contents: string, loader: "css" | "js"): Promise<number> {
  const result = await build({
    stdin: { contents, loader },
    write: false,
    minify: true,
    bundle: loader === "js",
    format: "esm",
    platform: "browser",
  });
  return gzipSync(result.outputFiles[0].text).length;
}

async function gzipJs(entry: string): Promise<number> {
  const result = await build({
    entryPoints: [entry],
    write: false,
    minify: true,
    bundle: true,
    format: "esm",
    platform: "browser",
    external: ["react", "react-dom", "react/jsx-runtime"],
    alias: { "@": process.cwd() },
    plugins: [cssAsEmpty],
  });
  return gzipSync(result.outputFiles[0].text).length;
}

function clientRoots(entry: string, clients: string[]): string[] {
  if (USE_CLIENT.test(readFileSync(entry, "utf8"))) return [path.resolve(entry)];
  const imported = new Set<string>();
  for (const file of clients) {
    const source = readFileSync(file, "utf8");
    for (const other of clients) {
      if (other === file) continue;
      if (source.includes(path.basename(other, path.extname(other)))) imported.add(other);
    }
  }
  return clients.filter((file) => !imported.has(file));
}

async function measure(entry: string) {
  const graph: Graph = { css: [], clients: [] };
  walk(entry, new Set(), graph);
  const baseFiles = graph.css.filter((file) => file.endsWith(`${path.sep}motion-base.css`));
  const ownFiles = graph.css.filter((file) => !baseFiles.includes(file));
  let base = 0;
  for (const file of baseFiles) base += await gzipText(readFileSync(file, "utf8"), "css");
  let own = 0;
  for (const file of ownFiles) own += await gzipText(readFileSync(file, "utf8"), "css");
  let js = 0;
  for (const file of clientRoots(entry, graph.clients)) js += await gzipJs(file);
  return { js, own, base, total: js + own + base, css: graph.css.map((file) => path.relative(process.cwd(), file)) };
}

describe("orçamento de 2 KB por primitivo", () => {
  it("componente de servidor não leva use client", () => {
    for (const file of SERVER_COMPONENTS) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(USE_CLIENT);
    }
  });

  it("soma o JS e todo o CSS que o primitivo importa, base incluída", async () => {
    expect(existsSync("app/motion.css")).toBe(false);
    const globals = readFileSync("app/globals.css", "utf8");
    expect(globals).not.toContain("motion.css");
    expect(globals).not.toContain("motion-base");
    expect(globals).not.toContain("app/motion/");
    const costs: Record<string, Awaited<ReturnType<typeof measure>>> = {};
    for (const [name, entry] of Object.entries(ENTRIES)) {
      costs[name] = await measure(entry);
    }
    for (const [name, cost] of Object.entries(costs)) {
      expect(cost.css.some((file) => file.includes("stage.css")), name).toBe(false);
      expect(cost.total, `${name} js=${cost.js} own=${cost.own} base=${cost.base} total=${cost.total}`).toBeLessThanOrEqual(BUDGET);
    }
    expect(costs.countdown).toMatchObject({ js: 0, own: 0, base: 0, total: 0 });
    expect(costs.grade.js).toBe(0);
    expect(costs.grade.own).toBeGreaterThan(0);
    expect(costs.grade.base).toBeGreaterThan(0);
    expect(costs.segmented.js).toBe(0);
    expect(costs.copy.base).toBe(costs.rolling.base);
    for (const [name, cost] of Object.entries(costs)) {
      if (name === "countdown") continue;
      expect(cost.css, name).toContain(path.join("app", "motion-base.css"));
      expect(cost.css.filter((file) => file.startsWith(`app${path.sep}motion${path.sep}`)), name).toHaveLength(1);
    }
  });
});
