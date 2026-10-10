import { CheckIcon } from "./icons";
import { buttonVariants } from "@/components/ui/button";
import { HeroMotion } from "./HeroMotion";

const niches = ["Barbearias", "Salões", "Manicures", "Estética", "Clínicas", "Personal trainers"];
const reassurances = ["7 dias grátis", "Sem cartão de crédito", "Cliente não baixa app"];

export function LandingHero() {
  return (
    <section id="hero" className="relative overflow-hidden">
      <div aria-hidden="true" className="bg-dots pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto grid w-full max-w-[1120px] items-center gap-12 px-5 pt-8 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,27.5rem)] lg:gap-10 lg:pt-16 lg:pb-28">
        <div className="min-w-0 max-w-[40rem]">
          <p className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-ink">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-pix" />
            Agenda online com sinal no Pix
          </p>
          <h1 className="mt-4 font-display text-[2.125rem] font-bold leading-[1.04] tracking-[-0.03em] text-ink lg:text-[3.75rem]">
            Seu cliente agenda sozinho e já chega com o sinal pago.
          </h1>
          <p className="mt-4 max-w-[40rem] text-base leading-[1.55] text-pretty text-muted lg:text-lg">
            Você manda um link no WhatsApp ou no Instagram. O cliente escolhe o horário, paga o sinal por Pix e o valor cai direto na sua conta Mercado Pago. A reserva se confirma sozinha.
          </p>
          <div className="mt-6">
            <a id="hero-primary-cta" href="/onboarding" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
              Criar minha agenda grátis
            </a>
          </div>
          <ul className="mt-4 flex flex-col gap-1.5 text-[13px] text-muted sm:flex-row sm:flex-wrap sm:gap-x-4">
            {reassurances.map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <CheckIcon aria-hidden="true" className="size-4 text-pix" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13px] text-muted">Feito para quem vive de atendimento:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {niches.map((niche) => (
              <li key={niche} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink">
                {niche}
              </li>
            ))}
          </ul>
        </div>
        <HeroMotion />
      </div>
    </section>
  );
}
