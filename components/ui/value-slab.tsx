import * as React from "react";
import { cn } from "@/lib/utils";

interface ValueSlabProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  label: string;
  value: string;
  /** Unidade exibida ao lado do valor (ex.: "/ mês"). */
  unit?: string;
  /** Texto de apoio abaixo do valor. */
  sublabel?: string;
  /** Texto simples vira um StatusChip ativo; nós React são renderizados como estão. */
  badge?: React.ReactNode;
  size?: "default" | "compact";
}

/**
 * Elemento-assinatura: Placa de Valor (--slab). Número grande em tabular-nums sobre placa escura,
 * com o verde-água do Pix como único acento (v2.1; a lima foi aposentada — ver docs/DESIGN_DECISION.md §15).
 */
export function ValueSlab({ label, value, unit, sublabel, badge, size = "default", className, ...props }: ValueSlabProps) {
  const badgeNode = typeof badge === "string" ? <StatusChip active tone="slab">{badge}</StatusChip> : badge;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] bg-slab text-slab-foreground ring-1 ring-white/5",
        size === "compact" ? "p-5" : "p-6 sm:rounded-frame sm:p-7",
        className,
      )}
      {...props}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slab-muted">{label}</span>
        {badgeNode}
      </div>
      <div className="my-1 flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "font-display font-extrabold leading-none tracking-tight text-slab-foreground tabular-nums",
            size === "compact" ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-sm font-semibold text-slab-muted sm:text-base">{unit}</span>}
      </div>
      {sublabel && <p className="mt-2 text-sm font-medium leading-relaxed text-slab-muted">{sublabel}</p>}
    </div>
  );
}

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  active?: boolean;
  /** `slab`: para uso sobre a placa escura. */
  tone?: "surface" | "slab";
}

export function StatusChip({ children, active = false, tone = "surface", className, ...props }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
        tone === "slab" ? "bg-white/10 text-slab-foreground" : "border border-line bg-surface text-ink",
        !active && tone === "surface" && "text-muted",
        className,
      )}
      {...props}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-pix-bright text-pix-bright-foreground" : tone === "slab" ? "bg-slab-muted" : "bg-line-strong")} aria-hidden="true" />
      {children}
    </span>
  );
}
