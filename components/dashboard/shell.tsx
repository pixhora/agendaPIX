import Link from "next/link";
import { DashboardNavigation } from "./navigation";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

export function DashboardShell({ title, description, path, businesses, businessId, children }: {
  title: string; description: string; path: string; businesses: { id: string; name: string }[]; businessId?: string; children: ReactNode;
}) {
  return <main id="content" className="mx-auto w-full max-w-6xl min-w-0 space-y-6 px-4 py-6 sm:space-y-8 sm:px-8 sm:py-8">
    <div className="flex flex-wrap items-end justify-between gap-5"><div className="min-w-0 flex-1 basis-64"><h1 className="break-words font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p></div>
      {businesses.length > 1 && <form action={path} className="grid w-full min-w-0 gap-2 sm:w-auto sm:max-w-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="grid min-w-0 gap-2 text-sm font-medium" htmlFor="business">Negócio<select key={businessId} id="business" name="businessId" defaultValue={businessId} className="min-h-11 min-w-0 w-full rounded-md border border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{businesses.map((business) => <option value={business.id} key={business.id}>{business.name}</option>)}</select></label><button className={buttonVariants({ variant: "outline" })} type="submit">Abrir negócio</button></form>}
    </div>
    <DashboardNavigation>{[["/dashboard", "Agenda"], ["/dashboard/services", "Serviços"], ["/dashboard/customers", "Clientes"], ["/dashboard/settings", "Funcionamento"]].map(([href, label]) => <Link key={href} href={`${href}${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`} aria-current={path === href ? "page" : undefined} className={buttonVariants({ variant: path === href ? "default" : "outline", className: "min-h-11 w-full justify-center px-3 text-sm sm:w-auto sm:px-4" })}>{label}</Link>)}</DashboardNavigation>
    {businessId ? children : <section className="rounded-lg border border-border p-6"><h2 className="text-xl font-semibold">{businesses.length ? "Negócio indisponível" : "Seu negócio ainda não foi cadastrado"}</h2><p className="mt-2 text-muted-foreground">{businesses.length ? "Escolha um negócio da sua conta para continuar." : "Conclua o cadastro do negócio para começar a organizar seus horários."}</p>{businesses.length > 0 && <Link href={path} className={`${buttonVariants()} mt-4`}>Abrir meu negócio</Link>}</section>}
  </main>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-dashed border-border bg-background p-5 sm:p-6"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted-foreground sm:text-base">{children}</div></section>;
}
