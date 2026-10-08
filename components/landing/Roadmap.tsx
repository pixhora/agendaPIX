import { Check } from "lucide-react";
import { availableNow, comingSoon } from "@/lib/marketing/roadmap";
import { Eyebrow, Section, SectionTitle } from "./section";

export function Roadmap() {
  return (
    <Section id="roadmap" labelledBy="roadmap-titulo">
      <Eyebrow>Sem letra miúda</Eyebrow>
      <SectionTitle id="roadmap-titulo">O que já funciona e o que vem aí.</SectionTitle>
      <p className="mt-4 max-w-[40rem] text-base leading-relaxed text-pretty text-muted lg:text-lg">
        O AgendaPix é novo. Preferimos mostrar exatamente o que você recebe hoje.
      </p>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-frame border border-line bg-surface p-5 sm:p-6">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-pix-soft px-2.5 py-1 text-[12px] font-semibold text-pix">
            <Check aria-hidden="true" className="size-3.5" /> Hoje
          </p>
          <h3 className="mt-4 font-display text-xl font-bold text-ink">Já funciona</h3>
          <ul className="mt-4 grid gap-3 text-sm leading-relaxed">
            {availableNow.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-frame border border-dashed border-line-strong p-5 sm:p-6">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1 text-[12px] font-semibold text-muted">
            <span aria-hidden="true" className="size-3.5 rounded-full border border-dashed border-line-strong" />
            Em breve
          </p>
          <h3 className="mt-4 font-display text-xl font-bold text-muted">Estamos construindo</h3>
          <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-muted">
            {comingSoon.map((item) => (
              <li key={item.label} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded-full border border-dashed border-line-strong" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </Section>
  );
}
