import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderFaviconSvg } from "@/lib/brand/mark";

/**
 * Rewrites the crisp favicon SVG from lib/brand/mark.ts.
 *
 * favicon.ico, apple-icon.png and the PWA PNGs stay as the approved rasters.
 * The glossy kit is not a flat redraw of the grid, and this repo has no encoder
 * that reproduces favicon.ico byte for byte. Overwriting them would change
 * pixels that are already design-approved.
 *
 * Run from the repo root:
 *   node --experimental-strip-types --experimental-transform-types --import ./scripts/ts-register.mjs scripts/generate-brand-icons.ts
 */
const target = resolve(process.cwd(), "app/icon.svg");
writeFileSync(target, renderFaviconSvg());
process.stdout.write(`Wrote ${target}\n`);
process.stdout.write("Left untouched: app/favicon.ico, app/apple-icon.png, public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png\n");
