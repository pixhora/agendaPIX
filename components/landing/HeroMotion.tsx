import { Icon } from "@/components/ui/icon";
import { PIX_ICONS, SUMMARY_ICONS } from "@/lib/icons/registry";

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
        <span className="hero-mark flex size-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tracking-tight">
          SB
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-bold leading-tight tracking-tight text-ink">Studio Bella</span>
          <span className="mt-0.5 block text-[12px] text-muted">Página de agendamento</span>
        </span>
      </div>
      <div className="hero-rule mt-3.5" />

      <p className="mt-3.5 flex items-center gap-2 font-display text-xl font-bold tracking-tight text-ink">
        <Icon icon={SUMMARY_ICONS.service} size="md" className="text-pix" />
        Corte feminino
      </p>
      <p className="mt-1 flex items-center gap-2 text-[13px] text-muted">
        <Icon icon={SUMMARY_ICONS.duration} size="sm" className="text-pix" />
        1 h · sábado
      </p>

      <div className="mt-4 flex gap-1.5">
        {days.map((day) => (
          <span key={day.label} className={day.selected ? "hero-day hero-day-on" : "hero-day"}>
            {day.label}
          </span>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {times.map((time) =>
          time === "11:30" ? (
            <span key={time} className="hero-slot hero-slot-on">
              {time}
              <Icon icon={PIX_ICONS.copied} size="sm" className="text-pix" />
            </span>
          ) : (
            <span key={time} className="hero-slot">
              {time}
            </span>
          ),
        )}
      </div>

      <div className="hero-deposit mt-3">
        <span className="hero-deposit-label">Sinal no Pix</span>
        <span className="hero-deposit-value">R$ 40,00</span>
      </div>
    </>
  );
}

function PixCard() {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="hero-check">
          <Icon icon={PIX_ICONS.copied} size="sm" />
        </span>
        <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-ink">Sinal recebido pelo Pix</p>
      </div>
      <p className="mt-2.5 font-display text-3xl font-extrabold leading-none tracking-tight text-ink tabular-nums">R$ 40,00</p>
      <p className="mt-1.5 text-[12px] text-muted">Corte feminino · sáb, 11:30</p>
    </>
  );
}

function ConfirmChip() {
  return (
    <>
      <span className="hero-check">
        <Icon icon={PIX_ICONS.copied} size="sm" />
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
              <div className="hero-panel hero-chip inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5">
                <ConfirmChip />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-frame-sizer hidden lg:block">
        <div aria-hidden="true" className="hero-canvas">
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
                <div className="hero-panel hero-chip inline-flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5">
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
