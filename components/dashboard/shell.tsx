import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

export function DashboardShell({ title, description, path, businesses, businessId, children }: {
  title: string; description: string; path: string; businesses: { id: string; name: string }[]; businessId?: string; children: ReactNode;
}) {
  return <main id="content" className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-[28px] font-semibold tracking-tight">{title}</h1><p className="mt-2 max-w-[70ch] text-muted-foreground">{description}</p></div>
      {businesses.length > 1 && <form action={path} className="flex flex-wrap items-end gap-2"><label className="grid gap-2" htmlFor="business">Negócio<select id="business" name="businessId" defaultValue={businessId} className="min-h-11 max-w-full rounded-md border border-border bg-background px-3">{businesses.map((business) => <option value={business.id} key={business.id}>{business.name}</option>)}</select></label><button className={buttonVariants({ variant: "outline" })} type="submit">Abrir negócio</button></form>}
    </div>
    <nav aria-label="Painel" className="flex flex-wrap gap-2 border-b border-border pb-4">{[["/dashboard", "Agenda"], ["/dashboard/services", "Serviços"], ["/dashboard/customers", "Clientes"], ["/dashboard/settings", "Funcionamento"]].map(([href, label]) => <Link key={href} href={`${href}${businessId ? `?businessId=${businessId}` : ""}`} aria-current={path === href ? "page" : undefined} className={buttonVariants({ variant: path === href ? "default" : "outline" })}>{label}</Link>)}</nav>
    {businessId ? children : <section className="rounded-lg border border-border p-6"><h2 className="text-xl font-semibold">{businesses.length ? "Negócio indisponível" : "Seu negócio ainda não foi cadastrado"}</h2><p className="mt-2 text-muted-foreground">{businesses.length ? "Escolha um negócio da sua conta para continuar." : "Conclua o cadastro do negócio para começar a organizar seus horários."}</p>{businesses.length > 0 && <Link href={path} className={`${buttonVariants()} mt-4`}>Abrir meu negócio</Link>}</section>}
  </main>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-lg border border-dashed border-border p-6"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-2 max-w-[70ch] text-muted-foreground">{children}</div></section>;
}
