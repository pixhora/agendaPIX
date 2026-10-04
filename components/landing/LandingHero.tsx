import React from "react";
import Link from "next/link";
import { LandingHeroVisual } from "./LandingHeroVisual";

const NICHES = [
  "Barbearias",
  "Salões de Beleza",
  "Clínicas",
  "Manicures",
  "Personal Trainers",
  "Estúdios",
];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-8 pb-14 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Coluna Esquerda: Narrativa e CTAs */}
          <div className="lg:col-span-7 text-left max-w-2xl mx-auto lg:mx-0">
            {/* Chip de Contexto v2 */}
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1 text-xs font-semibold text-foreground mb-5 shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-lime" />
              <span>Agenda online com cobrança de sinal por Pix</span>
            </div>

            {/* Título Principal Editorial */}
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.12]">
              Seu cliente agenda sozinho e paga o{" "}
              <span className="text-foreground underline decoration-ink decoration-4 underline-offset-4">
                sinal por Pix
              </span>
              .
            </h1>

            {/* Subtítulo Claro e com Respiro */}
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              Envie seu link no WhatsApp ou Instagram. Seu cliente escolhe o serviço e o horário sozinho e garante a vaga pagando o sinal no Pix. Acabe com o prejuízo de horários vazios.
            </p>

            {/* Botões Pill de Conversão (Preto primário conforme brief v2) */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/onboarding"
                className="w-full sm:w-auto min-h-12 inline-flex items-center justify-center rounded-full bg-ink hover:opacity-90 text-paper px-7 py-3 text-base font-bold shadow-sm transition-all duration-120 active:scale-[0.98] motion-reduce:transform-none focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 text-center"
              >
                Começar teste grátis de 7 dias
              </Link>

              <a
                href="#demonstracao"
                className="w-full sm:w-auto min-h-12 inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface hover:bg-paper text-foreground px-5 py-3 text-sm font-semibold transition-all duration-120 active:scale-[0.98] motion-reduce:transform-none focus:outline-hidden text-center"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper text-[10px] shrink-0">
                  ▶
                </span>
                Ver demonstração ao vivo
              </a>
            </div>

            {/* Garantias de Baixo Atrito */}
            <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-x-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <strong className="text-foreground">✓</strong> Sem cartão de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <strong className="text-foreground">✓</strong> Ativação em 3 minutos
              </span>
              <span className="flex items-center gap-1.5">
                <strong className="text-foreground">✓</strong> Cancele quando quiser
              </span>
            </div>

            {/* Divisor Fino e Chips de Nichos */}
            <div className="mt-8 pt-6 border-t border-line">
              <p className="text-xs font-semibold text-muted-foreground mb-2.5">
                Feito para quem vive de atendimento:
              </p>
              <div className="flex flex-wrap gap-2">
                {NICHES.map((niche) => (
                  <span
                    key={niche}
                    className="inline-block rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {niche}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Placa de Valor de Assinatura */}
          <div className="lg:col-span-5 flex justify-center">
            <LandingHeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
