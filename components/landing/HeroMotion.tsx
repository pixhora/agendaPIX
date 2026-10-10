import { CheckIcon } from "./icons";

/**
 * Demonstração animada da jornada do cliente, no hero (desktop).
 * Uma única sequência curta (~4 s), CSS puro e sem loop: no fim fica parada no estado de confirmação.
 * Com prefers-reduced-motion, só o estado final aparece (ver `.hero-demo` em app/globals.css).
 * Dados fictícios, como em /exemplo.
 */
const services = [
  { name: "Corte feminino", time: "1h", price: "R$ 80,00", deposit: "R$ 25,00" },
];

export function HeroMotion() {
  return (
    <div aria-hidden="true" className="hero-demo hidden lg:block">
      <div className="relative mx-auto w-[300px] rounded-[2.25rem] border border-line bg-surface p-3 shadow-[var(--shadow-raised)]">
        <div className="relative h-[460px] overflow-hidden rounded-[1.75rem] bg-paper">
          <div className="flex items-center gap-2 px-5 pt-5">
            <span className="size-2 rounded-full bg-pix" />
            <p className="text-[12px] font-semibold text-ink">Studio Bella</p>
          </div>
          <div className="hero-progress mx-5 mt-3 flex gap-1.5">
            <span className="hero-progress-bar" />
            <span className="hero-progress-bar" />
            <span className="hero-progress-bar" />
            <span className="hero-progress-bar" />
          </div>

          <div className="step step-1 absolute inset-x-4 top-[88px]">
            <p className="text-[15px] font-bold text-ink">Escolha o serviço</p>
            {services.map((service) => (
              <div key={service.name} className="hero-card mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface p-4">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{service.name}</p>
                  <p className="text-[12px] text-muted">{service.time} · sinal {service.deposit} no Pix</p>
                </div>
                <p className="text-[14px] font-bold text-ink">{service.price}</p>
              </div>
            ))}
          </div>

          <div className="step step-2 absolute inset-x-4 top-[88px]">
            <p className="text-[15px] font-bold text-ink">Escolha o horário</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["09:30", "10:30", "11:30", "13:30", "15:30", "16:30"].map((slot) => (
                <span key={slot} className={`rounded-xl border px-2 py-2.5 text-center text-[13px] font-semibold ${slot === "11:30" ? "hero-slot border-ink bg-ink text-paper" : "border-line bg-surface text-ink"}`}>
                  {slot}
                </span>
              ))}
            </div>
          </div>

          <div className="step step-3 absolute inset-x-4 top-[88px]">
            <p className="text-[15px] font-bold text-ink">Pague o sinal por Pix</p>
            <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
              <div className="mx-auto grid size-[132px] grid-cols-6 grid-rows-6 gap-[3px] rounded-xl bg-surface p-2">
                {Array.from({ length: 36 }, (_, index) => (
                  <span key={index} className={(index * 7) % 5 < 2 ? "bg-ink" : "bg-transparent"} />
                ))}
              </div>
              <p className="mt-3 text-center text-[13px] text-muted">R$ 25,00 · vence em 30 min</p>
            </div>
          </div>

          <div className="step step-final absolute inset-x-4 top-[88px]">
            <div className="hero-confirm flex flex-col items-center rounded-2xl border border-pix/30 bg-pix-soft px-5 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-pix text-pix-foreground">
                <CheckIcon className="size-6" />
              </span>
              <p className="mt-4 text-[16px] font-bold text-ink">Horário confirmado</p>
              <p className="mt-1 text-[13px] text-muted">Corte feminino · sáb., 11:30</p>
              <p className="mt-3 text-[12px] font-semibold text-pix">Sinal recebido pelo Pix</p>
            </div>
            <p className="mt-4 text-center text-[12px] text-muted">Demonstração com dados fictícios</p>
          </div>
        </div>
      </div>
    </div>
  );
}
