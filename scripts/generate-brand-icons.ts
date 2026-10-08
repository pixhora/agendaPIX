import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderFaviconSvg } from "@/lib/brand/mark";

/**
 * Rewrites app/icon.svg from the small-size Aro favicon in lib/brand/mark.ts.
 * That drawing is the kit favicon (solid ring, thicker stroke, dark tile edge).
 * It is not a scaled copy of the 24px UI glyph.
 *
 * favicon.ico, apple-icon.png and the PWA PNGs stay as the kit rasters.
 * This repo has no encoder that reproduces those files byte for byte.
 *
 * Run from the repo root:
 *   node --experimental-strip-types --experimental-transform-types --import ./scripts/ts-register.mjs scripts/generate-brand-icons.ts
 */
const target = resolve(process.cwd(), "app/icon.svg");
writeFileSync(target, renderFaviconSvg());
process.stdout.write(`Wrote ${target}\n`);
process.stdout.write(
  "Left untouched: app/favicon.ico, app/apple-icon.png, public/icon-192.png, public/icon-512.png, public/icon-maskable-192.png, public/icon-maskable-512.png\n",
);
