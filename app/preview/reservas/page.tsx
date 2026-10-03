"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MOCK_BUSINESS_INFO, MOCK_BOOKINGS, MOCK_SERVICES } from "@/lib/preview/mock-data";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";

export default function PreviewReservasPage() {
  const [filter, setFilter] = useState<"all" | "confirmed" | "pending_payment">("all");

  const filtered = MOCK_BOOKINGS.filter((b) => {
    if (filter === "all") return true;
    return b.status === filter;
  });

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
                  Reservas do Dia
                </h1>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {MOCK_BUSINESS_INFO.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lista de clientes e confirmação de pagamento de sinal Pix
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-xs font-semibold overflow-x-auto pb-1 sm:pb-0" aria-label="Navegação do painel">
            <Link
              href="/preview/dashboard"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              Visão Geral
            </Link>
            <Link
              href="/preview/reservas"
              className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 shrink-0"
            >
              Reservas ({MOCK_BOOKINGS.length})
            </Link>
            <Link
              href="/preview/servicos"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              Serviços ({MOCK_SERVICES.length})
            </Link>
            <Link
              href="/preview/configuracoes"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              Configurações
            </Link>
          </nav>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold" role="tablist" aria-label="Filtro de reservas">
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                filter === "all"
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground border border-border hover:bg-muted"
              }`}
            >
              Todas ({MOCK_BOOKINGS.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "confirmed"}
              onClick={() => setFilter("confirmed")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                filter === "confirmed"
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground border border-border hover:bg-muted"
              }`}
            >
              Confirmadas ({MOCK_BOOKINGS.filter((b) => b.status === "confirmed").length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "pending_payment"}
              onClick={() => setFilter("pending_payment")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                filter === "pending_payment"
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground border border-border hover:bg-muted"
              }`}
            >
              Aguardando Sinal ({MOCK_BOOKINGS.filter((b) => b.status === "pending_payment").length})
            </button>
          </div>

          <span className="text-xs text-muted-foreground">
            Hoje · {filtered.length} agendamento{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Lista de Reservas */}
        <div className="space-y-3">
          {filtered.map((booking) => {
            const isConfirmed = booking.status === "confirmed";
            const remainingCents = Math.max(0, booking.priceCents - booking.depositCents);
            const waLink = `https://wa.me/55${booking.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
              `Olá ${booking.customerName}! Aqui é do Studio Bella. Confirmando seu agendamento de ${booking.serviceName} para hoje às ${booking.timeFormatted.split(" ")[0]}.`
            )}`;

            return (
              <div
                key={booking.id}
                className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                      {booking.timeFormatted}
                    </span>
                    <h2 className="text-base font-bold text-foreground">
                      {booking.customerName}
                    </h2>
                  </div>

                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold self-start sm:self-auto ${
                      isConfirmed
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {isConfirmed ? "✓ Confirmada · Sinal Pago no Pix" : "⏳ Aguardando Sinal Pix"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Serviço</p>
                    <p className="font-semibold text-foreground mt-0.5">
                      {booking.serviceName} ({formatDuration(booking.durationMinutes)})
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Telefone / WhatsApp</p>
                    <p className="font-semibold text-foreground mt-0.5">
                      {booking.customerPhone}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Financeiro</p>
                    <p className="font-semibold text-foreground mt-0.5">
                      Total: {formatCurrency(booking.priceCents)} ·{" "}
                      <span className="text-emerald-600">Sinal: {formatCurrency(booking.depositCents)}</span>
                      {remainingCents > 0 && ` (Restam ${formatCurrency(remainingCents)} no local)`}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                  >
                    <span>💬</span> Conversar no WhatsApp
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
