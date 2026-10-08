import { brandColors } from "@/lib/brand/colors";

/**
 * Grade A, the only drawing of the symbol.
 * 0 empty, 1 cell, 2 the bar. Swap the logo by editing this grid
 * (and the metrics below), then run `node --experimental-strip-types --experimental-transform-types --import ./scripts/ts-register.mjs scripts/generate-brand-icons.ts`.
 */
export const GRADE_A_GRID = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [2, 2, 2, 2, 2],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
] as const;

export type MarkRect = { x: number; y: number; width: number; height: number; rx: number };

export type MarkMetrics = {
  viewBox: number;
  origin: number;
  cell: number;
  gap: number;
  cellRx: number;
  barRx: number;
  /** Pixels added on each horizontal side of the bar. */
  barBleed: number;
};

/** Mark inside the UI tile: 24px grid, cell 4, gap 1. */
export const uiMarkMetrics: MarkMetrics = {
  viewBox: 24,
  origin: 0,
  cell: 4,
  gap: 1,
  cellRx: 1,
  barRx: 2,
  barBleed: 0,
};

/**
 * Same grid, snapped to the 16px favicon. The rounded square is the tile,
 * which the UI draws in CSS instead.
 */
export const faviconMarkMetrics: MarkMetrics = {
  viewBox: 16,
  origin: 3,
  cell: 2,
  gap: 0,
  cellRx: 0,
  barRx: 0,
  barBleed: 1,
};

/** Squircle baked into the 16px favicon. The UI tile uses CSS radius instead. */
export const faviconTilePath =
  "M4.69 0H11.31C14.31 0 16 1.69 16 4.69V11.31C16 14.31 14.31 16 11.31 16H4.69C1.69 16 0 14.31 0 11.31V4.69C0 1.69 1.69 0 4.69 0Z";

/** Glossy kit rasters. They are not a flat redraw of the grid, so the generator does not overwrite them. */
export const brandIconFiles = {
  icon192: "/icon-192.png",
  icon512: "/icon-512.png",
  maskable512: "/icon-maskable-512.png",
  icon512File: "public/icon-512.png",
} as const;

export function markRects(metrics: MarkMetrics): { cells: MarkRect[]; bar: MarkRect } {
  const step = metrics.cell + metrics.gap;
  const cells: MarkRect[] = [];
  let bar: MarkRect | null = null;
  for (let row = 0; row < GRADE_A_GRID.length; row += 1) {
    const line = GRADE_A_GRID[row];
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] !== 1) continue;
      cells.push({
        x: metrics.origin + col * step,
        y: metrics.origin + row * step,
        width: metrics.cell,
        height: metrics.cell,
        rx: metrics.cellRx,
      });
    }
    if (bar || !line.some((cell) => cell === 2)) continue;
    const span = line.length * metrics.cell + (line.length - 1) * metrics.gap;
    bar = {
      x: metrics.origin - metrics.barBleed,
      y: metrics.origin + row * step,
      width: span + metrics.barBleed * 2,
      height: metrics.cell,
      rx: metrics.barRx,
    };
  }
  if (!bar) throw new Error("Grade A grid is missing the bar row");
  return { cells, bar };
}

/** Byte-for-byte source of app/icon.svg. */
export function renderFaviconSvg(): string {
  const { cells, bar } = markRects(faviconMarkMetrics);
  const rect = (node: MarkRect, fill: string) =>
    `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${fill}"/>`;
  const body = [
    `<path d="${faviconTilePath}" fill="${brandColors.ink}" shape-rendering="geometricPrecision"/>`,
    ...cells.map((cell) => rect(cell, brandColors.paper)),
    rect(bar, brandColors.pixBright),
  ].join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" shape-rendering="crispEdges">\n${body}\n</svg>\n`;
}
