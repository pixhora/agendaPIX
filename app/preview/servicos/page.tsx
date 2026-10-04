import React from "react";
import Link from "next/link";
import { MOCK_BUSINESS_INFO, MOCK_SERVICES, MOCK_BOOKINGS } from "@/lib/preview/mock-data";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";

export default function PreviewServicosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header do Painel */}
      <header className="border-b border-border bg-surface py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              SB
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold text-foreground">
                  Serviços e Preços
                </h1>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {MOCK_BUSINESS_INFO.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Procedimentos oferecidos aos clientes com cobrança de sinal no Pix
              </p>
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-2 text-xs font-semibold sm:flex sm:items-center" aria-label="Navegação do painel">
            <Link
              href="/preview/dashboard"
              className="flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:text-foreground sm:min-h-0 sm:shrink-0"
            >
              Visão Geral
            </Link>
            <Link
              href="/preview/reservas"
              className="flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:text-foreground sm:min-h-0 sm:shrink-0"
            >
              Reservas ({MOCK_BOOKINGS.length})
            </Link>
            <Link
              href="/preview/servicos"
              className="flex min-h-11 items-center justify-center rounded-lg bg-primary text-primary-foreground px-3 py-1.5 sm:min-h-0 sm:shrink-0"
            >
              Serviços ({MOCK_SERVICES.length})
            </Link>
            <Link
              href="/preview/configuracoes"
              className="flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:text-foreground sm:min-h-0 sm:shrink-0"
            >
              Configurações
            </Link>
          </nav>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            3 serviços determinísticos cadastrados para o Studio Bella.
          </p>
          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">
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
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
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
                  <div className="flex justify-between text-primary">
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
