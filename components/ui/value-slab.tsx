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
 * StatusChip com ponto decorativo oculto de leitores de tela) com o `unit` usado
 * pela landing de feat/conversion.
 */
export function ValueSlab({ label, value, unit, sublabel, badge, className, ...props }: ValueSlabProps) {
  const badgeNode = typeof badge === "string" ? <StatusChip active>{badge}</StatusChip> : badge;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] sm:rounded-[32px] border border-line bg-slab p-6 sm:p-7 text-slab-foreground shadow-md transition-all",
        className
      )}
      {...props}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#A3A3A8]">{label}</span>
        {badgeNode}
      </div>

      <div className="my-1 flex items-baseline gap-2">
        <span className="font-display text-4xl font-black leading-none tracking-tight text-white tabular-nums sm:text-6xl">
          {value}
        </span>
        {unit && <span className="text-sm font-semibold text-[#A3A3A8] sm:text-base">{unit}</span>}
      </div>

      {sublabel && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium leading-relaxed text-[#A3A3A8]">{sublabel}</p>
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        active ? "border-line bg-surface text-foreground" : "border-line bg-muted/20 text-muted-foreground",
        className
      )}
      {...props}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-lime" : "bg-muted-foreground/40")}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
