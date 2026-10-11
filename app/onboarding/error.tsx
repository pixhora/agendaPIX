"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useOnboardingSupportHref } from "@/components/onboarding/support-href";
import { onboardingBoundaryLog, restartOnboardingConnection } from "@/lib/onboarding/mp-return-error";

export default function OnboardingError({
  error,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const supportWhatsappHref = useOnboardingSupportHref();

  useEffect(() => {
    console.error(onboardingBoundaryLog(error));
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-5 py-10">
      <section className="w-full max-w-[480px] rounded-frame border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="font-display text-[28px] font-extrabold leading-[1.12] tracking-tight">Não conseguimos voltar do Mercado Pago</h1>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-ink">Sua conta não foi alterada. Toque em &quot;Tentar de novo&quot; pra reconectar.</p>
        <Button className="mt-6 w-full" variant="pixDeep" size="lg" type="button" onClick={() => restartOnboardingConnection()}>
          Tentar de novo
        </Button>
        {supportWhatsappHref ? (
          <a
            href={supportWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-ink underline underline-offset-4 outline-none focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
          >
            Suporte no WhatsApp
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : null}
      </section>
    </main>
  );
}
