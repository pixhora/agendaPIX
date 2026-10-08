import { CalendarCheckIcon, CircleCheckIcon, LayoutPanelIcon, SmartphoneIcon } from "./icons";
import { cn } from "@/lib/utils";
import { belowFold } from "./section";

const items = [
  { Icon: CalendarCheckIcon, title: "Menos horário furado", text: "Quem paga para reservar assume o compromisso com o horário." },
  { Icon: SmartphoneIcon, title: "Feito para o celular", text: "Seu cliente agenda pelo navegador, sem baixar aplicativo e sem criar conta." },
  { Icon: CircleCheckIcon, title: "Confirmação automática", text: "O Pix cai direto na sua conta Mercado Pago e a reserva confirma. Você não confere comprovante." },
  { Icon: LayoutPanelIcon, title: "Seu dia num olhar", text: "Atendimentos, sinais pagos e pendentes no mesmo painel, no celular ou no computador." },
];

export function LandingBenefits() {
  return (
    <section aria-labelledby="beneficios-titulo" className={cn("bg-slab py-16 text-slab-foreground lg:py-28", belowFold)}>
      <div className="mx-auto w-full max-w-[1120px] px-5">
        <h2 id="beneficios-titulo" className="max-w-[20rem] font-display text-[1.75rem] font-bold leading-[1.08] tracking-[-0.025em] sm:max-w-[28rem] lg:text-[2.75rem]">
          O sinal no Pix protege a sua agenda.
        </h2>
        <p className="mt-4 max-w-[36rem] text-base leading-relaxed text-pretty text-slab-muted lg:text-lg">
          Cada horário vazio é dinheiro que não volta. Com o sinal, o compromisso vem antes do atendimento.
        </p>
        <ul className="mt-8 grid gap-px overflow-hidden rounded-frame bg-white/10 sm:grid-cols-2">
          {items.map(({ Icon, title, text }) => (
            <li key={title} className="bg-slab p-5 sm:p-6">
              <Icon aria-hidden="true" className="size-6 text-pix-bright" />
              <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slab-muted">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
