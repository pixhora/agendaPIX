import Link from "next/link";
import { aroGlyph } from "@/lib/brand/mark";
import { cn } from "@/lib/utils";

/**
 * Símbolo Aro. A geometria vem de lib/brand/mark.ts.
 * O anel usa --pix-bright; a haste segue a cor do azulejo (currentColor).
 */
function AroMark({ className }: { className?: string }) {
  const { viewBox, ring, stem } = aroGlyph;
  return (
    <svg viewBox={`0 0 ${viewBox} ${viewBox}`} aria-hidden="true" overflow="visible" className={className}>
      <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="var(--pix-bright)" strokeWidth={ring.strokeWidth} />
      <rect x={stem.x} y={stem.y} width={stem.width} height={stem.height} rx={stem.rx} fill="currentColor" />
    </svg>
  );
}

/** Quadrado de 32 px (raio 10). O glifo ocupa 65,625% (21 px), o mesmo encaixe de antes. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-brand-tile text-brand-tile-foreground shadow-[inset_0_0_0_1px_var(--brand-tile-edge)]",
        className,
      )}
    >
      <AroMark className="size-[65.625%]" />
    </span>
  );
}

/** Lockup horizontal. O nome acessível inclui o texto visível "AgendaPix". */
export function BrandLink({ href = "/", className }: { href?: string; className?: string }) {
  const accessibleName = href === "/dashboard" ? "AgendaPix, início do painel" : "AgendaPix, página inicial";
  return (
    <Link href={href} aria-label={accessibleName} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-field text-ink", className)}>
      <BrandMark />
      <span className="relative -top-0.5 font-display text-lg leading-none tracking-[-0.02em]">
        <span className="font-bold">Agenda</span>
        <span className="font-extrabold text-pix">Pix</span>
      </span>
    </Link>
  );
}
