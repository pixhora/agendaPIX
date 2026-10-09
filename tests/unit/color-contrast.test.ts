import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Contraste WCAG 2.x. Texto normal precisa de pelo menos 4,5:1. */
function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset + 1, offset + 3), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function block(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`bloco ${selector} ausente`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open, index);
    }
  }
  throw new Error(`bloco ${selector} sem fechamento`);
}

function token(cssBlock: string, name: string): string {
  const match = cssBlock.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`${name} ausente`);
  return match[1].toLowerCase();
}

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
const themes = {
  light: block(css, ":root {"),
  dark: block(css, ".dark {"),
} as const;

const surfaces = ["--paper", "--surface", "--subtle"] as const;

describe("contraste dos tokens de texto", () => {
  for (const [theme, cssBlock] of Object.entries(themes)) {
    it(`${theme}: tinta e texto secundário passam de 4,5:1 em papel, cartão e superfície sutil`, () => {
      const ink = token(cssBlock, "--ink");
      const muted = token(cssBlock, "--muted");
      for (const surface of surfaces) {
        const background = token(cssBlock, surface);
        expect(contrast(ink, background), `${ink} sobre ${surface} ${background}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(muted, background), `${muted} sobre ${surface} ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
