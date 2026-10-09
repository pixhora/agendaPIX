import { Eyebrow, Section, SectionTitle } from "./section";

const steps = [
  {
    title: "Crie sua página",
    text: "Diga o que você faz, cadastre um serviço e seus horários. Leva pouco tempo.",
  },
  {
    title: "Mande seu link",
    text: "Na bio do Instagram, no status ou direto na conversa do WhatsApp.",
  },
  {
    title: "Receba com sinal pago",
    text: "O cliente paga o Pix, o sinal cai direto na sua conta Mercado Pago e a reserva aparece confirmada no seu painel.",
  },
] as const;

export function LandingSteps() {
  return (
    <Section id="como-funciona" labelledBy="como-funciona-titulo">
      <Eyebrow>Como funciona</Eyebrow>
      <SectionTitle id="como-funciona-titulo">Três passos e sua agenda trabalha sozinha.</SectionTitle>
      <ol className="mt-8 grid gap-4 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-frame border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-paper">
              {index + 1}
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-ink">
              <span className="sr-only">Passo {index + 1}: </span>
              {step.title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
