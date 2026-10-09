import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS, SUMMARY_ICONS } from "@/lib/icons/registry";
import { DashboardShell, Empty, SectionCard } from "@/components/dashboard/shell";
import { OwnerBillingNotice } from "@/components/dashboard/owner-billing-notice";
import { ServiceBlockNotice } from "@/components/dashboard/service-block-notice";
import { ServiceForm } from "@/components/dashboard/forms";
import { buttonVariants } from "@/components/ui/button";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardServices } from "@/lib/dashboard/data";
import { policyListLabel } from "@/lib/policy/text";
import { cn } from "@/lib/utils";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  const { businesses, business, owner } = await ownerContext(businessId);
  const services = business ? await dashboardServices(owner.id, business.id) : [];
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  return <DashboardShell
    title="Serviços e preços"
    description="Defina o que seus clientes podem agendar e o sinal via Pix de cada atendimento."
    path="/dashboard/services"
    businesses={businesses}
    businessId={business?.id}
    notice={business ? <OwnerBillingNotice ownerId={owner.id} businessId={business.id} timeZone={business.timezone} publicSlug={business.slug} /> : undefined}
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
          {services.map((service) => <li key={service.id} className="rounded-card border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-display text-lg font-bold tracking-tight">{service.name}</h3>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="inline-flex items-center gap-1"><Icon icon={SUMMARY_ICONS.duration} className="text-muted" />{service.durationMinutes} min</span>
                  <span className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 text-xs font-semibold", service.active ? "bg-success-soft text-success" : "bg-subtle text-muted")}>
                    <span aria-hidden="true" className={cn("size-1.5 rounded-full", service.active ? "bg-success" : "bg-line-strong")} />{service.active ? "Disponível" : "Indisponível"}
                  </span>
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-display text-xl font-extrabold">{money.format(service.priceCents / 100)}</p>
                <p className="text-sm font-semibold text-pix">{service.depositCents > 0 ? `Sinal Pix ${money.format(service.depositCents / 100)}` : "Sem sinal"}</p>
                <p className="text-sm text-muted">{policyListLabel(service.depositPolicy, service.depositCents)}</p>
                {service.blockedReason === "mp_account_not_connected" ? <p className="mt-1 max-w-prose text-sm text-ink">Conecte a conta Mercado Pago no AgendaPix para o cliente pagar o sinal deste serviço.</p> : null}
                {service.blockedReason === "mp_consent_outdated" ? <p className="mt-1 max-w-prose text-sm text-ink"><Link href={`/dashboard/settings?businessId=${business.id}#recebimento`} className="font-semibold underline underline-offset-4">Aceite o texto novo em Recebimento</Link> para voltar a receber sinal. Não precisa reconectar o Mercado Pago.</p> : null}
              </div>
            </div>
            <ServiceBlockNotice reason={service.blockedReason} />
            <details className="group mt-3 border-t border-line pt-1">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-field text-sm font-semibold text-ink hover:text-pix focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"><Pencil aria-hidden="true" className="size-4" />Editar serviço<span className="sr-only"> {service.name}</span></summary>
              <div className="mt-2 rounded-field bg-subtle/60 p-3 sm:p-4">
                <ServiceForm key={service.id} businessId={business.id} businessName={business.name} contactWhatsapp={business.contactWhatsapp} service={service} />
              </div>
            </details>
          </li>)}
        </ul>}
      </section>
      <SectionCard id="new-service" title="Cadastrar serviço" description="Aparece na sua página pública assim que estiver disponível." className="scroll-mt-24 lg:sticky lg:top-8">
        <ServiceForm businessId={business.id} businessName={business.name} contactWhatsapp={business.contactWhatsapp} />
      </SectionCard>
    </div>}
  </DashboardShell>;
}
