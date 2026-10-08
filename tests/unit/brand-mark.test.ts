import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandLink, BrandMark } from "../../components/ui/brand";
import { aroGlyph, renderFaviconSvg } from "../../lib/brand/mark";

describe("C4 Aro", () => {
  it("keeps the glyph approved in #26", () => {
    expect(aroGlyph.viewBox).toBe(24);
    expect(aroGlyph.ring).toEqual({ cx: 12, cy: 12, r: 9.6, strokeWidth: 4.8 });
    expect(aroGlyph.stem).toEqual({ x: 19.2, y: 0, width: 4.8, height: 24, rx: 2.4 });
  });

  it("renders the committed favicon svg", () => {
    const file = readFileSync(resolve(process.cwd(), "app/icon.svg"), "utf8");
    expect(renderFaviconSvg()).toBe(file);
  });

  it("draws the ring and the stem inside the tile", () => {
    const html = renderToStaticMarkup(createElement(BrandMark));
    expect(html).toContain('stroke="var(--pix-bright)"');
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain("bg-brand-tile");
    expect(html).not.toContain(">A<");
  });

  it("locks the wordmark as AgendaPix", () => {
    const html = renderToStaticMarkup(createElement(BrandLink, { href: "/onboarding" }));
    expect(html).toContain('aria-label="AgendaPix, página inicial"');
    expect(html).toContain(">Agenda<");
    expect(html).toContain(">Pix<");
    const panel = renderToStaticMarkup(createElement(BrandLink, { href: "/dashboard" }));
    expect(panel).toContain('aria-label="AgendaPix, início do painel"');
  });
});
