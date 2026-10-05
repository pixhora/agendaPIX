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
}

/**
 * Elemento-assinatura v2: Placa de Valor (--slab).
 * Fundo escuro com número grande em tabular-nums e acento fino em lima.
 * Versão única que une a primitiva de feat/booking-ui (atributos HTML repassados,
 * StatusChip com ponto decorativo oculto de leitores de tela), o `unit` usado
 * pela landing de feat/conversion e as classes por token do painel (feat/dashboard-v2).
 */
export function ValueSlab({ label, value, unit, sublabel, badge, className, ...props }: ValueSlabProps) {
  const badgeNode = typeof badge === "string" ? <StatusChip active>{badge}</StatusChip> : badge;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-line bg-slab p-6 text-slab-foreground sm:rounded-frame sm:p-7",
        className
      )}
      {...props}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slab-foreground/70">{label}</span>
        {badgeNode}
      </div>

      <div className="my-1 flex items-baseline gap-2">
        <span className="font-display text-4xl font-extrabold leading-none tracking-tight text-slab-foreground tabular-nums sm:text-6xl">
          {value}
        </span>
        {unit && <span className="text-sm font-semibold text-slab-foreground/70 sm:text-base">{unit}</span>}
      </div>

      {sublabel && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium leading-relaxed text-slab-foreground/70">{sublabel}</p>
      )}
    </div>
  );
}

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  active?: boolean;
}

export function StatusChip({ children, active = false, className, ...props }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-xs font-semibold text-ink",
        !active && "text-muted",
        className
      )}
      {...props}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-lime" : "bg-muted")}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
