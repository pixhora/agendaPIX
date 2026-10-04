import Link from "next/link";
import { DashboardNavigation } from "./navigation";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

export function DashboardShell({ title, description, path, businesses, businessId, children }: {
  title: string; description: string; path: string; businesses: { id: string; name: string }[]; businessId?: string; children: ReactNode;
}) {
  return <main id="content" className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-8 sm:py-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 max-w-[70ch] text-muted-foreground">{description}</p></div>
      {businesses.length > 1 && <form action={path} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end"><label className="grid gap-2" htmlFor="business">Negócio<select id="business" name="businessId" defaultValue={businessId} className="min-h-11 w-full rounded-md border border-border bg-background px-3 sm:w-auto sm:max-w-72">{businesses.map((business) => <option value={business.id} key={business.id}>{business.name}</option>)}</select></label><button className={buttonVariants({ variant: "outline" })} type="submit">Abrir negócio</button></form>}
    </div>
    <DashboardNavigation current={{ "/dashboard": "Agenda", "/dashboard/services": "Serviços", "/dashboard/customers": "Clientes", "/dashboard/settings": "Funcionamento" }[path] ?? "Agenda"}>{[["/dashboard", "Agenda"], ["/dashboard/services", "Serviços"], ["/dashboard/customers", "Clientes"], ["/dashboard/settings", "Funcionamento"]].map(([href, label]) => <Link key={href} href={`${href}${businessId ? `?businessId=${businessId}` : ""}`} aria-current={path === href ? "page" : undefined} className={buttonVariants({ variant: path === href ? "default" : "outline", className: "min-h-11 w-full justify-center px-3 text-sm sm:w-auto sm:px-4" })}>{label}</Link>)}</DashboardNavigation>
    {businessId ? children : <section className="rounded-lg border border-border p-6"><h2 className="text-xl font-semibold">{businesses.length ? "Negócio indisponível" : "Seu negócio ainda não foi cadastrado"}</h2><p className="mt-2 text-muted-foreground">{businesses.length ? "Escolha um negócio da sua conta para continuar." : "Conclua o cadastro do negócio para começar a organizar seus horários."}</p>{businesses.length > 0 && <Link href={path} className={`${buttonVariants()} mt-4`}>Abrir meu negócio</Link>}</section>}
  </main>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-dashed border-border bg-background p-5 sm:p-6"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-2 max-w-[70ch] text-muted-foreground">{children}</div></section>;
}
