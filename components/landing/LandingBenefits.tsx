import { BellRing, CalendarX2, LayoutDashboard, Smartphone } from "lucide-react";
import { ValueSlab } from "@/components/ui/value-slab";

const ITEMS = [
  { Icon: CalendarX2, title: "Fim do horário furado", text: "Quem paga sinal aparece. E se faltar, o sinal já ficou com você." },
  { Icon: Smartphone, title: "Feito para o celular", text: "Seu cliente agenda em menos de um minuto, sem baixar aplicativo e sem criar conta." },
  { Icon: BellRing, title: "Confirmação automática", text: "O Pix cai, a reserva confirma. Ninguém precisa mandar print de comprovante." },
  { Icon: LayoutDashboard, title: "Seu dia num olhar", text: "Atendimentos, sinais recebidos e pendentes no mesmo painel, no celular ou no computador." },
];

export function LandingBenefits() {
  return (
    <section aria-labelledby="beneficios-title" className="bg-slab py-16 text-slab-foreground sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <h2 id="beneficios-title" className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">O sinal no Pix paga a sua agenda.</h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-slab-muted">Cada horário vazio é dinheiro que não volta. Com o sinal, o compromisso vem antes do atendimento.</p>
          <ValueSlab size="compact" className="mt-8 max-w-sm bg-white/[0.06] ring-white/10" label="Exemplo: sinais de hoje" value="R$ 55,00" badge="5 pagos" sublabel="Já na sua conta, antes do primeiro cliente chegar." />
        </div>
        <ul className="grid gap-px overflow-hidden rounded-frame bg-white/10 sm:grid-cols-2">
          {ITEMS.map(({ Icon, title, text }) => (
            <li key={title} className="bg-slab p-6">
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
