import React from "react";
import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 font-display text-lg sm:text-xl font-extrabold tracking-tight text-foreground shrink-0 min-h-11 py-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-sm font-black text-paper shadow-xs">
            A
          </span>
          <span className="flex items-center gap-1">
            Agenda<span className="text-foreground">Pix</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-surface border border-line px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />
            Sinal
          </span>
        </Link>

        {/* Navegação Central */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-muted-foreground" aria-label="Navegação principal">
          <a href="#como-funciona" className="hover:text-foreground transition-colors min-h-11 flex items-center">
            Como funciona
          </a>
          <a href="#recursos" className="hover:text-foreground transition-colors min-h-11 flex items-center">
            Vantagens
          </a>
          <a href="#demonstracao" className="hover:text-foreground transition-colors min-h-11 flex items-center">
            Demonstração
          </a>
          <a href="#precos" className="hover:text-foreground transition-colors min-h-11 flex items-center">
            Preços
          </a>
          <a href="#perguntas-frequentes" className="hover:text-foreground transition-colors min-h-11 flex items-center">
            Dúvidas
          </a>
        </nav>

        {/* Ações Rápidas em Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <Link
            href="/login"
            className="flex items-center justify-center px-3 sm:px-4 text-xs font-bold text-muted-foreground hover:text-foreground sm:border sm:border-line sm:bg-surface sm:hover:bg-paper sm:rounded-full transition-colors duration-120 min-h-11"
          >
            Entrar
          </Link>
          <Link
            href="/onboarding"
            className="whitespace-nowrap shrink-0 rounded-full min-h-11 px-4 sm:px-5 py-2 text-xs font-extrabold bg-ink hover:opacity-90 text-paper shadow-xs transition-transform duration-120 active:scale-[0.98] motion-reduce:transform-none inline-flex items-center justify-center"
          >
            Começar<span className="hidden min-[360px]:inline">&nbsp;grátis</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
