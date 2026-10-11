"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS, DASHBOARD_NAV_ICONS } from "@/lib/icons/registry";
import { BrandLink, BrandMark } from "@/components/ui/brand";
import { Dialog, DialogDescription, DialogSheetContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const frameLinkClass = "inline-flex min-h-11 items-center rounded-field px-3 text-sm font-semibold text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function LegalPageLinks({ className }: { className?: string }) {
  return (
    <>
      <Link href="/termos" className={cn(frameLinkClass, className)}>Termos de uso</Link>
      <Link href="/privacidade" className={cn(frameLinkClass, className)}>Política de privacidade</Link>
    </>
  );
}

function PanelLinkNav({
  legalPagesPublished,
  supportWhatsappHref,
  className,
  linkClassName,
}: {
  legalPagesPublished: boolean;
  supportWhatsappHref?: string | null;
  className?: string;
  linkClassName?: string;
}) {
  if (!legalPagesPublished && !supportWhatsappHref) return null;
  return (
    <nav aria-label="AgendaPix" className={className}>
      {legalPagesPublished ? <LegalPageLinks className={linkClassName} /> : null}
      {supportWhatsappHref ? <SupportWhatsappLink href={supportWhatsappHref} className={linkClassName} /> : null}
    </nav>
  );
}

function PanelLinksMenu({
  ownerName,
  businesses,
  defaultBusinessId,
  legalPagesPublished,
  supportWhatsappHref,
}: {
  ownerName: string;
  businesses: FrameBusiness[];
  defaultBusinessId?: string;
  legalPagesPublished: boolean;
  supportWhatsappHref?: string | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (media.matches) setOpen(false);
    };
    closeOnDesktop();
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-field text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <BrandMark />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-bold">
              <Suspense fallback="Seu painel"><CurrentBusinessName businesses={businesses} defaultBusinessId={defaultBusinessId} /></Suspense>
            </span>
            <span className="block truncate text-xs text-muted">{ownerName}</span>
          </span>
          <span className="sr-only">Abrir links do AgendaPix</span>
        </button>
      </DialogTrigger>
      <DialogSheetContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const content = event.currentTarget;
          if (!(content instanceof HTMLElement)) return;
          content.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
        }}
      >
        <DialogTitle className="sr-only">Links do AgendaPix</DialogTitle>
        <DialogDescription className="sr-only">Suporte, termos e sair da conta.</DialogDescription>
        <nav aria-label="AgendaPix" className="grid">
          {supportWhatsappHref ? <SupportWhatsappLink href={supportWhatsappHref} className="w-full justify-start" /> : null}
          {legalPagesPublished ? <LegalPageLinks className="w-full justify-start" /> : null}
          <Logout menu />
        </nav>
      </DialogSheetContent>
    </Dialog>
  );
}

function SupportWhatsappLink({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(frameLinkClass, "gap-2", className)}
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
  legalPagesPublished = false,
  supportWhatsappHref = null,
  children,
}: {
  ownerName: string;
  businesses: FrameBusiness[];
  defaultBusinessId?: string;
  /** Espelha `LEGAL_PAGES_PUBLISHED`. O layout do dono manda o valor do servidor. */
  legalPagesPublished?: boolean;
  /** Link wa.me do suporte. O layout do dono calcula no servidor. Null esconde o link. */
  supportWhatsappHref?: string | null;
  children: ReactNode;
}) {
  const fallback = <span className="h-11" />;
  const inlineLinks = "shrink-0 whitespace-nowrap";
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
          <div className="flex h-14 items-center gap-3 px-4">
            <div className="flex min-w-0 flex-1 md:hidden">
              <PanelLinksMenu
                ownerName={ownerName}
                businesses={businesses}
                defaultBusinessId={defaultBusinessId}
                legalPagesPublished={legalPagesPublished}
                supportWhatsappHref={supportWhatsappHref}
              />
            </div>
            <Link href="/dashboard" aria-label="AgendaPix, início do painel" className="hidden size-11 shrink-0 items-center justify-center rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:inline-flex"><BrandMark /></Link>
            <div className="hidden min-w-0 flex-1 leading-tight md:block">
              <p className="truncate text-sm font-bold"><Suspense fallback="Seu painel"><CurrentBusinessName businesses={businesses} defaultBusinessId={defaultBusinessId} /></Suspense></p>
              <p className="truncate text-xs text-muted">{ownerName}</p>
            </div>
            <Logout compact />
          </div>
          <PanelLinkNav
            legalPagesPublished={legalPagesPublished}
            supportWhatsappHref={supportWhatsappHref}
            className="hidden flex-nowrap items-center overflow-x-auto px-2 pb-2 md:flex"
            linkClassName={inlineLinks}
          />
        </header>

        <PanelLinkNav
          legalPagesPublished={legalPagesPublished}
          supportWhatsappHref={supportWhatsappHref}
          className="sticky top-0 z-20 hidden flex-nowrap items-center overflow-x-auto border-b border-line bg-surface px-8 lg:flex"
          linkClassName={inlineLinks}
        />

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
