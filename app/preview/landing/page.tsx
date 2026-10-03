import React from "react";
import Link from "next/link";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPainSolution } from "@/components/landing/LandingPainSolution";
import { LandingInteractiveDemo } from "@/components/landing/LandingInteractiveDemo";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";

export default function PreviewLandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground w-full max-w-full overflow-x-hidden">
      {/* Header com Navegação do Preview */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3.5 sm:px-6">
          <Link href="/preview" className="flex items-center gap-1.5 sm:gap-2 font-display text-lg sm:text-xl font-bold tracking-tight text-foreground shrink-0">
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-primary text-xs sm:text-sm font-black text-primary-foreground">
              A
            </span>
            <span>Agenda</span>
            <span className="rounded-md bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Preview
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground" aria-label="Navegação da landing">
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

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="hidden sm:inline-flex min-h-9 sm:min-h-10 text-xs font-semibold px-3">
              <Link href="/preview/dashboard">Ver Painel</Link>
            </Button>
            <Button asChild className="min-h-9 sm:min-h-10 text-xs font-semibold px-3 sm:px-4 shadow-sm">
              <Link href="/preview/booking">Testar Booking</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Seções Reais da Landing */}
      <main className="flex-1">
        <LandingHero />
        <LandingPainSolution />
        <LandingInteractiveDemo />
        <LandingPricing />
        <LandingFaq />
      </main>

      <LandingFooter />
    </div>
  );
}
