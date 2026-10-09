import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS } from "@/lib/icons/registry";
import { DashboardShell, Empty } from "@/components/dashboard/shell";
import { OwnerBillingNotice } from "@/components/dashboard/owner-billing-notice";
import { buttonVariants } from "@/components/ui/button";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardCustomers } from "@/lib/dashboard/data";

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "?";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  const { businesses, business, owner } = await ownerContext(businessId);
  const customers = business ? await dashboardCustomers(owner.id, business.id) : [];
  const action = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-line-strong hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return <DashboardShell title="Clientes" description="Os clientes aparecem aqui quando agendam um atendimento pela sua página." path="/dashboard/customers" businesses={businesses} businessId={business?.id} notice={business ? <OwnerBillingNotice ownerId={owner.id} businessId={business.id} timeZone={business.timezone} publicSlug={business.slug} /> : undefined}>
    {business && (!customers.length ? <Empty title="Ainda não há clientes" icon={<Icon icon={ACTION_ICONS.emptyCustomers} size="md" />}>
      <p>Seus clientes entram na lista quando reservam um atendimento.</p>
      <Link href={`/dashboard/services?businessId=${business.id}`} className={buttonVariants({ variant: "outline", className: "mt-4" })}>Conferir serviços</Link>
    </Empty> : <section aria-labelledby="customers-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="customers-title" className="font-display text-lg font-bold">Seus clientes</h2>
        <p className="text-sm tabular-nums text-muted">{customers.length} {customers.length === 1 ? "cliente" : "clientes"}</p>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {customers.map((customer) => <li key={customer.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-bold">{initials(customer.name)}</span>
          <div className="min-w-0 flex-1">
            <h3 className="break-words font-semibold">{customer.name}</h3>
            <p className="text-sm tabular-nums text-muted">{customer.phone}{customer.email && <span className="break-all"> · {customer.email}</span>}</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <a className={`${action} flex-1 sm:flex-none`} href={`https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${customer.name}! Aqui é ${business.name}.`)}`} target="_blank" rel="noopener noreferrer"><Icon icon={ACTION_ICONS.whatsapp} size="md" />WhatsApp<span className="sr-only"> para {customer.name} (abre em nova aba)</span></a>
            <a className={`${action} flex-1 sm:flex-none`} href={`tel:${customer.phone}`}><Icon icon={ACTION_ICONS.phone} size="md" />Ligar<span className="sr-only"> para {customer.name}</span></a>
          </div>
        </li>)}
      </ul>
    </section>)}
  </DashboardShell>;
}
