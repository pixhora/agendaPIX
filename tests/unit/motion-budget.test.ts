import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/motion.css", "utf8");
const BUDGET = 2048;
const USE_CLIENT = /["']use client["']/;

const SERVER_COMPONENTS = [
  "components/motion/rolling-number.tsx",
  "components/motion/booking-island.tsx",
  "components/motion/segmented-thumb.tsx",
  "components/motion/segmented-thumb-view.tsx",
  "components/motion/countdown-ring.tsx",
  "components/motion/grade-loader.tsx",
];

const cssAsEmpty: Plugin = {
  name: "css-as-empty",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /\.css$/ }, () => ({ contents: "", loader: "js" }));
  },
};

function sliceCss(name: string): string {
  const start = css.indexOf(`/* size:${name} */`);
  const end = css.indexOf(`/* /size:${name} */`);
  if (start < 0 || end < 0) throw new Error(`bloco CSS ausente: ${name}`);
  return css.slice(start, end);
}

async function gzipCss(name: string): Promise<number> {
  const result = await build({
    stdin: { contents: sliceCss(name), loader: "css" },
    write: false,
    minify: true,
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

async function measure(cssName: string, file: string) {
  const source = readFileSync(file, "utf8");
  const js = USE_CLIENT.test(source) ? await gzipJs(file) : 0;
  const style = css.includes(`/* size:${cssName} */`) ? await gzipCss(cssName) : 0;
  return { js, style, total: js + style };
}

describe("orçamento de 2 KB por primitivo", () => {
  it("componente de servidor não leva use client", () => {
    for (const file of SERVER_COMPONENTS) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(USE_CLIENT);
    }
  });

  it("soma o JS cliente e o CSS do componente, ambos minificados e gzip", async () => {
    const costs = {
      rolling: await measure("rolling", "components/motion/rolling-number-motion.tsx"),
      island: await measure("island", "components/motion/in-view.tsx"),
      copy: await measure("copy", "components/motion/copy-button.tsx"),
      segmented: await measure("segmented", "components/motion/segmented-thumb.tsx"),
      grade: await measure("grade", "components/motion/grade-loader.tsx"),
      countdown: await measure("countdown", "components/motion/countdown-ring.tsx"),
    };
    for (const [name, cost] of Object.entries(costs)) {
      expect(cost.total, `${name} js=${cost.js} css=${cost.style} total=${cost.total}`).toBeLessThanOrEqual(BUDGET);
    }
    expect(costs.countdown).toEqual({ js: 0, style: 0, total: 0 });
    expect(costs.grade.style).toBeGreaterThan(0);
    expect(costs.grade.js).toBe(0);
    expect(costs.segmented.js).toBe(0);
  });

  it("não publica o motion.css em todas as rotas e mede o arquivo inteiro", async () => {
    expect(readFileSync("app/globals.css", "utf8")).not.toContain("motion.css");
    for (const file of [
      "components/motion/rolling-number.tsx",
      "components/motion/booking-island.tsx",
      "components/motion/copy-button.tsx",
      "components/motion/segmented-thumb-view.tsx",
      "components/motion/grade-loader.tsx",
    ]) {
      expect(readFileSync(file, "utf8"), file).toContain('import "@/app/motion.css"');
    }
    expect(readFileSync("components/motion/countdown-ring.tsx", "utf8")).not.toContain("motion.css");
    const result = await build({
      stdin: { contents: css, loader: "css" },
      write: false,
      minify: true,
    });
    const bytes = gzipSync(result.outputFiles[0].text).length;
    expect(bytes, `motion.css gzip ${bytes}`).toBeGreaterThan(500);
    expect(bytes).toBeLessThanOrEqual(4096);
  });
});
