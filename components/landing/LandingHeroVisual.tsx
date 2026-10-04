import React from "react";
import { ValueSlab } from "@/components/ui/value-slab";

export function LandingHeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[420px] lg:max-w-none flex flex-col items-center justify-center py-6 select-none space-y-4">
      {/* Placa de Valor Oficial v2 (Assinatura Central do Sinal) */}
      <div className="w-full max-w-[360px] sm:max-w-[400px]">
        <ValueSlab
          label="Sinal no Pix garantido"
          value="R$ 30"
          badge="Instantâneo"
          subtext="Horário das 14h30 bloqueado na hora · Sem calote"
          className="ring-1 ring-white/10"
        />
      </div>

      {/* Cartão de Apoio com Estado do Agendamento */}
      <div className="w-full max-w-[360px] sm:max-w-[400px] rounded-2xl border border-line bg-surface p-4 shadow-sm flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-lime" />
          <div>
            <p className="font-bold text-foreground">Bianca Taylor · Corte + Escova</p>
            <p className="text-[11px] text-muted-foreground">Hoje · 14h30 às 15h30</p>
          </div>
        </div>
        <span className="rounded-full bg-paper px-2.5 py-1 font-semibold text-[11px] text-foreground border border-line">
          Confirmado
        </span>
      </div>
    </div>
  );
}
