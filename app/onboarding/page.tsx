import React, { Suspense } from "react";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Começar teste grátis de 7 dias · agendaPIX",
  description: "Crie sua conta em 3 minutos e comece a receber agendamentos com sinal por Pix.",
};

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Carregando cadastro" className="flex min-h-dvh items-center justify-center p-4">
          <Skeleton className="h-8 w-48" />
        </div>
      }
    >
      <OnboardingFlow />
    </Suspense>
  );
}
