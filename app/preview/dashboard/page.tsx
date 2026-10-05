"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MOCK_BUSINESS_INFO,
  MOCK_BOOKINGS,
  MOCK_SERVICES,
} from "@/lib/preview/mock-data";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";
import { Button } from "@/components/ui/button";
import { PreviewHeader } from "@/components/preview/PreviewNav";
import { ValueSlab, StatusChip } from "@/components/ui/value-slab";

export default function PreviewDashboardPage() {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url =
      typeof window !== "undefined" && window.location.origin
        ? `${window.location.origin}/preview/booking`
        : "/preview/booking";
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const totalFaturamento = MOCK_BOOKINGS.reduce((acc, b) => acc + b.priceCents, 0);
  const totalSinaisPix = MOCK_BOOKINGS.reduce(
    (acc, b) => acc + (b.status === "confirmed" ? b.depositCents : 0),
    0
  );
  const confirmadas = MOCK_BOOKINGS.filter((b) => b.status === "confirmed").length;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <PreviewHeader currentPath="/preview/dashboard" />

      {/* Conteúdo Principal */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Banner do Link Público de Divulgação */}
        <section
          aria-label="Link público do estabelecimento"
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">Seu link público de agendamento:</p>
            <p className="font-mono text-accent-forest dark:text-primary font-bold">agenda.com.br/{MOCK_BUSINESS_INFO.slug}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={copied ? "default" : "outline"}
              onClick={handleCopyLink}
              className="min-h-11 text-xs font-semibold px-3.5 transition-all cursor-pointer"
              aria-live="polite"
            >
              {copied ? "✓ Copiado!" : "Copiar Link"}
            </Button>
            <Button asChild className="min-h-11 text-xs font-semibold px-4 cursor-pointer">
              <Link href="/preview/booking">Abrir página</Link>
            </Button>
          </div>
        </section>

        {/* Placa de Valor do Painel (Elemento-Assinatura v2) */}
        <section aria-label="Destaque de Sinais Garantidos no Pix">
          <ValueSlab
            label="Sinais Confirmados no Pix (Hoje)"
            value={formatCurrency(totalSinaisPix)}
            badge={
              <StatusChip active={true}>
                {confirmadas} reservas garantidas
              </StatusChip>
            }
            sublabel="Garantia antecipada em caixa contra no-show"
          />
        </section>

        {/* Indicadores Complementares do Dia (Métricas) */}
        <section aria-label="Métricas do dia" className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">
              Faturamento Previsto
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-foreground">
              {formatCurrency(totalFaturamento)}
            </p>
            <p className="text-[11px] text-muted-foreground">5 atendimentos agendados</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">
              Taxa de Comparecimento
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-foreground">
              100%
            </p>
            <p className="text-[11px] text-muted-foreground">Zero faltas após sinal</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-accent-forest dark:text-primary uppercase">
              Confirmadas
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-accent-forest dark:text-primary">
              {confirmadas} / {MOCK_BOOKINGS.length}
            </p>
            <p className="text-[11px] text-muted-foreground">1 aguardando sinal</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">
              Calotes Evitados
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-foreground">
              100%
            </p>
            <p className="text-[11px] text-emerald-600 font-medium">Zero no-show hoje</p>
          </div>
        </section>

        {/* Agenda e Próximos Atendimentos */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Timeline da Agenda */}
          <section aria-label="Agenda do dia" className="lg:col-span-8 rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Agenda de Hoje (Sexta-feira)
                </h2>
                <p className="text-xs text-muted-foreground">Expediente das 09:00 às 19:00</p>
              </div>
              <Button asChild variant="outline" className="min-h-11 text-xs font-semibold px-3.5 cursor-pointer">
                <Link href="/preview/reservas">Ver todas</Link>
              </Button>
            </div>

            <div className="space-y-3">
              {MOCK_BOOKINGS.map((booking) => {
                const isConfirmed = booking.status === "confirmed";
                const waLink = `https://wa.me/55${booking.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Olá ${booking.customerName}! Confirmando seu horário no Studio Bella hoje às ${booking.timeFormatted.split(" ")[0]}.`
                )}`;

                return (
                  <div
                    key={booking.id}
                    className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isConfirmed
                        ? "border-border bg-surface hover:border-primary/40"
                        : "border-amber-500/30 bg-amber-500/[0.02]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-lg p-2 text-center text-xs font-bold shrink-0 min-w-[70px] ${
                          isConfirmed
                            ? "bg-primary/10 text-primary"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {booking.timeFormatted.split(" ")[0]}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">
                            {booking.customerName}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isConfirmed
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {isConfirmed ? "Confirmada (Pix Pago)" : "Aguardando Sinal"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {booking.serviceName} ({formatDuration(booking.durationMinutes)}) · Total {formatCurrency(booking.priceCents)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          📱 {booking.customerPhone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Coluna Lateral: Resumo de Serviços e Configurações */}
          <section aria-label="Serviços ativos" className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-foreground">
                  Procedimentos Ativos
                </h3>
                <Link href="/preview/servicos" className="text-xs text-primary font-semibold hover:underline">
                  Gerenciar
                </Link>
              </div>

              <div className="space-y-2 text-xs">
                {MOCK_SERVICES.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border p-3 space-y-1">
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>{s.name}</span>
                      <span>{formatCurrency(s.priceCents)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground text-[11px]">
                      <span>{formatDuration(s.durationMinutes)}</span>
                      <span className="text-emerald-600 font-medium">Sinal: {formatCurrency(s.depositCents)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-2 text-xs">
              <h3 className="font-display text-sm font-bold text-foreground">
                Informações do Estabelecimento
              </h3>
              <p className="text-muted-foreground">
                <strong>Endereço:</strong> {MOCK_BUSINESS_INFO.address}
              </p>
              <p className="text-muted-foreground">
                <strong>Horário:</strong> {MOCK_BUSINESS_INFO.opensAt} às {MOCK_BUSINESS_INFO.closesAt}
              </p>
              <p className="text-muted-foreground">
                <strong>Dias:</strong> {MOCK_BUSINESS_INFO.openDaysText}
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
