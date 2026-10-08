import { resolvePixQr } from "./pix-qr";

interface PixQrProps {
  value: string | null | undefined;
  className?: string;
}

/**
 * QR do Pix só como data: ou SVG local virado em data URL.
 * Sem script e sem host externo — a CSP aceita data: e blob:.
 */
export function PixQr({ value, className }: PixQrProps) {
  const resolved = resolvePixQr(value);
  const src = !resolved
    ? null
    : resolved.kind === "src"
      ? resolved.src
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(resolved.svg)}`;
  if (!src) {
    return <div className="flex size-44 shrink-0 items-center justify-center rounded-2xl bg-subtle text-sm text-muted">QR Code indisponível</div>;
  }

  return (
    <div className="shrink-0 rounded-2xl border border-line bg-white p-3">
      {/* QR sempre sobre branco. data: ou blob: — sem host externo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QR Code do Pix para pagar o sinal" width={208} height={208} className={className ?? "block size-44 object-contain lg:size-52"} />
    </div>
  );
}
