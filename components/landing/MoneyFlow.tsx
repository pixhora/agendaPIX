import { holdCardCaption, minutesUnit, moneyLead } from "@/lib/marketing/landing-copy";
import type { PublicBookingFacts } from "@/lib/marketing/facts";
import { Eyebrow, Section, SectionTitle } from "./section";

export function MoneyFlow({ facts }: { facts: PublicBookingFacts }) {
  return (
    <Section id="dinheiro" labelledBy="dinheiro-titulo">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <div>
          <Eyebrow>Dinheiro, sem mistério</Eyebrow>
          <SectionTitle id="dinheiro-titulo">Como o sinal chega até você.</SectionTitle>
          <p className="mt-4 max-w-[46rem] text-base leading-relaxed text-pretty text-muted lg:text-lg">{moneyLead()}</p>
        </div>
        <div className="rounded-frame bg-pix-soft p-6">
          <p className="font-display text-[2.75rem] font-bold leading-none tracking-[-0.02em] text-pix tabular-nums">{facts.holdMinutes}</p>
          <p className="mt-1 text-sm font-semibold text-pix">{minutesUnit(facts.holdMinutes)}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink">{holdCardCaption()}</p>
        </div>
      </div>
    </Section>
  );
}
