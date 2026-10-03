import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
            A
          </span>
          <span>Agenda</span>
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Pix
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground" aria-label="Navegação principal">
          <a href="#como-funciona" className="hover:text-foreground transition-colors">
            Como funciona
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

        <div className="flex items-center gap-2.5">
          <Button asChild variant="outline" className="hidden sm:inline-flex min-h-10 text-xs font-semibold px-3.5">
            <Link href="/onboarding">Entrar</Link>
          </Button>
          <Button asChild className="min-h-10 text-xs font-semibold px-4 shadow-sm">
            <Link href="/onboarding">Começar grátis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
