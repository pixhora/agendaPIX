import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingPricing() {
  return (
    <section id="precos" className="py-14 sm:py-20 border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Preço justo e transparente
          </span>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Invista menos de 1 corte por mês e pare de perder horários
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Comece com 7 dias grátis sem precisar colocar cartão de crédito. Se não gostar, não paga nada.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
          {/* Plano Base */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-background p-6 sm:p-8 shadow-sm">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-xl font-bold text-foreground">Plano Base</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Ideal para profissional autônomo que quer parar de tomar calote.
                </p>
              </div>

              <div className="flex items-baseline gap-1 pt-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-foreground">R$ 29</span>
                <span className="text-sm font-medium text-muted-foreground">/ mês</span>
              </div>

              <ul className="space-y-3 pt-4 border-t border-border text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>1 profissional / agenda</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Agendamentos ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Cobrança de sinal por Pix automático</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Link de confirmação via WhatsApp</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Régua tátil de horários mobile</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Button asChild variant="outline" className="w-full min-h-11 font-semibold">
                <Link href="/onboarding?plano=base">Começar teste de 7 dias</Link>
              </Button>
            </div>
          </div>

          {/* Plano Completo (Destaque) */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-primary bg-background p-6 sm:p-8 shadow-md ring-1 ring-primary/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
              Mais Escolhido
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-display text-xl font-bold text-foreground">Plano Completo</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Para quem quer controle completo de faturamento e múltiplos serviços.
                </p>
              </div>

              <div className="flex items-baseline gap-1 pt-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-foreground">R$ 59</span>
                <span className="text-sm font-medium text-muted-foreground">/ mês</span>
              </div>

              <ul className="space-y-3 pt-4 border-t border-border text-sm text-muted-foreground">
                <li className="flex items-center gap-2 font-medium text-foreground">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Tudo incluído no Plano Base</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Múltiplos serviços com durações personalizadas</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Relatórios de agendamentos e faturamento</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Gestão completa de clientes e histórico</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Suporte prioritário direto via WhatsApp</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Button asChild className="w-full min-h-11 font-semibold shadow-sm">
                <Link href="/onboarding?plano=completo">Começar teste de 7 dias</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          🔒 Teste gratuito por 7 dias. Sem fidelidade, sem pegadinhas e sem necessidade de cartão de crédito antecipado.
        </div>
      </div>
    </section>
  );
}
