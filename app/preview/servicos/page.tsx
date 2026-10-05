import React from "react";
import { MOCK_SERVICES } from "@/lib/preview/mock-data";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";
import { PreviewHeader } from "@/components/preview/PreviewNav";

export default function PreviewServicosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <PreviewHeader
        title="Serviços e Preços"
        subtitle="Procedimentos oferecidos aos clientes com cobrança de sinal no Pix"
        currentPath="/preview/servicos"
      />

      {/* Conteúdo */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            3 serviços determinísticos cadastrados para o Studio Bella.
          </p>
          <span className="rounded-md bg-success-soft px-2 py-1 text-xs font-semibold text-success">
            Valores em Centavos (BRL)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MOCK_SERVICES.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-foreground">{s.name}</h2>
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                    Ativo
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
                  <div className="flex justify-between">
                    <span>⏱ Duração:</span>
                    <strong className="text-foreground">{formatDuration(s.durationMinutes)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>💰 Preço total:</span>
                    <strong className="text-foreground">{formatCurrency(s.priceCents)}</strong>
                  </div>
                  <div className="flex justify-between text-pix dark:text-primary">
                    <span className="font-semibold">⚡ Sinal no Pix:</span>
                    <strong className="font-bold">{formatCurrency(s.depositCents)}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border text-[11px] text-muted-foreground">
                <span>{s.depositCents > 0 ? "Sinal obrigatório para reservar" : "Sem cobrança de sinal"}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
