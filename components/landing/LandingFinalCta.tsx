import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingFinalCta() {
  return (
    <section aria-labelledby="cta-final-title" className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-frame bg-pix px-6 py-12 text-center text-pix-foreground sm:px-12 sm:py-16">
        <div aria-hidden="true" className="bg-dots absolute inset-0 opacity-20" />
        <div className="relative">
          <h2 id="cta-final-title" className="mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-5xl">Sua próxima reserva já pode chegar com sinal pago.</h2>
          <p className="mx-auto mt-4 max-w-md text-lg opacity-90">Crie sua página agora. 7 dias grátis, sem cartão.</p>
          <Link href="/onboarding" className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-semibold text-paper shadow-[var(--shadow-card)] transition-feedback hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pix-foreground sm:w-auto">
            Criar minha agenda grátis<ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
