import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { aroGlyph, brandIconFiles, renderFaviconSvg } from "@/lib/brand/mark";

describe("brand mark source", () => {
  it("draws the Aro glyph on the 24px viewBox", () => {
    expect(aroGlyph.viewBox).toBe(24);
    expect(aroGlyph.ring).toEqual({ cx: 12, cy: 12, r: 9.6, strokeWidth: 4.8 });
    expect(aroGlyph.stem).toEqual({ x: 19.2, y: 0, width: 4.8, height: 24, rx: 2.4 });
  });

  it("keeps the kit raster paths next to the glyph", () => {
    expect(brandIconFiles.icon512File).toBe("public/icon-512.png");
    expect(brandIconFiles.icon512).toBe("/icon-512.png");
    expect(brandIconFiles.maskable192).toBe("/icon-maskable-192.png");
    expect(brandIconFiles.maskable512).toBe("/icon-maskable-512.png");
  });

  it("renders the committed favicon svg", () => {
    const file = readFileSync(resolve(process.cwd(), "app/icon.svg"), "utf8");
    expect(renderFaviconSvg()).toBe(file);
  });
});
