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
          {/* Coluna Esquerda: Narrativa Editorial e CTAs */}
          <div className="lg:col-span-7 text-left max-w-2xl mx-auto lg:mx-0">
            {/* Badge de Contexto */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/15 bg-white px-3.5 py-1 text-xs font-semibold text-[#0F3B2E] mb-5 shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-[#C0F739]" />
              <span>Agenda online com cobrança de sinal por Pix</span>
            </div>

            {/* Título Principal Editorial */}
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#111613] sm:text-5xl lg:text-6xl leading-[1.12]">
              Sua agenda no piloto automático com{" "}
              <span className="text-[#0F3B2E] underline decoration-[#C0F739] decoration-4 underline-offset-4">
                sinal por Pix
              </span>
              .
            </h1>

            {/* Subtítulo Claro e com Respiro */}
            <p className="mt-5 text-base sm:text-lg text-[#5A645C] leading-relaxed max-w-xl">
              Envie seu link no WhatsApp ou Instagram. Seu cliente escolhe o serviço e o horário sozinho e garante a vaga pagando o sinal no Pix. Acabe com o prejuízo de horários vazios.
            </p>

            {/* Botões Pill de Conversão */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center rounded-full bg-[#C0F739] hover:bg-[#B0EE24] text-[#111613] px-7 py-3.5 text-base font-bold shadow-sm transition-all focus:outline-hidden focus:ring-2 focus:ring-[#0F3B2E] focus:ring-offset-2 text-center"
              >
                Começar teste grátis de 7 dias
              </Link>

              <a
                href="#demonstracao"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E2E6DF] bg-white hover:bg-neutral-50 text-[#111613] px-5 py-3.5 text-sm font-semibold transition-all focus:outline-hidden text-center"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F3B2E] text-[#C0F739] text-xs">
                  ▶
                </span>
                Ver demonstração ao vivo
              </a>
            </div>

            {/* Garantias de Baixo Atrito */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#5A645C]">
              <span className="flex items-center gap-1.5">
                <strong className="text-[#0F3B2E]">✓</strong> Sem cartão de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <strong className="text-[#0F3B2E]">✓</strong> Ativação em 3 minutos
              </span>
              <span className="flex items-center gap-1.5">
                <strong className="text-[#0F3B2E]">✓</strong> Cancele quando quiser
              </span>
            </div>

            {/* Divisor Fino e Badges de Nichos */}
            <div className="mt-8 pt-6 border-t border-[#E2E6DF]">
              <p className="text-[11px] font-semibold text-[#5A645C] uppercase tracking-wider mb-2.5">
                Feito para quem vive de atendimento:
              </p>
              <div className="flex flex-wrap gap-2">
                {NICHES.map((niche) => (
                  <span
                    key={niche}
                    className="inline-block rounded-full border border-[#E2E6DF] bg-white/80 px-3 py-1 text-xs font-medium text-[#5A645C]"
                  >
                    {niche}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Composição Visual em Camadas */}
          <div className="lg:col-span-5 flex justify-center">
            <LandingHeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
