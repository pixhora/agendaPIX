"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { OnboardingData } from "./types";
import { StepBusiness } from "./StepBusiness";
import { StepService } from "./StepService";
import { StepHours } from "./StepHours";
import { StepAccount } from "./StepAccount";

const STEPS = [
  { step: 1, label: "Negócio" },
  { step: 2, label: "Serviço" },
  { step: 3, label: "Horários" },
  { step: 4, label: "Conta" },
] as const;

export function OnboardingFlow() {
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plano") === "base" ? "base" : "completo";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [data, setData] = useState<OnboardingData>(() => ({
    plan: initialPlan,
    businessName: "",
    slug: "",
    serviceName: "Corte de Cabelo",
    durationMinutes: 45,
    priceCents: 5000,
    depositCents: 2000,
    openDays: [1, 2, 3, 4, 5, 6],
    opensAt: "09:00",
    closesAt: "19:00",
    email: "",
  }));

  // Restaura rascunho persistido no localStorage de forma assíncrona após a montagem inicial,
  // garantindo paridade absoluta entre o HTML do servidor e a primeira árvore do cliente.
  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem("agenda_onboarding_draft");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            setData((prev) => ({ ...prev, ...parsed }));
          }
        }
      } catch {
        // Fallback gracioso se localStorage estiver inacessível ou JSON corrompido
      }
    });
  }, []);

  const updateDraft = (partial: Partial<OnboardingData>) => {
    setData((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem("agenda_onboarding_draft", JSON.stringify(updated));
      } catch {
        // Fallback silencioso
      }
      return updated;
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header Compacto do Onboarding */}
      <header className="border-b border-border bg-surface py-3.5 px-4 sm:px-6">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">
              A
            </span>
            <span>Agenda</span>
          </Link>
          <span className="text-xs font-medium text-muted-foreground">
            7 dias grátis · Plano {data.plan === "completo" ? "Completo" : "Base"}
          </span>
        </div>
      </header>

      {/* Conteúdo Principal Centralizado Mobile-First */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Barra de Progresso do Onboarding */}
        <nav aria-label="Progresso do cadastro" className="w-full">
          <ol className="flex items-center justify-between gap-1 w-full" role="list">
            {STEPS.map((s, idx) => {
              const isDone = step > s.step;
              const isCurrent = step === s.step;

              return (
                <li
                  key={s.step}
                  className="flex-1 flex flex-col items-center"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <div className="w-full flex items-center">
                    {idx > 0 && (
                      <div
                        className={`h-1 flex-1 transition-colors ${
                          isDone ? "bg-primary" : "bg-border"
                        }`}
                      />
                    )}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                        isCurrent
                          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : isDone
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface text-muted-foreground border border-border"
                      }`}
                    >
                      {isDone ? "✓" : s.step}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`h-1 flex-1 transition-colors ${
                          isDone && step > s.step + 1 ? "bg-primary" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                  <span
                    className={`mt-1 text-[11px] font-medium ${
                      isCurrent ? "text-primary font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Card do Passo Ativo */}
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
          {step === 1 && (
            <StepBusiness
              businessName={data.businessName}
              slug={data.slug}
              onChangeBusinessName={(businessName) => updateDraft({ businessName })}
              onChangeSlug={(slug) => updateDraft({ slug })}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <StepService
              serviceName={data.serviceName}
              durationMinutes={data.durationMinutes}
              priceCents={data.priceCents}
              depositCents={data.depositCents}
              onChangeServiceName={(serviceName) => updateDraft({ serviceName })}
              onChangeDuration={(durationMinutes) => updateDraft({ durationMinutes })}
              onChangePrice={(priceCents) => updateDraft({ priceCents })}
              onChangeDeposit={(depositCents) => updateDraft({ depositCents })}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <StepHours
              openDays={data.openDays}
              opensAt={data.opensAt}
              closesAt={data.closesAt}
              onChangeOpenDays={(openDays) => updateDraft({ openDays })}
              onChangeOpensAt={(opensAt) => updateDraft({ opensAt })}
              onChangeClosesAt={(closesAt) => updateDraft({ closesAt })}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}

          {step === 4 && (
            <StepAccount
              data={data}
              email={data.email}
              onChangeEmail={(email) => updateDraft({ email })}
              onBack={() => setStep(3)}
              onComplete={() => {
                try {
                  localStorage.removeItem("agenda_onboarding_draft");
                } catch {
                  // Fallback
                }
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
