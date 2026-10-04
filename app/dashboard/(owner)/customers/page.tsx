import Link from "next/link";
import { DashboardShell, Empty } from "@/components/dashboard/shell";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardCustomers } from "@/lib/dashboard/data";
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  const { businesses, business, owner } = await ownerContext(businessId);
  const customers = business ? await dashboardCustomers(owner.id, business.id) : [];
  return <DashboardShell title="Clientes" description="Os clientes aparecem aqui quando agendam um atendimento." path="/dashboard/customers" businesses={businesses} businessId={business?.id}>
    {business && (!customers.length ? <Empty title="Ainda não há clientes"><p>Seus clientes entram na lista quando reservam um atendimento.</p><Link href={`/dashboard/services?businessId=${business.id}`} className="inline-flex min-h-11 items-center font-medium text-primary underline">Conferir serviços</Link></Empty> : <><div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="text-lg font-semibold">Seus clientes</h2><p className="text-sm text-muted-foreground">{customers.length}</p></div><ul className="divide-y divide-border rounded-xl border border-border bg-background px-4 sm:px-5">{customers.map((customer) => <li key={customer.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-4 last:pb-4"><div className="min-w-0"><h2 className="break-words font-semibold">{customer.name}</h2><p className="mt-1 text-sm text-muted-foreground">{customer.phone}</p>{customer.email && <p className="break-all text-sm text-muted-foreground">{customer.email}</p>}</div><a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" href={`tel:${customer.phone}`}>Ligar<span className="sr-only"> para {customer.name}</span></a></li>)}</ul></>)}
  </DashboardShell>;
}
