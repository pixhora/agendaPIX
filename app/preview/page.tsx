import React from "react";
import Link from "next/link";
import {
  MOCK_BUSINESS_INFO,
  MOCK_SERVICES,
  MOCK_BOOKINGS,
} from "@/lib/preview/mock-data";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";
import { Button } from "@/components/ui/button";

const PREVIEW_CARDS = [
  {
    href: "/preview/landing",
    title: "1. Landing Page",
    desc: "Página de vendas focada em conversão, promessa central, benefícios, demo interativa e preços reais (R$ 29 e R$ 59).",
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
      <header className="border-b border-border bg-surface py-5 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">
                A
              </span>
              <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                Hub de Preview · Micro-SaaS
              </h1>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                100% Mockado
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Visualização determinística do produto sem dependência de banco, Better Auth ou gateway bancário externo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="min-h-9 text-xs font-semibold px-3">
              <Link href="/preview/booking">Testar Booking</Link>
            </Button>
            <Button asChild className="min-h-9 text-xs font-semibold px-3.5">
              <Link href="/preview/dashboard">Abrir Painel</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 space-y-8">
        {/* Banner do Negócio Mockado */}
        <section
          aria-label="Dados do estabelecimento em preview"
          className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Estabelecimento Ativo no Preview
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {MOCK_BUSINESS_INFO.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              📍 {MOCK_BUSINESS_INFO.address} • ⏰ {MOCK_BUSINESS_INFO.openDaysText}, {MOCK_BUSINESS_INFO.opensAt} às {MOCK_BUSINESS_INFO.closesAt}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-border/80 pt-3 md:pt-0 md:pl-6 text-center shrink-0">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Faturamento</p>
              <p className="text-base font-bold text-foreground mt-0.5">{formatCurrency(totalPrevistoCents)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Sinal Pix Pago</p>
              <p className="text-base font-bold text-emerald-600 mt-0.5">{formatCurrency(totalSinaisCents)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Confirmadas</p>
              <p className="text-base font-bold text-primary mt-0.5">{confirmadasCount}/{MOCK_BOOKINGS.length}</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PREVIEW_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-[170px]"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {card.title}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {card.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="pt-4 flex items-center text-xs font-semibold text-primary">
                  <span>Visualizar tela</span>
                  <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Serviços Rápidos no Hub */}
        <section aria-label="Catálogo de serviços cadastrados" className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-foreground">
              Serviços Determinísticos ({MOCK_SERVICES.length})
            </h3>
            <Link href="/preview/servicos" className="text-xs font-semibold text-primary hover:underline">
              Ver todos os detalhes
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MOCK_SERVICES.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-background p-3.5 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-foreground">
                  <span>{s.name}</span>
                  <span>{formatCurrency(s.priceCents)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>⏱ {formatDuration(s.durationMinutes)}</span>
                  <span className="text-emerald-600 font-medium">Sinal: {formatCurrency(s.depositCents)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
