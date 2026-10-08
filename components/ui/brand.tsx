import Link from "next/link";
import { cn } from "@/lib/utils";

/** Símbolo Grade A (mark.svg). A faixa usa o verde-água; as células seguem a cor do texto. */
function GradeAMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 336 336" aria-hidden="true" className={className}>
      <g fill="currentColor">
        <rect x="70" y="0" width="56" height="56" rx="15" />
        <rect x="140" y="0" width="56" height="56" rx="15" />
        <rect x="210" y="0" width="56" height="56" rx="15" />
        <rect x="0" y="70" width="56" height="56" rx="15" />
        <rect x="280" y="70" width="56" height="56" rx="15" />
        <rect x="0" y="210" width="56" height="56" rx="15" />
        <rect x="280" y="210" width="56" height="56" rx="15" />
        <rect x="0" y="280" width="56" height="56" rx="15" />
        <rect x="280" y="280" width="56" height="56" rx="15" />
      </g>
      <rect x="0" y="140" width="336" height="56" rx="28" fill="currentColor" className="text-pix-bright" />
    </svg>
  );
}

/** Quadrado de 32 px (raio 10/32) com o mark. O ícone completo não entra em outro quadrado. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-ink text-paper", className)}>
      <GradeAMark className="size-[22px]" />
    </span>
  );
}

/** Lockup horizontal. O nome acessível inclui o texto visível "AgendaPix". */
export function BrandLink({ href = "/", className }: { href?: string; className?: string }) {
  const accessibleName = href === "/dashboard" ? "AgendaPix, início do painel" : "AgendaPix, página inicial";
  return (
    <Link href={href} aria-label={accessibleName} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-field text-ink", className)}>
      <BrandMark />
      <span className="font-display text-lg leading-none tracking-[-0.02em]">
        <span className="font-bold">Agenda</span>
        <span className="font-extrabold text-pix">Pix</span>
      </span>
    </Link>
  );
}
