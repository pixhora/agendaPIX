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
    <div className="min-h-screen bg-[#F5F6F2] text-[#111613] pb-20">
      {/* Header do Hub */}
      <header className="border-b border-[#E2E6DF] bg-white/80 backdrop-blur-md py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0F3B2E] text-xs font-black text-[#C0F739]">
                A
              </span>
              <h1 className="font-display text-xl font-extrabold tracking-tight text-[#111613]">
                Hub de Preview · Modo Determinístico
              </h1>
              <span className="rounded-full bg-[#C0F739] px-2.5 py-0.5 text-[10px] font-extrabold text-[#111613] uppercase">
                100% Mockado
              </span>
            </div>
            <p className="mt-1 text-xs text-[#5A645C]">
              Visualização determinística do produto sem dependência de banco de dados, Better Auth ou provedor de Pix externo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/preview/booking"
              className="inline-flex items-center justify-center rounded-full border border-[#E2E6DF] bg-white hover:bg-neutral-50 px-4 py-2 text-xs font-bold text-[#111613] transition-colors"
            >
              Testar Booking
            </Link>
            <Link
              href="/preview/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-[#C0F739] hover:bg-[#B0EE24] px-4 py-2 text-xs font-extrabold text-[#111613] shadow-xs transition-transform active:scale-95"
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
          className="rounded-3xl border border-[#E2E6DF] bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="space-y-1.5">
            <span className="inline-block rounded-full bg-[#0F3B2E] text-[#C0F739] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Estabelecimento Ativo
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111613]">
              {MOCK_BUSINESS_INFO.name}
            </h2>
            <p className="text-xs text-[#5A645C]">
              📍 {MOCK_BUSINESS_INFO.address} • ⏰ {MOCK_BUSINESS_INFO.openDaysText}, {MOCK_BUSINESS_INFO.opensAt} às {MOCK_BUSINESS_INFO.closesAt}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t md:border-t-0 md:border-l border-[#E2E6DF] pt-4 md:pt-0 md:pl-8 text-center shrink-0">
            <div>
              <p className="text-[10px] text-[#5A645C] uppercase font-bold">Faturamento</p>
              <p className="text-base sm:text-lg font-black text-[#111613] mt-0.5">{formatCurrency(totalPrevistoCents)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#5A645C] uppercase font-bold">Sinal Pix Pago</p>
              <p className="text-base sm:text-lg font-black text-[#0F3B2E] mt-0.5">{formatCurrency(totalSinaisCents)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#5A645C] uppercase font-bold">Confirmadas</p>
              <p className="text-base sm:text-lg font-black text-[#111613] mt-0.5">{confirmadasCount}/{MOCK_BOOKINGS.length}</p>
            </div>
          </div>
        </section>

        {/* Grade de Navegação das Telas */}
        <section aria-label="Telas disponíveis no preview" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-[#111613]">
              Telas Disponíveis para Demonstração
            </h3>
            <span className="text-xs text-[#5A645C]">Selecione para navegar</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PREVIEW_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col justify-between rounded-3xl border border-[#E2E6DF] bg-white p-6 shadow-xs transition-all hover:border-[#0F3B2E] hover:shadow-md min-h-[180px]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold text-[#111613] group-hover:text-[#0F3B2E] transition-colors">
                      {card.title}
                    </span>
                    <span className="rounded-full bg-[#F5F6F2] border border-[#E2E6DF] px-2.5 py-0.5 text-[10px] font-bold text-[#5A645C]">
                      {card.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#5A645C] leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="pt-4 flex items-center text-xs font-bold text-[#0F3B2E]">
                  <span>Visualizar tela</span>
                  <span className="ml-1.5 transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Serviços Rápidos no Hub */}
        <section aria-label="Catálogo de serviços cadastrados" className="rounded-3xl border border-[#E2E6DF] bg-white p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-[#111613]">
              Serviços Determinísticos ({MOCK_SERVICES.length})
            </h3>
            <Link href="/preview/servicos" className="text-xs font-bold text-[#0F3B2E] hover:underline">
              Ver todos os detalhes →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {MOCK_SERVICES.map((s) => (
              <div key={s.id} className="rounded-2xl border border-[#E2E6DF] bg-[#F5F6F2] p-4 space-y-1.5 text-xs">
                <div className="flex justify-between font-bold text-[#111613]">
                  <span>{s.name}</span>
                  <span>{formatCurrency(s.priceCents)}</span>
                </div>
                <div className="flex justify-between text-[#5A645C] text-[11px]">
                  <span>⏱ {formatDuration(s.durationMinutes)}</span>
                  <span className="text-[#0F3B2E] font-bold">Sinal: {formatCurrency(s.depositCents)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
