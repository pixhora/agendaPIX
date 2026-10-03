import React from "react";
import Link from "next/link";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingTrustBand } from "@/components/landing/LandingTrustBand";
import { LandingEditorialBenefits } from "@/components/landing/LandingEditorialBenefits";
import { LandingHighlightBanner } from "@/components/landing/LandingHighlightBanner";
import { LandingInteractiveDemo } from "@/components/landing/LandingInteractiveDemo";
import { LandingPainSolution } from "@/components/landing/LandingPainSolution";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function PreviewLandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground w-full max-w-full overflow-x-hidden">
      {/* Header com Navegação do Preview */}
      <header className="sticky top-0 z-40 w-full border-b border-[#E2E6DF] bg-[#F5F6F2]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3.5 sm:px-6 lg:px-8">
          <Link href="/preview" className="flex items-center gap-2 font-display text-lg sm:text-xl font-bold tracking-tight text-[#111613] shrink-0">
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-[#0F3B2E] text-xs sm:text-sm font-black text-[#C0F739]">
              A
            </span>
            <span>AgendaPix</span>
            <span className="rounded-full bg-[#C0F739] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#111613]">
              Preview
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#5A645C]" aria-label="Navegação da landing">
            <a href="#como-funciona" className="hover:text-[#111613] transition-colors">
              Como funciona
            </a>
            <a href="#recursos" className="hover:text-[#111613] transition-colors">
              Vantagens
            </a>
            <a href="#demonstracao" className="hover:text-[#111613] transition-colors">
              Demonstração
            </a>
            <a href="#precos" className="hover:text-[#111613] transition-colors">
              Preços
            </a>
            <a href="#perguntas-frequentes" className="hover:text-[#111613] transition-colors">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/preview/dashboard"
              className="hidden sm:inline-flex items-center justify-center rounded-full border border-[#E2E6DF] bg-white hover:bg-neutral-50 min-h-9 sm:min-h-10 text-xs font-bold text-[#111613] px-3.5 transition-colors"
            >
              Ver Painel
            </Link>
            <Link
              href="/preview/booking"
              className="inline-flex items-center justify-center rounded-full bg-[#C0F739] hover:bg-[#B0EE24] min-h-9 sm:min-h-10 text-xs font-extrabold text-[#111613] px-4 shadow-xs transition-transform active:scale-95"
            >
              Testar Booking
            </Link>
          </div>
        </div>
      </header>

      {/* Seções Reais da Landing */}
      <main className="flex-1">
        <LandingHero />
        <LandingTrustBand />
        <LandingEditorialBenefits />
        <LandingHighlightBanner />
        <LandingInteractiveDemo />
        <LandingPainSolution />
        <LandingPricing />
        <LandingFaq />
      </main>

      <LandingFooter />
    </div>
  );
}
