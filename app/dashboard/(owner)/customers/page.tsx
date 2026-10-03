import Link from "next/link";
import { DashboardShell, Empty } from "@/components/dashboard/shell";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardCustomers } from "@/lib/dashboard/data";
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  const { businesses, business, owner } = await ownerContext(businessId);
  const customers = business ? await dashboardCustomers(owner.id, business.id) : [];
  return <DashboardShell title="Clientes" description="Os clientes aparecem aqui quando agendam um atendimento." path="/dashboard/customers" businesses={businesses} businessId={business?.id}>
    {business && (!customers.length ? <Empty title="Ainda não há clientes"><p>Confira seus serviços e horários para receber o primeiro agendamento.</p><Link href={`/dashboard/services?businessId=${business.id}`} className="inline-flex min-h-11 items-center text-primary underline">Conferir serviços</Link></Empty> : <><p className="text-muted-foreground">{customers.length} {customers.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}</p><ul className="divide-y divide-border border-y border-border">{customers.map((customer) => <li key={customer.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div className="min-w-0"><h2 className="break-words text-xl font-semibold">{customer.name}</h2><p className="mt-1 text-muted-foreground">{customer.phone}</p>{customer.email && <p className="break-all text-muted-foreground">{customer.email}</p>}</div><a className="inline-flex min-h-11 items-center rounded-md border border-border px-4 focus-visible:outline-2 focus-visible:outline-ring" href={`tel:${customer.phone}`}>Ligar para cliente<span className="sr-only"> {customer.name}</span></a></li>)}</ul></>)}
  </DashboardShell>;
}
