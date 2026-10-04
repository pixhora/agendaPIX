import React from "react";

interface ValueSlabProps {
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  badge?: string;
  className?: string;
}

/**
 * Elemento-assinatura v2: Placa de Valor (--slab)
 * Fundo escuro (#0B0B0C claro, #000000 escuro) com número gigante de 64px branco,
 * font-variant-numeric: tabular-nums e acento fino em lima.
 */
export function ValueSlab({
  label,
  value,
  unit,
  subtext,
  badge,
  className = "",
}: ValueSlabProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-line bg-slab p-6 sm:p-8 text-slab-foreground shadow-xl ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
          {label}
        </span>
        {badge && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />
            {badge}
          </span>
        )}
      </div>

      <div className="pt-5 pb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-5xl sm:text-6xl font-black tracking-tight text-white tabular-nums leading-none">
            {value}
          </span>
          {unit && (
            <span className="text-sm sm:text-base font-semibold text-white/70">
              {unit}
            </span>
          )}
        </div>
        {subtext && (
          <p className="mt-2.5 text-xs text-white/60 leading-relaxed">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
