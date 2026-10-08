import type { Metadata } from "next";
import { ConfirmOnboarding } from "@/components/onboarding/ConfirmOnboarding";

export const metadata: Metadata = {
  title: "Continuar o cadastro · Agenda",
  robots: { index: false },
};

export default async function ConfirmOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string | string[] }>;
}) {
  const params = await searchParams;
  const draftId = typeof params.d === "string" ? params.d : "";
  return <ConfirmOnboarding draftId={draftId} />;
}
