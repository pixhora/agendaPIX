import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Contraste WCAG 2.x. Texto comum precisa de pelo menos 4,5:1. */
function contrast(foreground: string, background: string): number {
  const ratio = (luminance(foreground) + 0.05) / (luminance(background) + 0.05);
  return ratio >= 1 ? ratio : 1 / ratio;
}

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function block(css: string, header: string): string {
  const start = css.indexOf(header);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function token(css: string, name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`token ${name} ausente`);
  return match[1].toLowerCase();
}

const css = readFileSync("app/globals.css", "utf8");
const light = block(css, ":root {");
const dark = block(css, ".dark {");

const lightMuted = token(light, "--muted");
const darkMuted = token(dark, "--muted");
const lightSurfaces = ["--surface", "--paper", "--subtle"].map((name) => token(light, name));
const darkSurfaces = ["--surface", "--paper", "--subtle"].map((name) => token(dark, name));

describe("texto secundário contra as superfícies", () => {
  it("mantém o cinza claro em pelo menos 4,5:1 no branco, no papel e no fundo sutil", () => {
    for (const surface of lightSurfaces) {
      expect(contrast(lightMuted, surface), `${lightMuted} sobre ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("mantém o cinza escuro em pelo menos 4,5:1 nas superfícies escuras", () => {
    for (const surface of darkSurfaces) {
      expect(contrast(darkMuted, surface), `${darkMuted} sobre ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
