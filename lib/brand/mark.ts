/**
 * C4 Aro, the UI glyph. ViewBox 24, drawn at 65.625% of the 32px tile
 * (the same scale as the previous mark). Ring stroke is --pix-bright;
 * the stem uses the tile foreground. Source: simbolo-glifo-24.svg.
 * Geometry from PR #26 commit c76ffff.
 */
export const aroGlyph = {
  viewBox: 24,
  ring: { cx: 12, cy: 12, r: 9.6, strokeWidth: 4.8 },
  stem: { x: 19.2, y: 0, width: 4.8, height: 24, rx: 2.4 },
} as const;
