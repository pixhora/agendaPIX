import Link from "next/link";
import { Check } from "lucide-react";
import { ValueSlab } from "@/components/ui/value-slab";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "base",
    name: "Plano Base",
    audience: "Para quem atende sozinho",
    price: "R$ 49",
    features: ["1 profissional, 1 agenda", "Agendamentos ilimitados", "Sinal no Pix com confirmação automática", "Página de agendamento para celular", "Lembrete pelo WhatsApp do cliente"],
    featured: false,
  },
  {
    id: "completo",
    name: "Plano Completo",
    audience: "Para quem quer crescer",
    price: "R$ 79",
    features: ["Tudo do Plano Base", "Vários serviços com sinais diferentes", "Relatório de sinais recebidos", "Histórico e lista de clientes", "Suporte prioritário no WhatsApp"],
    featured: true,
  },
] as const;

export function LandingPricing() {
  return (
    <section id="precos" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-pix">Preços</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-5xl">Menos que um atendimento por mês.</h2>
          <p className="mt-4 text-lg text-muted">7 dias grátis em qualquer plano, sem cartão de crédito. Sem taxa por agendamento.</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {PLANS.map((plan) => (
            <article key={plan.id} aria-labelledby={`plano-${plan.id}`} className={cn("flex flex-col rounded-frame bg-surface p-6 sm:p-8", plan.featured ? "border-2 border-ink shadow-[var(--shadow-raised)]" : "border border-line")}>
              <p className="text-sm font-semibold text-muted">{plan.audience}</p>
              <h3 id={`plano-${plan.id}`} className="mt-1 font-display text-2xl font-extrabold">{plan.name}</h3>
              <ValueSlab size="compact" className="mt-5" label="Mensalidade" value={plan.price} unit="/ mês" badge={plan.featured ? "Mais escolhido" : undefined} sublabel="Cancele quando quiser" />
              <ul className="mt-6 grid gap-3 text-sm">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2.5"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />{feature}</li>)}
              </ul>
              <Link href={`/onboarding?plano=${plan.id}`} className={buttonVariants({ variant: plan.featured ? "default" : "outline", size: "lg", className: "mt-8 w-full" })}>
                Testar 7 dias grátis<span className="sr-only"> no {plan.name}</span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
