import React from "react";

export function LandingHeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[420px] lg:max-w-none flex items-center justify-center py-6 select-none">
      {/* Círculo fino concêntrico de profundidade */}
      <div 
        className="absolute w-[290px] h-[290px] sm:w-[380px] sm:h-[380px] rounded-full border border-lime-500/25 pointer-events-none" 
        style={{
          background: "radial-gradient(circle, rgba(192, 247, 57, 0.08) 0%, rgba(245, 246, 242, 0) 70%)"
        }}
      />
      <div className="absolute w-[220px] h-[220px] sm:w-[280px] sm:h-[280px] rounded-full border border-dashed border-emerald-800/15 pointer-events-none" />

      {/* Composição em camadas sobrepostas */}
      <div className="relative w-full max-w-[350px] sm:max-w-[390px] h-[360px] sm:h-[400px]">
        {/* Card 1: Estatísticas do Topo (Branco puro) */}
        <div className="absolute top-0 right-2 sm:right-4 z-20 w-[190px] sm:w-[210px] rounded-2xl bg-surface p-3.5 shadow-md border border-border">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-2">
            <span>Sinais no Pix</span>
            <span className="text-accent-forest dark:text-primary font-bold">+100% pago</span>
          </div>
          {/* Mini gráfico de barras estilizado */}
          <div className="flex items-end gap-1.5 h-10 pb-1">
            <div className="flex-1 bg-lime-100 dark:bg-lime-900/40 rounded-sm h-[40%]" />
            <div className="flex-1 bg-lime-200 dark:bg-lime-800/50 rounded-sm h-[65%]" />
            <div className="flex-1 bg-lime-300 dark:bg-lime-700/60 rounded-sm h-[50%]" />
            <div className="flex-1 bg-lime-400 dark:bg-lime-600/70 rounded-sm h-[80%]" />
            <div className="flex-1 bg-primary rounded-sm h-[100%]" />
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border/60 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Hoje</span>
            <span className="text-xs font-bold text-foreground">R$ 105,00</span>
          </div>
        </div>

        {/* Card 2: Destaque Central Verde-Lima (Cartão de Confirmação do Pix) */}
        <div 
          className="absolute top-16 right-0 z-30 w-[240px] sm:w-[280px] rounded-3xl p-5 shadow-xl border border-lime-300/60"
          style={{
            background: "linear-gradient(135deg, #C0F739 0%, #AEEF20 100%)",
            color: "#111613"
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold bg-black/10 px-2.5 py-0.5 rounded-full">
              Pix instantâneo
            </span>
            {/* Ícone de sinal wireless / contactless minimalista */}
            <div className="flex items-center gap-0.5 text-black/60">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-black/60" />
              <span className="inline-block w-1 h-3 rounded-full border border-black/60" />
              <span className="inline-block w-1 h-4 rounded-full border border-black/60" />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-medium text-black/70">Sinal garantido</p>
            <p className="text-2xl font-extrabold tracking-tight">R$ 30,00</p>
          </div>

          <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between text-xs">
            <div>
              <p className="text-[10px] text-black/60 uppercase">Cliente</p>
              <p className="font-bold">Bianca Taylor</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-black/60 uppercase">Horário</p>
              <p className="font-bold">Hoje · 14h30</p>
            </div>
          </div>
        </div>

        {/* Card 3: Card Escuro Sobreposto (Verde Petróleo Profundo) */}
        <div className="absolute bottom-4 left-0 z-10 w-[230px] sm:w-[260px] rounded-3xl bg-[#0E1612] p-5 shadow-2xl border border-emerald-900/40 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#C0F739]" />
              <span className="text-[11px] font-semibold text-emerald-400">Próximo na Agenda</span>
            </div>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white/80">
              Corte + Barba
            </span>
          </div>

          <p className="text-xs text-white/70">Carlos Eduardo</p>
          <p className="text-lg font-bold text-white mt-0.5">15:30 — 16:30</p>

          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[11px] text-white/60">Restante no local:</span>
            <span className="text-xs font-semibold text-[#C0F739]">R$ 50,00</span>
          </div>
        </div>

        {/* Pílula Flutuante: Badge de Entrada */}
        <div className="absolute bottom-0 right-2 z-40 bg-surface border border-border rounded-full px-3.5 py-1.5 shadow-lg flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-foreground">Vaga confirmada</span>
        </div>
      </div>
    </div>
  );
}
