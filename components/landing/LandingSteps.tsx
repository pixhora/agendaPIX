import { CalendarCheck2, Link2, Store } from "lucide-react";

const STEPS = [
  { Icon: Store, title: "Crie sua página", text: "Nome do negócio, um serviço e seus horários. Em 3 minutos o link está no ar." },
  { Icon: Link2, title: "Compartilhe o link", text: "Coloque na bio do Instagram e mande no WhatsApp. O cliente vê só horários livres." },
  { Icon: CalendarCheck2, title: "Receba com sinal pago", text: "O cliente paga o sinal no Pix e a reserva aparece confirmada no seu painel." },
];

export function LandingSteps() {
  return (
    <section id="como-funciona" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-pix">Como funciona</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-5xl">Três passos e sua agenda trabalha sozinha.</h2>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ Icon, title, text }, index) => (
            <li key={title} className="relative rounded-frame border border-line bg-surface p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-2xl bg-ink text-paper"><Icon className="size-5" /></span>
                <span aria-hidden="true" className="font-display text-5xl font-extrabold tabular-nums text-line">{index + 1}</span>
              </div>
              <h3 className="mt-6 font-display text-xl font-bold"><span className="sr-only">Passo {index + 1}: </span>{title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
