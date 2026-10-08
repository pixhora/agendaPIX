/**
 * Fonte do QR aceita pela CSP (img-src data: e blob:, sem host externo e sem script).
 * PNG/JPEG/WebP/GIF/SVG em data:, blob: gerado no navegador, ou SVG local já sanitizado.
 */
const DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml)(?:;charset=[^;,]+)?(?:;base64)?,/i;

export type PixQrSource =
  | { kind: "src"; src: string }
  | { kind: "svg"; svg: string };

export function sanitizeLocalSvg(svg: string): string | null {
  const trimmed = svg.trim();
  if (!/^<svg[\s>]/i.test(trimmed) || !/<\/svg>\s*$/i.test(trimmed)) return null;
  const clean = trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<(?:iframe|object|embed|link|meta)\b[^>]*>(?:[\s\S]*?<\/(?:iframe|object|embed|link|meta)>)?/gi, "")
    .replace(/\s(?:on[a-z]+|href|xlink:href)\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/\s(?:on[a-z]+|href|xlink:href)\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
  if (!/^<svg[\s>]/i.test(clean) || !/<\/svg>\s*$/i.test(clean)) return null;
  if (/<script|javascript:|<(?:iframe|object|embed|foreignObject)\b/i.test(clean)) return null;
  return clean;
}

export function resolvePixQr(value: string | null | undefined): PixQrSource | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:/i.test(trimmed) || trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("blob:")) return { kind: "src", src: trimmed };
  if (DATA_IMAGE.test(trimmed)) {
    if (/<script|javascript:/i.test(trimmed)) return null;
    return { kind: "src", src: trimmed };
  }
  if (trimmed.startsWith("<svg")) {
    const svg = sanitizeLocalSvg(trimmed);
    return svg ? { kind: "svg", svg } : null;
  }
  return null;
}
