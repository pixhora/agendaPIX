import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS } from "@/lib/icons/registry";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardShell({ title, description, path, businesses, businessId, actions, children }: {
  title: string;
  description: string;
  path: string;
  businesses: { id: string; name: string }[];
  businessId?: string;
  /** Ações principais da página (ex.: "Novo serviço"). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return <main id="content" tabIndex={-1} className="mx-auto w-full max-w-6xl min-w-0 space-y-6 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-10">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1 basis-72">
        <h1 className="break-words font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1.5 max-w-[65ch] text-sm leading-relaxed text-muted sm:text-base">{description}</p>
      </div>
      {(actions || businesses.length > 1) && <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
        {businesses.length > 1 && <form action={path} className="flex min-w-0 flex-1 items-end gap-2 sm:flex-none">
          <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-semibold text-muted" htmlFor="business">Negócio
            <select key={businessId} id="business" name="businessId" defaultValue={businessId} className="min-h-11 w-full min-w-0 rounded-field border border-line-strong/60 bg-surface px-3 text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring sm:min-w-48">
              {businesses.map((business) => <option value={business.id} key={business.id}>{business.name}</option>)}
            </select>
          </label>
          <button className={buttonVariants({ variant: "outline" })} type="submit">Abrir</button>
        </form>}
        {actions}
      </div>}
    </header>

    {businessId ? children : <section className="rounded-card border border-line bg-surface p-6 sm:p-8">
      <Icon icon={ACTION_ICONS.emptyBusiness} size="xl" className="mb-4 text-muted" />
      <h2 className="font-display text-xl font-bold">{businesses.length ? "Negócio indisponível" : "Seu negócio ainda não foi cadastrado"}</h2>
      <p className="mt-2 max-w-[60ch] text-muted">{businesses.length ? "Este negócio não está disponível para sua conta. Escolha um dos seus negócios para continuar." : "Conclua o cadastro do negócio para começar a organizar seus horários."}</p>
      {businesses.length > 0 ? <Link href={path} className={`${buttonVariants()} mt-5`}>Abrir meu negócio</Link> : <Link href="/onboarding" className={`${buttonVariants()} mt-5`}>Cadastrar meu negócio</Link>}
    </section>}
  </main>;
}

export function Empty({ title, children, icon, className }: { title: string; children: ReactNode; icon?: ReactNode; className?: string }) {
  return <section className={cn("rounded-card border border-dashed border-line-strong/60 bg-surface p-6 text-center sm:p-8", className)}>
    {icon && <div aria-hidden="true" className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-subtle text-muted [&_svg]:size-5">{icon}</div>}
    <h2 className="font-display text-lg font-bold">{title}</h2>
    <div className="mx-auto mt-1.5 max-w-[52ch] text-sm leading-relaxed text-muted">{children}</div>
  </section>;
}

export function SectionCard({ title, description, children, className, id, headingId, actions, icon }: { title: string; description?: ReactNode; children: ReactNode; className?: string; id?: string; headingId?: string; actions?: ReactNode; icon?: ReactNode }) {
  return <section id={id} aria-labelledby={headingId} className={cn("rounded-card border border-line bg-surface", className)}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span aria-hidden="true" className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-muted">{icon}</span>}
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-lg font-bold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
    <div className="p-5 sm:p-6">{children}</div>
  </section>;
}
