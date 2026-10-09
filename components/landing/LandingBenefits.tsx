import { CalendarCheckIcon, CircleCheckIcon, LayoutPanelIcon, SmartphoneIcon } from "./icons";
import { honestBenefits } from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";
import { belowFold } from "./section";

const icons = [CalendarCheckIcon, CircleCheckIcon, SmartphoneIcon, LayoutPanelIcon];
const items = honestBenefits.map((item, index) => ({ ...item, Icon: icons[index] ?? CircleCheckIcon }));

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
