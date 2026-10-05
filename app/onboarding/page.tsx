import React, { Suspense } from "react";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = {
  title: "Começar teste grátis de 7 dias · Agenda",
  description: "Crie sua conta em 3 minutos e comece a receber agendamentos com sinal por Pix.",
};

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <OnboardingFlow />
    </Suspense>
  );
}
