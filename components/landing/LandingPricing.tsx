import { CheckIcon } from "./icons";
import { basePlan, upcomingPlan } from "@/lib/marketing/plans";
import { buttonVariants } from "@/components/ui/button";
import { Eyebrow, Section, SectionTitle } from "./section";

export function LandingPricing() {
  return (
    <Section id="precos" labelledBy="precos-titulo" paint="always">
      <div className="max-w-[40rem]">
        <Eyebrow>Preço</Eyebrow>
        <SectionTitle id="precos-titulo">Menos que um atendimento por mês.</SectionTitle>
        <p className="mt-4 text-base leading-relaxed text-pretty text-muted lg:text-lg">7 dias grátis, sem cartão. Nada é cobrado automaticamente. O sinal cai direto na sua conta Mercado Pago, a que você conecta no AgendaPix.</p>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <article aria-labelledby="plano-base" className="flex flex-col rounded-frame border-2 border-ink bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
          <p className="text-[13px] text-muted">{basePlan.audience}</p>
          <h3 id="plano-base" className="mt-1 font-display text-[1.375rem] font-bold text-ink">{basePlan.name}</h3>
          <div className="mt-5 rounded-slab bg-slab p-5 text-slab-foreground ring-1 ring-white/10">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-[2.75rem] font-bold leading-none tabular-nums">{basePlan.price}</span>
              <span className="text-sm font-semibold text-slab-muted">{basePlan.unit}</span>
            </p>
            <p className="mt-2 text-sm text-slab-muted">{basePlan.note}</p>
          </div>
          <ul className="mt-5 grid gap-3 text-sm">
            {basePlan.features.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <a href={basePlan.href} className={buttonVariants({ size: "lg", className: "mt-6 w-full" })}>
            {basePlan.cta}
          </a>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">{basePlan.guarantee}</p>
        </article>

        <article aria-labelledby="plano-completo" className="flex flex-col rounded-frame border border-dashed border-line-strong p-5 sm:p-6">
          <p className="w-fit rounded-full bg-subtle px-2.5 py-1 text-[12px] font-semibold text-muted">{upcomingPlan.badge}</p>
          <h3 id="plano-completo" className="mt-1 font-display text-[1.375rem] font-bold text-muted">{upcomingPlan.name}</h3>
          <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[2.75rem] font-bold leading-none text-ink tabular-nums">{upcomingPlan.price}</span>
            <span className="text-sm font-semibold text-muted">{upcomingPlan.unit}</span>
          </p>
          <ul className="mt-5 grid gap-3 text-sm text-muted">
            {upcomingPlan.features.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded-full border border-dashed border-line-strong" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </Section>
  );
}
