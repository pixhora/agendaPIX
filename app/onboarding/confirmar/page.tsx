import type { Metadata } from "next";
import { ConfirmOnboarding } from "@/components/onboarding/ConfirmOnboarding";

export const metadata: Metadata = {
  title: "Continuar o cadastro · Agenda",
  robots: { index: false },
};

export default async function ConfirmOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string | string[]; erro?: string }>;
}) {
  const params = await searchParams;
  // Só em desenvolvimento: o e2e abre esta query para ver o error boundary genérico.
  if (process.env.NODE_ENV !== "production" && params.erro === "cadastro") {
    throw new Error("onboarding_generic_probe");
  }
  const draftId = typeof params.d === "string" ? params.d : "";
  return <ConfirmOnboarding draftId={draftId} />;
}
