"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS, DASHBOARD_NAV_ICONS } from "@/lib/icons/registry";
import { supportWhatsappUrl } from "@/lib/support-contact";
import { BrandLink, BrandMark } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";
import { Logout } from "./logout";
import { DashboardMpBanner } from "@/components/payments/mp-dashboard-banner";

type FrameBusiness = { id: string; name: string; slug: string; hasDepositService?: boolean };

const routes = [
  { href: "/dashboard", label: "Agenda", Icon: DASHBOARD_NAV_ICONS.agenda },
  { href: "/dashboard/services", label: "Serviços", Icon: DASHBOARD_NAV_ICONS.services },
  { href: "/dashboard/customers", label: "Clientes", Icon: DASHBOARD_NAV_ICONS.customers },
  { href: "/dashboard/settings", label: "Configurações", Icon: DASHBOARD_NAV_ICONS.settings },
] as const;

function useFrameState(businesses: FrameBusiness[], defaultBusinessId?: string) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("businessId");
  const business = requested ? businesses.find((item) => item.id === requested) : businesses.find((item) => item.id === defaultBusinessId) ?? businesses[0];
  const effective = requested ?? (business && business.id !== businesses[0]?.id ? business.id : null);
  const suffix = effective ? `?businessId=${encodeURIComponent(effective)}` : "";
  return { pathname, business, suffix };
}

function NavLinks({ businesses, defaultBusinessId, variant }: { businesses: FrameBusiness[]; defaultBusinessId?: string; variant: "sidebar" | "tabs" }) {
  const { pathname, suffix } = useFrameState(businesses, defaultBusinessId);
  return routes.map(({ href, label, Icon: NavIcon }) => {
    const current = pathname === href;
    return (
      <Link
        key={href}
        prefetch
        href={`${href}${suffix}`}
        aria-current={current ? "page" : undefined}
        className={cn(
          "transition-feedback focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          variant === "sidebar"
            ? cn("flex min-h-11 items-center gap-3 rounded-field px-3 text-sm font-semibold", current ? "bg-ink text-paper" : "text-muted hover:bg-subtle hover:text-ink")
            : cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-field px-1 text-[11px] font-semibold", current ? "text-ink" : "text-muted hover:text-ink"),
        )}
      >
        <span className={cn(variant === "tabs" && "flex h-7 w-12 items-center justify-center rounded-full", variant === "tabs" && current && "bg-ink text-paper")}>
          <Icon icon={NavIcon} size="lg" />
        </span>
        <span className={cn(variant === "tabs" && "max-w-full truncate")}>{label}</span>
      </Link>
    );
  });
}

function SupportWhatsappLink({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-field px-3 text-sm font-semibold text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Icon icon={ACTION_ICONS.whatsapp} size="md" />
      Suporte no WhatsApp
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

function PublicPageLink({ businesses, defaultBusinessId, className }: { businesses: FrameBusiness[]; defaultBusinessId?: string; className?: string }) {
  const { business } = useFrameState(businesses, defaultBusinessId);
  if (!business) return null;
  return (
    <Link href={`/${business.slug}`} target="_blank" className={cn("flex min-h-11 items-center gap-2 rounded-field px-3 text-sm font-semibold text-pix hover:bg-pix-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}>
      <Icon icon={DASHBOARD_NAV_ICONS.publicPage} />
      Ver página pública<span className="sr-only"> (abre em nova aba)</span>
    </Link>
  );
}

function CurrentBusinessName({ businesses, defaultBusinessId }: { businesses: FrameBusiness[]; defaultBusinessId?: string }) {
  const { business } = useFrameState(businesses, defaultBusinessId);
  return <>{business?.name ?? "Seu painel"}</>;
}

/**
 * Moldura do painel: sidebar fixa no desktop; no celular, barra superior + abas inferiores sempre visíveis
 * (sticky, não fixed: ficam no fluxo e nunca cobrem o fim do conteúdo — WCAG 2.4.11)
 * (padrão das referências Fresha/Booksy — ver docs/DESIGN_DECISION.md §9).
 */
export function AppFrame({
  ownerName,
  businesses,
  defaultBusinessId,
  supportWhatsappHref = supportWhatsappUrl(),
  children,
}: {
  ownerName: string;
  businesses: FrameBusiness[];
  defaultBusinessId?: string;
  /** Link wa.me do suporte. O layout do dono manda o valor do servidor, o mesmo da landing. */
  supportWhatsappHref?: string;
  children: ReactNode;
}) {
  const fallback = <span className="h-11" />;
  return (
    <div data-app-frame className="min-h-dvh bg-paper lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-ink focus:px-4 focus:py-3 focus:text-paper">Ir para o conteúdo</a>

      <aside className="hidden min-w-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 flex h-dvh min-w-0 flex-col gap-6 px-4 py-5">
        <BrandLink href="/dashboard" className="px-2" />
        <nav aria-label="Painel" className="grid gap-1">
          <Suspense fallback={fallback}><NavLinks businesses={businesses} defaultBusinessId={defaultBusinessId} variant="sidebar" /></Suspense>
        </nav>
        <Suspense fallback={null}><PublicPageLink businesses={businesses} defaultBusinessId={defaultBusinessId} /></Suspense>
        <div className="mt-auto grid min-w-0 grid-cols-1 gap-4 border-t border-line pt-4">
          <SupportWhatsappLink href={supportWhatsappHref} />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Tema</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 px-1">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-bold">{ownerName.trim().charAt(0).toUpperCase() || "?"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{ownerName}</p>
              <p className="truncate text-xs text-muted"><Suspense fallback="Seu painel"><CurrentBusinessName businesses={businesses} defaultBusinessId={defaultBusinessId} /></Suspense></p>
            </div>
            <Logout compact />
          </div>
        </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header data-sticky-chrome className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex min-h-16 items-center gap-3 px-4">
            <Link href="/dashboard" aria-label="AgendaPix, início do painel" className="inline-flex size-11 items-center justify-center rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><BrandMark /></Link>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-bold"><Suspense fallback="Seu painel"><CurrentBusinessName businesses={businesses} defaultBusinessId={defaultBusinessId} /></Suspense></p>
              <p className="truncate text-xs text-muted">{ownerName}</p>
            </div>
            <Logout compact />
          </div>
          <div className="px-2 pb-2">
            <SupportWhatsappLink href={supportWhatsappHref} />
          </div>
        </header>

        <div className="flex-1">
          <Suspense fallback={null}>
            <DashboardMpBanner businesses={businesses.map((item) => ({ id: item.id, hasDepositService: item.hasDepositService === true }))} />
          </Suspense>
          {children}
        </div>

        <nav aria-label="Painel" data-sticky-chrome className="sticky bottom-0 z-30 grid grid-cols-4 gap-1 border-t border-line bg-surface/95 px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden">
          <Suspense fallback={fallback}><NavLinks businesses={businesses} defaultBusinessId={defaultBusinessId} variant="tabs" /></Suspense>
        </nav>
      </div>
    </div>
  );
}
