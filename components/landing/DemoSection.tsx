import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { minutesUnit, type PublicBookingFacts } from "@/lib/marketing/facts";
import { demoSteps } from "@/lib/marketing/landing-copy";
import { Eyebrow, Section, SectionTitle } from "./section";

export function DemoSection({ facts }: { facts: PublicBookingFacts }) {
  const steps = demoSteps(facts.requiresPayerCpf);
  return (
    <Section id="exemplo" labelledBy="exemplo-titulo" className="bg-subtle/60">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <Eyebrow>Página de exemplo</Eyebrow>
          <SectionTitle id="exemplo-titulo">Veja como seu cliente agenda.</SectionTitle>
          <p className="mt-4 max-w-[46rem] text-base leading-relaxed text-pretty text-muted lg:text-lg">
            Esta é a página que seu cliente abre pelo link. Toque e faça uma reserva de teste, do serviço até o Pix.
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
          <Link href="/preview/booking" className={buttonVariants({ size: "lg", className: "mt-6 w-full sm:w-auto" })}>
            Abrir a página de exemplo
          </Link>
          <p className="mt-3 text-[13px] text-muted">Exemplo com dados fictícios. Nenhum Pix de verdade é gerado.</p>
        </div>
        <ExamplePhone holdMinutes={facts.holdMinutes} />
      </div>
    </Section>
  );
}

function ExamplePhone({ holdMinutes }: { holdMinutes: number }) {
  return (
    <div className="mx-auto w-full max-w-[280px]">
      <p className="mx-auto mb-3 w-fit rounded-full bg-pix-deep px-3 py-1 text-center text-[12px] font-semibold text-slab-foreground">
        Exemplo · nenhum Pix real
      </p>
      <div aria-hidden="true" className="rounded-[36px] border-8 border-ink bg-surface p-4 shadow-[var(--shadow-raised)]">
        <p className="text-sm font-bold text-ink">Sinal de R$ 20,00</p>
        <p className="mt-1 text-[13px] text-muted">
          <span className="font-display text-2xl font-bold text-pix tabular-nums">{holdMinutes}</span>{" "}
          {minutesUnit(holdMinutes)} para pagar
        </p>
        <div className="mt-4 rounded-card border border-dashed border-line-strong/70 bg-paper px-3 py-6 text-center text-[13px] text-muted">
          Código de exemplo
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">No banco, o Pix cai na conta Mercado Pago do Studio Bella.</p>
        <span className="mt-4 flex min-h-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">Copiar código Pix</span>
      </div>
    </div>
  );
}
