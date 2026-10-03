import React from "react";
import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E2E6DF] bg-[#F5F6F2]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo Neo-Editorial */}
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight text-[#111613]">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0F3B2E] text-sm font-black text-[#C0F739] shadow-xs">
            A
          </span>
          <span className="flex items-center gap-1.5">
            Agenda<span className="text-[#0F3B2E]">Pix</span>
          </span>
          <span className="rounded-full bg-[#C0F739] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#111613]">
            Sinal
          </span>
        </Link>

        {/* Navegação Central */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#5A645C]" aria-label="Navegação principal">
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

        {/* Ações Rápidas em Pill */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/onboarding"
            className="hidden sm:inline-flex items-center justify-center rounded-full border border-[#E2E6DF] bg-white hover:bg-neutral-50 px-4 py-2 text-xs font-bold text-[#111613] transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-full bg-[#C0F739] hover:bg-[#B0EE24] px-4 sm:px-5 py-2 text-xs font-extrabold text-[#111613] shadow-xs transition-transform active:scale-95"
          >
            Começar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}
