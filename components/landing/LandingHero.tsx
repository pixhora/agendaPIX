import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
        {/* Badge de Destaque */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary mb-6">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Fim do calote e da perda de horário no WhatsApp</span>
        </div>

        {/* Título Principal Focado em Conversão */}
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl max-w-4xl mx-auto leading-[1.15]">
          Seu cliente agenda sozinho, paga o sinal por Pix e você{" "}
          <span className="text-primary underline decoration-primary/30 underline-offset-4">
            para de perder horário
          </span>
          .
        </h1>

        {/* Subtítulo Claro e Sem Jargão */}
        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Envie seu link exclusivo pelo WhatsApp ou coloque na bio do Instagram. O cliente escolhe o serviço e o horário em menos de 1 minuto e garante a vaga pagando o sinal pelo Pix.
        </p>

        {/* Botões de Ação */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
          <Button asChild className="w-full sm:w-auto min-h-12 px-6 text-base font-semibold shadow-md">
            <Link href="/onboarding">Começar teste grátis de 7 dias</Link>
          </Button>

          <Button asChild variant="outline" className="w-full sm:w-auto min-h-12 px-6 text-base font-medium">
            <a href="#demonstracao">Ver demonstração ao vivo</a>
          </Button>
        </div>

        {/* Garantias de Baixo Atrito */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> Sem cartão de crédito
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> Configuração em 3 minutos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> Cancele a qualquer momento
          </span>
        </div>
      </div>
    </section>
  );
}
