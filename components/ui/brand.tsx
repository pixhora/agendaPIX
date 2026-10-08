import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Símbolo Grade A numa grade de 24 px (célula 4, vão 1), a mesma proporção do mark.svg.
 * crispEdges mantém o traço inteiro em 1x. A faixa usa o verde-água; as células seguem a cor do texto.
 */
function GradeAMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges" className={className}>
      <g fill="currentColor">
        <rect x="5" y="0" width="4" height="4" rx="1" />
        <rect x="10" y="0" width="4" height="4" rx="1" />
        <rect x="15" y="0" width="4" height="4" rx="1" />
        <rect x="0" y="5" width="4" height="4" rx="1" />
        <rect x="20" y="5" width="4" height="4" rx="1" />
        <rect x="0" y="15" width="4" height="4" rx="1" />
        <rect x="20" y="15" width="4" height="4" rx="1" />
        <rect x="0" y="20" width="4" height="4" rx="1" />
        <rect x="20" y="20" width="4" height="4" rx="1" />
      </g>
      <rect x="0" y="10" width="24" height="4" rx="2" fill="currentColor" className="text-pix-bright" />
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
