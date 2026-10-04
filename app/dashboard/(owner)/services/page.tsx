import Link from "next/link";
import { DashboardShell, Empty } from "@/components/dashboard/shell";
import { ServiceForm } from "@/components/dashboard/forms";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardServices } from "@/lib/dashboard/data";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  const { businesses, business, owner } = await ownerContext(businessId);
  const services = business ? await dashboardServices(owner.id, business.id) : [];
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  return <DashboardShell title="Serviços e preços" description="Defina o que seus clientes podem agendar e o sinal de cada atendimento." path="/dashboard/services" businesses={businesses} businessId={business?.id}>
    {business && <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
      <section id="new-service" className="h-fit rounded-card border border-line bg-surface p-4 sm:p-6">
        <h2 className="mb-5 text-lg font-semibold">Cadastrar serviço</h2>
        <ServiceForm businessId={business.id} />
      </section>
      <section className="min-w-0">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Seus serviços</h2>
          <p className="text-sm tabular-nums text-muted-foreground">{services.length}</p>
        </div>
        {!services.length ? <Empty title="Seu primeiro serviço começa aqui">
          <p>Cadastre um serviço para abrir a agenda aos clientes.</p>
          <Link href="#new-service" className="mt-2 inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-4">Cadastrar primeiro serviço</Link>
        </Empty> : <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4 sm:px-5">
          {services.map((service) => <li key={service.id} className="py-5 first:pt-4 last:pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-lg font-semibold">{service.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{service.durationMinutes} minutos · {service.active ? "Disponível" : "Indisponível"}</p>
              </div>
              <div className="text-right font-sans tabular-nums">
                <p className="font-semibold">{money.format(service.priceCents / 100)}</p>
                <p className="text-sm text-muted-foreground">Sinal {money.format(service.depositCents / 100)}</p>
              </div>
            </div>
            <details className="mt-2">
              <summary className="flex min-h-11 w-fit cursor-pointer items-center font-medium text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Editar serviço</summary>
              <div className="mt-3 rounded-card border border-line bg-paper p-3 sm:p-4">
                <ServiceForm key={service.id} businessId={business.id} service={service} />
              </div>
            </details>
          </li>)}
        </ul>}
      </section>
    </div>}
  </DashboardShell>;
}
