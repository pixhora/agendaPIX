import { CheckIcon } from "./icons";
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
    text: "O cliente paga o Pix e a reserva aparece confirmada no seu painel. Sem print.",
  },
] as const;

export function LandingSteps({ publicHost }: { publicHost: string }) {
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
            <div aria-hidden="true" className="mt-5">
              {index === 0 ? <ServicePreview /> : null}
              {index === 1 ? <LinkPreview host={publicHost} /> : null}
              {index === 2 ? <PaidPreview /> : null}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function ServicePreview() {
  return (
    <div className="rounded-card border border-line bg-paper px-3 py-3 text-sm">
      <p className="font-semibold text-ink">Design de sobrancelha</p>
      <p className="mt-1 text-muted">R$ 60,00</p>
      <p className="mt-1 font-semibold text-pix">Sinal no Pix R$ 20,00</p>
    </div>
  );
}

function LinkPreview({ host }: { host: string }) {
  return (
    <div>
      <div className="flex min-w-0 items-center gap-2 rounded-field border border-line-strong/60 bg-paper px-3 py-3">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{host}/studio-bella</span>
        <span className="shrink-0 text-sm font-semibold text-pix">Copiar</span>
      </div>
      <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-pix">
        <CheckIcon className="size-3.5" /> Link curto, fácil de lembrar
      </p>
    </div>
  );
}

function PaidPreview() {
  return (
    <ul className="grid gap-2 text-sm">
      {[
        ["Qui 15, 15:30", "Ana"],
        ["Qui 15, 16:15", "Bruna"],
      ].map(([when, name]) => (
        <li key={name} className="flex items-center justify-between gap-2 rounded-card border border-line px-3 py-2">
          <span className="text-ink">{when} · {name}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[12px] font-semibold text-success">
            <CheckIcon className="size-3" /> Sinal pago
          </span>
        </li>
      ))}
    </ul>
  );
}
