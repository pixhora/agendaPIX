import { buttonVariants } from "@/components/ui/button";
import { customerAgendaLead, customerAgendaSteps } from "@/lib/marketing/landing-copy";
import { Eyebrow, Section, SectionTitle } from "./section";

export function DemoSection() {
  const steps = customerAgendaSteps();
  return (
    <Section id="exemplo" labelledBy="exemplo-titulo" className="bg-subtle/60">
      <Eyebrow>Como o cliente agenda</Eyebrow>
      <SectionTitle id="exemplo-titulo">Veja como o cliente agenda</SectionTitle>
      <p className="mt-4 max-w-[46rem] text-base leading-relaxed text-pretty text-muted lg:text-lg">
        {customerAgendaLead}
      </p>
      <ol className="mt-6 grid gap-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-[15px] leading-relaxed text-ink">
            <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <a href="/exemplo" className={buttonVariants({ size: "lg", className: "mt-6 w-full sm:w-auto" })}>
        Testar a demonstração
      </a>
    </Section>
  );
}
