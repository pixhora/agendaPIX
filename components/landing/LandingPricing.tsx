import React from "react";
import Link from "next/link";

export function LandingPricing() {
  return (
    <section id="precos" className="py-16 sm:py-24 border-t border-[#E2E6DF] bg-white/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-block rounded-full bg-[#0F3B2E] text-[#C0F739] px-3.5 py-1 text-xs font-bold uppercase tracking-wider mb-4">
            Preços Transparentes
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#111613]">
            Invista menos de 1 atendimento por mês e pare de perder horários
          </h2>
          <p className="mt-4 text-base text-[#5A645C] max-w-xl mx-auto">
            7 dias de teste grátis sem cartão de crédito. Se o seu faturamento não aumentar com o sinal no Pix, não paga nada.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
          {/* Plano Base */}
          <div className="flex flex-col justify-between rounded-3xl border border-[#E2E6DF] bg-white p-7 sm:p-9 shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-4">
              <div>
                <span className="inline-block rounded-full bg-[#F5F6F2] px-3 py-1 text-xs font-bold text-[#5A645C]">
                  Autônomos e Iniciantes
                </span>
                <h3 className="font-display text-2xl font-extrabold text-[#111613] mt-2">Plano Base</h3>
                <p className="text-xs text-[#5A645C] mt-1">
                  Para profissional que atende sozinho e quer parar de tomar calote de clientes.
                </p>
              </div>

              <div className="flex items-baseline gap-1.5 pt-2">
                <span className="text-4xl sm:text-5xl font-black text-[#111613]">R$ 29</span>
                <span className="text-sm font-semibold text-[#5A645C]">/ mês</span>
              </div>

              <ul className="space-y-3 pt-5 border-t border-[#E2E6DF] text-xs sm:text-sm text-[#5A645C]">
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span className="text-[#111613] font-medium">1 profissional / 1 agenda</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span>Agendamentos ilimitados no mês</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span className="text-[#111613] font-semibold">Cobrança de sinal Pix automático</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span>Link com confirmação no WhatsApp</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span>Régua de horários otimizada para celular</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Link
                href="/onboarding?plano=base"
                className="w-full inline-flex items-center justify-center rounded-full border-2 border-[#111613] bg-white hover:bg-neutral-50 px-6 py-3.5 text-sm font-bold text-[#111613] transition-colors text-center"
              >
                Começar teste de 7 dias
              </Link>
            </div>
          </div>

          {/* Plano Completo (Destaque Verde-Petróleo & Lima) */}
          <div className="relative flex flex-col justify-between rounded-3xl border-2 border-[#0F3B2E] bg-white p-7 sm:p-9 shadow-xl">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#0F3B2E] px-4 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#C0F739] shadow-sm">
              Mais Escolhido
            </div>

            <div className="space-y-4">
              <div>
                <span className="inline-block rounded-full bg-[#C0F739]/30 px-3 py-1 text-xs font-bold text-[#0F3B2E]">
                  Crescimento e Estabelecimentos
                </span>
                <h3 className="font-display text-2xl font-extrabold text-[#111613] mt-2">Plano Completo</h3>
                <p className="text-xs text-[#5A645C] mt-1">
                  Para quem quer gestão completa de clientes, relatórios financeiros e múltiplos serviços.
                </p>
              </div>

              <div className="flex items-baseline gap-1.5 pt-2">
                <span className="text-4xl sm:text-5xl font-black text-[#111613]">R$ 59</span>
                <span className="text-sm font-semibold text-[#5A645C]">/ mês</span>
              </div>

              <ul className="space-y-3 pt-5 border-t border-[#E2E6DF] text-xs sm:text-sm text-[#5A645C]">
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span className="text-[#111613] font-bold">Tudo incluso no Plano Base</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span className="text-[#111613] font-semibold">Múltiplos serviços com sinais diferentes</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span>Relatórios de faturamento e sinais recebidos</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span>Histórico completo e lista de clientes</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#0F3B2E] font-bold text-sm">✓</span>
                  <span className="text-[#0F3B2E] font-semibold">Suporte prioritário via WhatsApp</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Link
                href="/onboarding?plano=completo"
                className="w-full inline-flex items-center justify-center rounded-full bg-[#C0F739] hover:bg-[#B0EE24] px-6 py-3.5 text-sm font-extrabold text-[#111613] shadow-md transition-all text-center"
              >
                Começar teste de 7 dias grátis
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-[#5A645C]">
          🔒 Teste sem risco por 7 dias. Sem fidelidade, sem pegadinhas e sem necessidade de cartão de crédito.
        </div>
      </div>
    </section>
  );
}
