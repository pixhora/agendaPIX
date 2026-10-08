import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { brandIconFiles, markRects, renderFaviconSvg, uiMarkMetrics } from "@/lib/brand/mark";

describe("brand mark source", () => {
  it("places the UI mark on the 24px grid", () => {
    const { cells, bar } = markRects(uiMarkMetrics);
    expect(cells.map((cell) => [cell.x, cell.y])).toEqual([
      [5, 0],
      [10, 0],
      [15, 0],
      [0, 5],
      [20, 5],
      [0, 15],
      [20, 15],
      [0, 20],
      [20, 20],
    ]);
    expect(bar).toEqual({ x: 0, y: 10, width: 24, height: 4, rx: 2 });
    expect(cells.every((cell) => cell.width === 4 && cell.rx === 1)).toBe(true);
  });

  it("keeps the glossy raster paths next to the grid", () => {
    expect(brandIconFiles.icon512File).toBe("public/icon-512.png");
    expect(brandIconFiles.icon512).toBe("/icon-512.png");
  });

  it("renders the committed favicon svg", () => {
    const file = readFileSync(resolve(process.cwd(), "app/icon.svg"), "utf8");
    expect(renderFaviconSvg()).toBe(file);
  });
});
