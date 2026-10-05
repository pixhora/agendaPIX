"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { OnboardingData } from "./types";
import { StepBusiness } from "./StepBusiness";
import { StepService } from "./StepService";
import { StepHours } from "./StepHours";
import { StepAccount } from "./StepAccount";
import { COMPLETED_SETUP_KEY } from "./storage";
import { OnboardingPreview } from "./OnboardingPreview";
import { StepProgress } from "@/components/booking/StepProgress";
import { BrandLink } from "@/components/ui/brand";

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
        const savedStep = localStorage.getItem("agenda_onboarding_step");
        if (savedStep) {
          const stepNum = Number(savedStep);
          if (stepNum >= 1 && stepNum <= 4) {
            setStep(stepNum as 1 | 2 | 3 | 4);
          }
        }
      } catch {
        // Fallback gracioso se localStorage estiver inacessível ou JSON corrompido
      }
    });
  }, []);

  const goToStep = (nextStep: 1 | 2 | 3 | 4) => {
    setStep(nextStep);
    try {
      localStorage.setItem("agenda_onboarding_step", String(nextStep));
    } catch {
      // Fallback
    }
  };

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
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <BrandLink />
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-pix-soft px-3 text-xs font-semibold text-pix">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-pix" />
            7 dias grátis · Plano {data.plan === "completo" ? "Completo" : "Base"}
          </span>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <main id="content" className="mx-auto w-full max-w-lg space-y-6 lg:mx-0">
        <StepProgress currentStep={step} steps={STEPS} label="Progresso do cadastro" />

        <div key={step} className="animate-step-in rounded-frame border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          {step === 1 && (
            <StepBusiness
              businessName={data.businessName}
              slug={data.slug}
              onChangeBusinessName={(businessName) => updateDraft({ businessName })}
              onChangeSlug={(slug) => updateDraft({ slug })}
              onNext={() => goToStep(2)}
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
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
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
              onBack={() => goToStep(2)}
              onNext={() => goToStep(4)}
            />
          )}

          {step === 4 && (
            <StepAccount
              data={data}
              email={data.email}
              onChangeEmail={(email) => updateDraft({ email })}
              onBack={() => goToStep(3)}
              onComplete={() => {
                try {
                  localStorage.setItem(COMPLETED_SETUP_KEY, JSON.stringify(data));
                  localStorage.removeItem("agenda_onboarding_draft");
                  localStorage.removeItem("agenda_onboarding_step");
                } catch {
                  // Fallback
                }
              }}
            />
          )}
        </div>
        <p className="text-center text-sm text-muted">
          Já tem conta? <Link href="/login" className="inline-flex min-h-11 items-center px-1 font-semibold text-ink underline-offset-4 hover:underline">Entrar</Link>
        </p>
      </main>
      <OnboardingPreview data={data} />
      </div>
    </div>
  );
}
