import type { Metadata } from "next";
import { OnboardingComplete } from "@/components/onboarding/OnboardingComplete";

export const metadata: Metadata = {
  title: "Concluindo seu cadastro · Agenda",
  robots: { index: false },
};

export default function OnboardingCompletePage() {
  return <OnboardingComplete />;
}
