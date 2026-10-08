import { brandColors } from "@/lib/brand/colors";

/**
 * C4 Aro, the UI glyph. ViewBox 24, drawn at 65.625% of the 32px tile
 * (the same scale as the previous mark). Ring stroke is --pix-bright;
 * the stem uses the tile foreground. Source: simbolo-glifo-24.svg.
 */
export const aroGlyph = {
  viewBox: 24,
  ring: { cx: 12, cy: 12, r: 9.6, strokeWidth: 4.8 },
  stem: { x: 19.2, y: 0, width: 4.8, height: 24, rx: 2.4 },
} as const;

/**
 * Small-size favicon (viewBox 32). Solid ring and a thicker stroke,
 * not a scale of the 24px glyph. Dark mode adds the tile edge.
 * Source: kit favicon.svg. app/icon.svg must match renderFaviconSvg().
 */
const faviconTilePath =
  "M9.38 0H22.62C28.62 0 32.00 3.38 32.00 9.38V22.62C32.00 28.62 28.62 32.00 22.62 32.00H9.38C3.38 32.00 0 28.62 0 22.62V9.38C0 3.38 3.38 0 9.38 0Z";

/** Kit rasters. The generator does not overwrite them. */
export const brandIconFiles = {
  icon192: "/icon-192.png",
  icon512: "/icon-512.png",
  maskable192: "/icon-maskable-192.png",
  maskable512: "/icon-maskable-512.png",
  icon512File: "public/icon-512.png",
} as const;

/** Byte-for-byte source of app/icon.svg. */
export function renderFaviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" >
<defs>
<style>@media (prefers-color-scheme: dark){.rim{stroke-opacity:.22}}</style>
</defs>
<path d="${faviconTilePath}" fill="${brandColors.ink}"/>
<path class="rim" d="${faviconTilePath}" stroke="#fff" stroke-opacity="0" stroke-width="1.00"/>
<circle cx="16" cy="16.0" r="6" stroke="${brandColors.pixBright}" stroke-width="4"/>
<rect x="20" y="8" width="4" height="16" rx="2.0" fill="${brandColors.paper}"/>
</svg>
`;
}
