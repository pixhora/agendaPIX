import { OnboardingSupportProvider } from "@/components/onboarding/support-href";
import { supportWhatsappUrl } from "@/lib/support-contact";

/** Envolve o error boundary. O link de suporte é calculado aqui, no servidor. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingSupportProvider supportWhatsappHref={supportWhatsappUrl()}>{children}</OnboardingSupportProvider>;
}
