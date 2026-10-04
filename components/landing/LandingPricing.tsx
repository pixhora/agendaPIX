import React from "react";
import Link from "next/link";

export function LandingPricing() {
  return (
    <section id="precos" className="py-16 sm:py-24 border-t border-border bg-surface/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Invista menos de 1 atendimento por mês e pare de perder horários
          </h2>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
            7 dias de teste grátis sem cartão de crédito. Se o seu faturamento não aumentar com o sinal no Pix, não paga nada.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
          {/* Plano Base */}
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-surface p-5 sm:p-9 shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-4">
              <div>
                <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                  Autônomos e Iniciantes
                </span>
                <h3 className="font-display text-2xl font-extrabold text-foreground mt-2">Plano Base</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Para profissional que atende sozinho e quer parar de tomar calote de clientes.
                </p>
              </div>

              <div className="flex items-baseline gap-1.5 pt-2">
                <span className="text-4xl sm:text-5xl font-black text-foreground">R$ 49</span>
                <span className="text-sm font-semibold text-muted-foreground">/ mês</span>
              </div>

              <ul className="space-y-3 pt-5 border-t border-border text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span className="text-foreground font-medium">1 profissional / 1 agenda</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span>Agendamentos ilimitados no mês</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span className="text-foreground font-semibold">Cobrança de sinal no Pix com confirmação imediata</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span>Link com confirmação no WhatsApp</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span>Régua de horários otimizada para celular</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Link
                href="/onboarding?plano=base"
                className="w-full min-h-12 inline-flex items-center justify-center rounded-full border-2 border-foreground bg-surface hover:bg-muted px-6 py-3 text-sm font-bold text-foreground transition-colors text-center"
              >
                Começar teste de 7 dias
              </Link>
            </div>
          </div>

          {/* Plano Completo (Destaque Verde-Petróleo & Lima) */}
          <div className="relative flex flex-col justify-between rounded-3xl border-2 border-accent-forest dark:border-primary bg-surface p-5 sm:p-9 shadow-xl">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent-forest px-4 py-1 text-xs font-bold text-primary shadow-sm">
              Mais escolhido
            </div>

            <div className="space-y-4">
              <div>
                <span className="inline-block rounded-full bg-primary/20 text-accent-forest dark:text-primary px-3 py-1 text-xs font-bold">
                  Crescimento e Estabelecimentos
                </span>
                <h3 className="font-display text-2xl font-extrabold text-foreground mt-2">Plano Completo</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Para quem quer gestão completa de clientes, relatórios financeiros e múltiplos serviços.
                </p>
              </div>

              <div className="flex items-baseline gap-1.5 pt-2">
                <span className="text-4xl sm:text-5xl font-black text-foreground">R$ 79</span>
                <span className="text-sm font-semibold text-muted-foreground">/ mês</span>
              </div>

              <ul className="space-y-3 pt-5 border-t border-border text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span className="text-foreground font-bold">Tudo incluso no Plano Base</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span className="text-foreground font-semibold">Múltiplos serviços com sinais diferentes</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span>Relatórios de faturamento e sinais recebidos</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span>Histórico completo e lista de clientes</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-accent-forest dark:text-primary font-bold text-sm">✓</span>
                  <span className="text-accent-forest dark:text-primary font-semibold">Suporte prioritário via WhatsApp</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Link
                href="/onboarding?plano=completo"
                className="w-full min-h-12 inline-flex items-center justify-center rounded-full bg-primary hover:bg-primary-hover px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-md transition-all text-center"
              >
                Começar teste de 7 dias grátis
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          🔒 Teste sem risco por 7 dias. Sem fidelidade, sem pegadinhas e sem necessidade de cartão de crédito.
        </div>
      </div>
    </section>
  );
}
