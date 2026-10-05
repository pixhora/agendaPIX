import React from "react";
import Link from "next/link";
import { MOCK_BUSINESS_INFO, MOCK_BOOKINGS, MOCK_SERVICES } from "@/lib/preview/mock-data";

interface PreviewNavProps {
  currentPath: string;
}

export function PreviewNav({ currentPath }: PreviewNavProps) {
  const navItems = [
    { href: "/preview/dashboard", label: "Visão Geral" },
    { href: "/preview/reservas", label: `Reservas (${MOCK_BOOKINGS.length})` },
    { href: "/preview/servicos", label: `Serviços (${MOCK_SERVICES.length})` },
    { href: "/preview/configuracoes", label: "Configurações" },
  ];

  return (
    <nav
      className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 text-xs font-semibold"
      aria-label="Navegação do painel"
    >
      {navItems.map((item) => {
        const isActive = currentPath === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-11 items-center justify-center rounded-lg px-3 py-1.5 transition-colors sm:min-h-0 sm:shrink-0 ${
              isActive
                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                : "border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-subtle"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

interface PreviewHeaderProps {
  title?: string;
  subtitle?: string;
  currentPath: string;
}

export function PreviewHeader({
  title = MOCK_BUSINESS_INFO.name,
  subtitle = `São Paulo, SP · Horário de Brasília (${MOCK_BUSINESS_INFO.timezone})`,
  currentPath,
}: PreviewHeaderProps) {
  return (
    <header className="border-b border-border bg-surface py-4 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            SB
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold text-foreground">
                {title}
              </h1>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {title === MOCK_BUSINESS_INFO.name ? "Painel do Dono" : MOCK_BUSINESS_INFO.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <PreviewNav currentPath={currentPath} />
      </div>
    </header>
  );
}
