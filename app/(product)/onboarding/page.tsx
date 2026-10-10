import React, { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { publicLinkPrefix } from "@/lib/site";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Começar teste grátis de 7 dias",
  description: "Crie sua conta em 3 minutos e comece a receber agendamentos com sinal por Pix.",
};

export default async function OnboardingPage() {
  await connection();
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Carregando cadastro" className="flex min-h-dvh items-center justify-center p-4">
          <Skeleton className="h-8 w-48" />
        </div>
      }
    >
      <OnboardingFlow legalPagesPublished={process.env.LEGAL_PAGES_PUBLISHED === "true"} publicHost={publicLinkPrefix()} />
    </Suspense>
  );
}
