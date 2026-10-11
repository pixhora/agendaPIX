"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { onboardingBoundaryLog } from "@/lib/onboarding/mp-return-error";

export default function OnboardingError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(onboardingBoundaryLog(error));
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-5 py-10">
      <section className="w-full max-w-[480px] rounded-frame border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="font-display text-[28px] font-extrabold leading-[1.12] tracking-tight">Algo deu errado no cadastro</h1>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-ink">Seu cadastro está salvo. Toque em &quot;Tentar de novo&quot; para continuar.</p>
        <Button className="mt-6 w-full" variant="pixDeep" size="lg" type="button" onClick={() => retry()}>
          Tentar de novo
        </Button>
        <a
          href="https://wa.me/5514997504655"
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-ink underline underline-offset-4 outline-none focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
        >
          Suporte no WhatsApp
        </a>
      </section>
    </main>
  );
}
