import Link from "next/link";
import { markRects, uiMarkMetrics } from "@/lib/brand/mark";
import { cn } from "@/lib/utils";

const uiMark = markRects(uiMarkMetrics);

/**
 * Símbolo Grade A. A geometria vem de lib/brand/mark.ts.
 * crispEdges mantém o traço inteiro em 1x. A faixa usa o verde-água; as células seguem a cor do texto.
 */
function GradeAMark({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${uiMarkMetrics.viewBox} ${uiMarkMetrics.viewBox}`} aria-hidden="true" shapeRendering="crispEdges" className={className}>
      <g fill="currentColor">
        {uiMark.cells.map((cell) => (
          <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={cell.width} height={cell.height} rx={cell.rx} />
        ))}
      </g>
      <rect x={uiMark.bar.x} y={uiMark.bar.y} width={uiMark.bar.width} height={uiMark.bar.height} rx={uiMark.bar.rx} fill="currentColor" className="text-pix-bright" />
    </svg>
  );
}

/** Quadrado de 32 px (raio 10/32). O mark ocupa 65,625% (21 px; razão 336/512 do icon.svg). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-brand-tile text-brand-tile-foreground shadow-[inset_0_0_0_1px_var(--brand-tile-edge)]",
        className,
      )}
    >
      <GradeAMark className="size-[65.625%]" />
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
