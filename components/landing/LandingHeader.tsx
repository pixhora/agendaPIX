import React from "react";
import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo Neo-Editorial */}
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-forest text-sm font-black text-primary shadow-xs">
            A
          </span>
          <span className="flex items-center gap-1.5">
            Agenda<span className="text-accent-forest dark:text-primary">Pix</span>
          </span>
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary-foreground">
            Sinal
          </span>
        </Link>

        {/* Navegação Central */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-muted-foreground" aria-label="Navegação principal">
          <a href="#como-funciona" className="hover:text-foreground transition-colors">
            Como funciona
          </a>
          <a href="#recursos" className="hover:text-foreground transition-colors">
            Vantagens
          </a>
          <a href="#demonstracao" className="hover:text-foreground transition-colors">
            Demonstração
          </a>
          <a href="#precos" className="hover:text-foreground transition-colors">
            Preços
          </a>
          <a href="#perguntas-frequentes" className="hover:text-foreground transition-colors">
            Dúvidas
          </a>
        </nav>

        {/* Ações Rápidas em Pill */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface hover:bg-muted px-3 sm:px-4 py-2 text-xs font-bold text-foreground transition-colors min-h-9"
          >
            Entrar
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-full bg-primary hover:bg-primary-hover px-3.5 sm:px-5 py-2 text-xs font-extrabold text-primary-foreground shadow-xs transition-transform active:scale-95 min-h-9"
          >
            Começar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}
