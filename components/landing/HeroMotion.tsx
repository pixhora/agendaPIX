import { CheckIcon } from "./icons";

/**
 * Composição do hero. No desktop, cartões flutuantes num quadro que só escala.
 * Abaixo de lg, os mesmos cartões empilham no fluxo, sem rotação e sem sair da tela.
 * Dados fictícios. O miolo é decorativo; a legenda fica disponível para leitor de tela.
 * Movimento só em CSS. prefers-reduced-motion zera a animação.
 */
const days = [
  { label: "Qui 15", selected: false },
  { label: "Sex 16", selected: false },
  { label: "Sáb 17", selected: true },
  { label: "Dom 18", selected: false },
];
const times = ["09:00", "11:30", "14:00", "16:30"];

function StoreCard() {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="hero-mark flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-tile text-[13px] font-bold tracking-tight text-brand-tile-foreground">
          SB
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-bold leading-tight tracking-tight text-ink">Studio Bella</span>
          <span className="mt-0.5 block text-[12px] text-muted">Página de agendamento</span>
        </span>
      </div>

      <p className="mt-4 font-display text-xl font-bold tracking-tight text-ink">Corte feminino</p>
      <p className="mt-0.5 text-[13px] text-muted">1 h · sábado</p>

      <div className="mt-4 flex gap-1.5">
        {days.map((day) => (
          <span
            key={day.label}
            className={
              day.selected
                ? "inline-flex min-h-9 flex-1 items-center justify-center rounded-full bg-ink px-1 text-[12px] font-semibold text-paper"
                : "inline-flex min-h-9 flex-1 items-center justify-center rounded-full bg-subtle px-1 text-[12px] font-semibold text-ink"
            }
          >
            {day.label}
          </span>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {times.map((time) =>
          time === "11:30" ? (
            <span key={time} className="inline-flex min-h-11 items-center justify-between rounded-full bg-ink px-3 text-[13px] font-semibold text-paper tabular-nums">
              {time}
              <CheckIcon className="size-3.5" />
            </span>
          ) : (
            <span key={time} className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-3 text-[13px] font-semibold text-ink tabular-nums">
              {time}
            </span>
          ),
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-field bg-pix-soft px-3 py-2">
        <span className="text-[12px] font-semibold text-pix">Sinal no Pix</span>
        <span className="font-display text-sm font-bold text-ink tabular-nums">R$ 40,00</span>
      </div>
    </>
  );
}

function PixCard() {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pix text-pix-foreground">
          <CheckIcon className="size-4" />
        </span>
        <p className="text-[13px] font-semibold leading-tight text-ink">Sinal recebido pelo Pix</p>
      </div>
      <p className="mt-2.5 font-display text-3xl font-extrabold leading-none tracking-tight text-ink tabular-nums">R$ 40,00</p>
      <p className="mt-1.5 text-[12px] text-muted">Corte feminino · sáb, 11:30</p>
    </>
  );
}

function ConfirmChip() {
  return (
    <>
      <span className="flex size-7 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckIcon className="size-3.5" />
      </span>
      <span className="text-[13px] font-semibold text-ink">Horário confirmado</span>
    </>
  );
}

export function HeroMotion() {
  return (
    <figure className="hero-stage hero-frame relative mx-auto w-full min-w-0 max-w-[27.5rem] lg:mx-0 lg:max-w-none lg:justify-self-end">
      <div className="relative mx-auto w-full max-w-[24rem] lg:hidden">
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="hero-rise hero-delay-1">
            <div className="hero-float">
              <div className="hero-panel rounded-card px-3.5 py-3">
                <PixCard />
              </div>
            </div>
          </div>
          <div className="hero-rise">
            <div className="hero-panel rounded-frame p-4">
              <StoreCard />
            </div>
          </div>
          <div className="hero-rise hero-delay-2">
            <div className="hero-float hero-float-late w-fit max-w-full">
              <div className="hero-panel inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5">
                <ConfirmChip />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-frame-sizer hidden lg:block">
        <div aria-hidden="true" className="hero-canvas">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-80 [mask-image:radial-gradient(ellipse_at_center,black_22%,transparent_74%)]" />

          <div className="hero-panel hero-card-main rounded-frame p-4">
            <div className="hero-rise">
              <StoreCard />
            </div>
          </div>

          <div className="hero-card-pix">
            <div className="hero-rise hero-delay-1">
              <div className="hero-float">
                <div className="hero-panel rounded-card px-3.5 py-3">
                  <PixCard />
                </div>
              </div>
            </div>
          </div>

          <div className="hero-card-chip">
            <div className="hero-rise hero-delay-2">
              <div className="hero-float hero-float-late">
                <div className="hero-panel inline-flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5">
                  <ConfirmChip />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[12px] leading-snug text-muted">Demonstração com dados fictícios</figcaption>
    </figure>
  );
}
