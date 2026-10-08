import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/motion.css", "utf8");
const BUDGET = 2048;

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
  });
  return gzipSync(result.outputFiles[0].text).length;
}

async function componentCost(cssName: string | null, entry: string | null): Promise<number> {
  const cssBytes = cssName ? await gzipCss(cssName) : 0;
  const jsBytes = entry ? await gzipJs(entry) : 0;
  return cssBytes + jsBytes;
}

describe("orçamento de 2 KB por primitivo", () => {
  it("soma o JS cliente e o CSS do componente, ambos minificados e gzip", async () => {
    const costs = {
      rolling: await componentCost("rolling", "components/motion/rolling-number-motion.tsx"),
      island: await componentCost("island", "components/motion/in-view.tsx"),
      copy: await componentCost("copy", "components/motion/copy-button.tsx"),
      segmented: await componentCost("segmented", "components/motion/segmented-thumb-controlled.tsx"),
      grade: await componentCost("grade", null),
      countdown: await componentCost(null, null),
    };
    for (const [name, bytes] of Object.entries(costs)) {
      expect(bytes, name).toBeLessThanOrEqual(BUDGET);
    }
    expect(costs.countdown).toBe(0);
    expect(costs.grade).toBeGreaterThan(0);
  });
});
