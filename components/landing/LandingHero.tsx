import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ValueSlab } from "@/components/ui/value-slab";

const niches = ["Barbearias", "Salões", "Manicures", "Estética", "Clínicas", "Personal trainers"];
const reassurances = ["7 dias grátis", "Sem cartão de crédito", "Cliente não baixa app"];
const days = ["Qui", "Sex", "Sáb"];
const times = ["14:00", "14:45", "15:30", "16:15"];

export function LandingHero({ publicHost }: { publicHost: string }) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="bg-dots pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto grid w-full max-w-[1120px] items-center gap-10 px-5 pt-8 pb-16 lg:grid-cols-2 lg:gap-8 lg:pt-16 lg:pb-28">
        <div>
          <p className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-ink">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-pix" />
            Agenda online com sinal no Pix
          </p>
          <h1 className="mt-4 font-display text-[2.125rem] font-bold leading-[1.04] tracking-[-0.03em] text-ink lg:text-[3.75rem]">
            Seu cliente agenda sozinho e já chega com o sinal pago.
          </h1>
          <p className="mt-4 max-w-[40rem] text-base leading-[1.55] text-pretty text-muted lg:text-lg">
            Você manda um link no WhatsApp ou no Instagram. O cliente escolhe o horário, paga o sinal por Pix e a reserva se confirma sozinha. Sem cobrar comprovante.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link id="hero-primary-cta" href="/onboarding" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
              Criar minha agenda grátis
            </Link>
            <Link href="/preview/booking" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
              Ver uma página de exemplo
            </Link>
          </div>
          <ul className="mt-4 flex flex-col gap-1.5 text-[13px] text-muted sm:flex-row sm:flex-wrap sm:gap-x-4">
            {reassurances.map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-4 text-pix" />
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

        <div className="relative mx-auto w-full max-w-[320px] lg:max-w-none">
          <div className="relative mx-auto h-[440px] w-[270px] overflow-hidden lg:h-auto lg:w-[280px] lg:overflow-visible">
            <PhoneStage publicHost={publicHost} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper to-transparent lg:hidden" />
          </div>
          <div aria-hidden="true" className="absolute top-16 -left-2 hidden w-[210px] rounded-card border border-line bg-surface p-3 shadow-[var(--shadow-raised)] xl:block">
            <p className="text-[13px] font-semibold text-ink">Nova reserva · Ana</p>
            <p className="mt-1 text-[13px] text-muted">Design de sobrancelha · Qui 15:30</p>
            <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-success">
              <Check className="size-3.5" /> Confirmado · sinal pago
            </p>
          </div>
          <ValueSlab
            aria-hidden="true"
            size="compact"
            className="absolute right-0 bottom-6 hidden w-[220px] shadow-[var(--shadow-raised)] xl:block"
            label="Sinais de hoje"
            value="R$ 80,00"
            badge="4 reservas confirmadas"
          />
        </div>
      </div>
    </section>
  );
}

function PhoneStage({ publicHost }: { publicHost: string }) {
  return (
    <div aria-hidden="true" className="rounded-[36px] border-8 border-ink bg-surface shadow-[var(--shadow-raised)]">
      <div className="px-4 pt-4 pb-5">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-line" />
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">SB</span>
          <span>
            <span className="block text-sm font-bold text-ink">Studio Bella</span>
            <span className="block max-w-[180px] truncate text-[11px] text-muted">{publicHost}/studio-bella</span>
          </span>
        </div>
        <div className="mt-4 rounded-card border border-line p-3">
          <p className="text-sm font-semibold text-ink">Design de sobrancelha</p>
          <p className="mt-1 text-[12px] text-muted">45 min · R$ 60,00</p>
          <p className="mt-1 text-[12px] font-semibold text-pix">Sinal R$ 20,00</p>
        </div>
        <div className="mt-3 flex gap-1.5">
          {days.map((day, index) => (
            <span key={day} className={index === 0 ? "rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-paper" : "rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold text-muted"}>
              {day}
            </span>
          ))}
        </div>
        <div className="mt-3 grid gap-1.5">
          {times.map((time) =>
            time === "15:30" ? (
              <span key={time} className="flex items-center justify-between rounded-full bg-pix-bright px-3 py-1.5 text-[12px] font-semibold text-pix-bright-foreground">
                <span>{time}</span>
                <span>Reservado · sinal pago</span>
              </span>
            ) : (
              <span key={time} className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-ink">
                {time}
              </span>
            ),
          )}
        </div>
        <span className="mt-4 flex min-h-11 items-center justify-center rounded-full bg-ink px-3 text-[13px] font-semibold text-paper">
          Pagar sinal de R$ 20,00 no Pix
        </span>
      </div>
    </div>
  );
}
