"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const DEMO_STEPS = [
  {
    step: 1,
    title: "1. Escolha do serviço",
    desc: "O cliente vê o tempo de duração e o valor do sinal no Pix com total clareza.",
  },
  {
    step: 2,
    title: "2. Régua tátil de horários",
    desc: "Vê quantos horários restam para hoje e amanhã e escolhe a melhor vaga com 1 toque.",
  },
  {
    step: 3,
    title: "3. Nome e WhatsApp",
    desc: "Preenchimento rápido e direto, sem senhas complicadas nem cadastros longos.",
  },
  {
    step: 4,
    title: "4. Sinal pago por Pix",
    desc: "QR Code imediato com 15 minutos para pagar. Confirmou, a vaga é dele.",
  },
];

export function LandingInteractiveDemo() {
  const [activeStep, setActiveStep] = useState(1);

  return (
    <section id="demonstracao" className="py-14 sm:py-20 border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Demonstração em 4 passos
          </span>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Veja exatamente como seu cliente agenda no celular
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Uma interface pensada para quem está na correria do dia a dia: limpa, veloz e sem atritos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Coluna da Esquerda: Passos interativos */}
          <div className="lg:col-span-6 space-y-3">
            {DEMO_STEPS.map((s) => {
              const isActive = activeStep === s.step;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setActiveStep(s.step)}
                  className={`w-full text-left p-4 rounded-xl border transition-all min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isActive
                      ? "border-primary bg-surface shadow-sm ring-1 ring-primary/40"
                      : "border-border bg-surface/50 hover:bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.step}
                    </span>
                    <div>
                      <h3
                        className={`text-sm font-bold ${
                          isActive ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {s.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="pt-2">
              <Button asChild className="w-full sm:w-auto min-h-11 font-semibold">
                <Link href="/onboarding">Criar minha agenda agora</Link>
              </Button>
            </div>
          </div>

          {/* Coluna da Direita: Mockup do Celular 375px */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-[340px] rounded-3xl border-4 border-foreground/10 bg-surface p-4 shadow-xl">
              {/* Notch / Speaker simulado */}
              <div className="mx-auto h-4 w-28 rounded-full bg-muted mb-4" />

              {/* Cabeçalho do Mockup */}
              <div className="text-center pb-3 border-b border-border">
                <p className="text-xs font-bold text-foreground">Barbearia Modelo</p>
                <p className="text-[10px] text-muted-foreground">Agendamento online seguro</p>
              </div>

              {/* Conteúdo Dinâmico por Passo */}
              <div className="py-4 space-y-3 min-h-[300px]">
                {activeStep === 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Escolha o serviço:</p>
                    <div className="rounded-xl border border-primary bg-primary/5 p-3 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-foreground">
                        <span>Corte + Barba</span>
                        <span className="text-primary">Sinal R$ 20,00</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">⏱ 50 min • Total R$ 70,00</p>
                    </div>
                    <div className="rounded-xl border border-border p-3 text-xs space-y-1 opacity-70">
                      <div className="flex justify-between font-bold text-foreground">
                        <span>Corte Tradicional</span>
                        <span className="text-primary">Sinal R$ 15,00</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">⏱ 30 min • Total R$ 45,00</p>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-foreground">Régua de datas disponíveis:</p>
                    <div className="flex gap-1.5 overflow-hidden">
                      <div className="rounded-lg bg-primary text-primary-foreground p-2 text-center text-[10px] flex-1">
                        <p className="font-bold">Hoje</p>
                        <p className="opacity-90">02/10</p>
                        <span className="mt-1 inline-block bg-white/20 rounded px-1 text-[9px]">3 vagas</span>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 p-2 text-center text-[10px] flex-1">
                        <p className="font-bold text-foreground">Amanhã</p>
                        <p className="text-muted-foreground">03/10</p>
                        <span className="mt-1 inline-block bg-primary/10 text-primary font-semibold rounded px-1 text-[9px]">8 vagas</span>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 p-2 text-center text-[10px] flex-1">
                        <p className="font-bold text-foreground">SÁB</p>
                        <p className="text-muted-foreground">04/10</p>
                        <span className="mt-1 inline-block bg-primary/10 text-primary font-semibold rounded px-1 text-[9px]">5 vagas</span>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-foreground pt-1">Horários para Hoje:</p>
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                      <span className="rounded border border-border p-2 text-center text-foreground">14:00</span>
                      <span className="rounded border border-primary bg-primary text-primary-foreground p-2 text-center">15:30</span>
                      <span className="rounded border border-border p-2 text-center text-foreground">17:00</span>
                    </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-foreground">Seus dados de contato:</p>
                    <div className="rounded-lg border border-border bg-muted/20 p-2 text-xs">
                      <p className="text-[10px] text-muted-foreground">Nome completo</p>
                      <p className="font-medium text-foreground">Matheus Silva</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-2 text-xs">
                      <p className="text-[10px] text-muted-foreground">WhatsApp</p>
                      <p className="font-medium text-foreground">(11) 98765-4321</p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2 text-center">
                      <span className="text-[11px] font-bold text-primary">Sinal no Pix: R$ 20,00</span>
                    </div>
                  </div>
                )}

                {activeStep === 4 && (
                  <div className="text-center space-y-2">
                    <p className="text-xs font-bold text-foreground">Pague o sinal por Pix</p>
                    <p className="text-xl font-extrabold text-primary">R$ 20,00</p>
                    <div className="mx-auto h-24 w-24 rounded-lg border border-border bg-muted/40 flex items-center justify-center text-2xl">
                      📱
                    </div>
                    <p className="text-[10px] text-muted-foreground">⏳ Expira em 14:52 minutos</p>
                    <div className="rounded bg-primary text-primary-foreground py-1 text-[11px] font-semibold">
                      Copiar código Pix
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Rodapé Simulado */}
              <div className="pt-2 border-t border-border text-center">
                <span className="text-[10px] text-emerald-600 font-medium">🔒 Confirmação automática via Pix</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
