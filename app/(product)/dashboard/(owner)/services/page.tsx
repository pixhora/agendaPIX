import Link from "next/link";
import { Plus } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS } from "@/lib/icons/registry";
import { DashboardShell, Empty, SectionCard } from "@/components/dashboard/shell";
import { OwnerBillingNotice } from "@/components/dashboard/owner-billing-notice";
import { ServiceForm } from "@/components/dashboard/forms";
import { ServiceListCard } from "@/components/dashboard/service-list-card";
import { buttonVariants } from "@/components/ui/button";
import { getBusinessBilling } from "@/lib/billing/status";
import { getDb } from "@/db";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardServices } from "@/lib/dashboard/data";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  const { businesses, business, owner } = await ownerContext(businessId);
  const [services, billing] = business
    ? await Promise.all([
      dashboardServices(owner.id, business.id, getDb(), business),
      getBusinessBilling(business.id, owner.id),
    ])
    : [[] as Awaited<ReturnType<typeof dashboardServices>>, null];
  return <DashboardShell
    title="Serviços e preços"
    description="Defina o que seus clientes podem agendar e o sinal via Pix de cada atendimento."
    path="/dashboard/services"
    businesses={businesses}
    businessId={business?.id}
    notice={business && billing ? <OwnerBillingNotice ownerId={owner.id} businessId={business.id} timeZone={business.timezone} publicSlug={business.slug} billing={billing} /> : undefined}
    actions={business && services.length > 0 ? <Link href="#new-service" className={buttonVariants({ className: "w-full sm:w-auto" })}><Plus aria-hidden="true" />Novo serviço</Link> : undefined}
  >
    {business && <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)] lg:items-start lg:gap-8">
      <section aria-labelledby="services-title" className="min-w-0">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="services-title" className="font-display text-lg font-bold">Seus serviços</h2>
          <p className="text-sm tabular-nums text-muted">{services.length} {services.length === 1 ? "serviço" : "serviços"}</p>
        </div>
        {!services.length ? <Empty title="Seu primeiro serviço começa aqui" icon={<Icon icon={ACTION_ICONS.emptyServices} size="md" />}>
          <p>Cadastre um serviço para abrir a agenda aos clientes.</p>
          <Link href="#new-service" className={buttonVariants({ variant: "outline", className: "mt-4" })}>Cadastrar primeiro serviço</Link>
        </Empty> : <ul className="grid gap-3">
          {services.map((service) => (
            <ServiceListCard
              key={service.id}
              service={service}
              businessId={business.id}
              businessName={business.name}
              contactWhatsapp={business.contactWhatsapp}
            />
          ))}
        </ul>}
      </section>
      <SectionCard id="new-service" title="Cadastrar serviço" description="Aparece na sua página pública assim que estiver disponível." className="scroll-mt-24 lg:sticky lg:top-8">
        <ServiceForm businessId={business.id} businessName={business.name} contactWhatsapp={business.contactWhatsapp} />
      </SectionCard>
    </div>}
  </DashboardShell>;
}
