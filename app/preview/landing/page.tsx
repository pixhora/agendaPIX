import React from "react";
import Link from "next/link";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFacts } from "@/components/landing/LandingFacts";
import { LandingSteps } from "@/components/landing/LandingSteps";
import { LandingBenefits } from "@/components/landing/LandingBenefits";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function PreviewLandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground w-full max-w-full overflow-x-hidden">
      {/* Header com Navegação do Preview */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3.5 sm:px-6 lg:px-8">
          <Link href="/preview" className="flex items-center gap-2 font-display text-lg sm:text-xl font-bold tracking-tight text-foreground shrink-0">
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-ink text-xs sm:text-sm font-black text-primary">
              A
            </span>
            <span>AgendaPix</span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary-foreground">
              Preview
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-muted-foreground" aria-label="Navegação da landing">
            <a href="#como-funciona" className="hover:text-foreground transition-colors">
              Como funciona
            </a>
            <a href="#precos" className="hover:text-foreground transition-colors">
              Preços
            </a>
            <a href="#perguntas-frequentes" className="hover:text-foreground transition-colors">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/preview/dashboard"
              className="hidden sm:inline-flex items-center justify-center rounded-full border border-border bg-surface hover:bg-subtle min-h-9 sm:min-h-10 text-xs font-bold text-foreground px-3.5 transition-colors"
            >
              Ver Painel
            </Link>
            <Link
              href="/preview/booking"
              className="inline-flex items-center justify-center rounded-full bg-primary hover:bg-ink-hover h-11 min-h-[44px] text-xs font-extrabold text-primary-foreground px-4 shadow-xs transition-all active:scale-95 focus:outline-2 focus:outline-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              Testar Booking
            </Link>
          </div>
        </div>
      </header>

      {/* Seções Reais da Landing */}
      <main className="flex-1">
        <LandingHero />
        <LandingFacts />
        <LandingSteps />
        <LandingBenefits />
        <LandingPricing />
        <LandingFaq />
        <LandingFinalCta />
      </main>

      <LandingFooter />
    </div>
  );
}
