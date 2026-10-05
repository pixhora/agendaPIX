import React from "react";
import Link from "next/link";
import {
  MOCK_BUSINESS_INFO,
  MOCK_SERVICES,
  MOCK_BOOKINGS,
} from "@/lib/preview/mock-data";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";

const PREVIEW_CARDS = [
  {
    href: "/preview/landing",
    title: "1. Landing Page",
    desc: "Página de vendas focada em conversão, promessa central, benefícios, demo interativa e preços reais (R$ 49 e R$ 79).",
    badge: "Pública",
  },
  {
    href: "/preview/booking",
    title: "2. Booking Público (Mobile-First)",
    desc: "Fluxo completo de agendamento do cliente no celular: serviço → régua de horários → dados → sinal por Pix → confirmação.",
    badge: "Cliente",
  },
  {
    href: "/preview/dashboard",
    title: "3. Dashboard do Dono",
    desc: "Painel operacional com métricas do dia, faturamento previsto, sinais recebidos no Pix e timeline de atendimentos.",
    badge: "Painel",
  },
  {
    href: "/preview/reservas",
    title: "4. Reservas e Agenda",
    desc: "Gestão dos agendamentos do dia, clientes (Camila, Juliana, Beatriz, etc.), status e lembrete direto via WhatsApp.",
    badge: "Operacional",
  },
  {
    href: "/preview/servicos",
    title: "5. Serviços e Preços",
    desc: "Catálogo de procedimentos com duração, preço total e valor do sinal exigido no Pix em centavos.",
    badge: "Catálogo",
  },
  {
    href: "/preview/configuracoes",
    title: "6. Configurações da Empresa",
    desc: "Horários de funcionamento, fuso horário de São Paulo e link público compartilhável do Studio Bella.",
    badge: "Ajustes",
  },
];

export default function PreviewHubPage() {
  const totalPrevistoCents = MOCK_BOOKINGS.reduce((acc, b) => acc + b.priceCents, 0);
  const totalSinaisCents = MOCK_BOOKINGS.reduce(
    (acc, b) => acc + (b.status === "confirmed" ? b.depositCents : 0),
    0
  );
  const confirmadasCount = MOCK_BOOKINGS.filter((b) => b.status === "confirmed").length;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header do Hub */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-forest text-xs font-black text-primary">
                A
              </span>
              <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground">
                Hub de Preview · Modo Determinístico
              </h1>
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold text-primary-foreground uppercase">
                100% Mockado
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Visualização determinística do produto sem dependência de banco de dados, Better Auth ou provedor de Pix externo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/preview/booking"
              className="inline-flex items-center justify-center rounded-full border border-border bg-surface hover:bg-muted px-4 py-2 text-xs font-bold text-foreground transition-colors"
            >
              Testar Booking
            </Link>
            <Link
              href="/preview/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-primary hover:bg-primary-hover px-4 py-2 text-xs font-extrabold text-primary-foreground shadow-xs transition-transform active:scale-95"
            >
              Abrir Painel
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 space-y-8">
        {/* Banner do Negócio Mockado */}
        <section
          aria-label="Dados do estabelecimento em preview"
          className="rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="space-y-1.5">
            <span className="inline-block rounded-full bg-accent-forest text-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Estabelecimento Ativo
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
              {MOCK_BUSINESS_INFO.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              📍 {MOCK_BUSINESS_INFO.address} • ⏰ {MOCK_BUSINESS_INFO.openDaysText}, {MOCK_BUSINESS_INFO.opensAt} às {MOCK_BUSINESS_INFO.closesAt}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-8 text-center shrink-0">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Faturamento</p>
              <p className="text-base sm:text-lg font-black text-foreground mt-0.5">{formatCurrency(totalPrevistoCents)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Sinal Pix Pago</p>
              <p className="text-base sm:text-lg font-black text-accent-forest dark:text-primary mt-0.5">{formatCurrency(totalSinaisCents)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Confirmadas</p>
              <p className="text-base sm:text-lg font-black text-foreground mt-0.5">{confirmadasCount}/{MOCK_BOOKINGS.length}</p>
            </div>
          </div>
        </section>

        {/* Grade de Navegação das Telas */}
        <section aria-label="Telas disponíveis no preview" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-foreground">
              Telas Disponíveis para Demonstração
            </h3>
            <span className="text-xs text-muted-foreground">Selecione para navegar</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PREVIEW_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col justify-between rounded-3xl border border-border bg-surface p-6 shadow-xs transition-all hover:border-primary hover:shadow-md min-h-[180px]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors">
                      {card.title}
                    </span>
                    <span className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {card.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="pt-4 flex items-center text-xs font-bold text-accent-forest dark:text-primary">
                  <span>Visualizar tela</span>
                  <span className="ml-1.5 transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Serviços Rápidos no Hub */}
        <section aria-label="Catálogo de serviços cadastrados" className="rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-foreground">
              Serviços Determinísticos ({MOCK_SERVICES.length})
            </h3>
            <Link href="/preview/servicos" className="text-xs font-bold text-accent-forest dark:text-primary hover:underline">
              Ver todos os detalhes →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {MOCK_SERVICES.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-muted/30 p-4 space-y-1.5 text-xs">
                <div className="flex justify-between font-bold text-foreground">
                  <span>{s.name}</span>
                  <span>{formatCurrency(s.priceCents)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>⏱ {formatDuration(s.durationMinutes)}</span>
                  <span className="text-accent-forest dark:text-primary font-bold">Sinal: {formatCurrency(s.depositCents)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
