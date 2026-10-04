import React from "react";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-[#0E1612] text-white py-12 sm:py-16 text-xs text-white/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C0F739] text-xs font-black text-[#111613]">
              A
            </span>
            <div>
              <span className="font-display font-extrabold text-white text-base">AgendaPix</span>
              <p className="text-[11px] text-white/60">Agendamento autônomo com sinal por Pix no Brasil</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium">
            <Link href="/onboarding" className="inline-flex min-h-11 items-center hover:text-[#C0F739] transition-colors">
              Criar conta
            </Link>
            <a href="#como-funciona" className="inline-flex min-h-11 items-center hover:text-[#C0F739] transition-colors">
              Como funciona
            </a>
            <a href="#recursos" className="inline-flex min-h-11 items-center hover:text-[#C0F739] transition-colors">
              Vantagens
            </a>
            <a href="#precos" className="inline-flex min-h-11 items-center hover:text-[#C0F739] transition-colors">
              Planos & Preços
            </a>
            <a href="#perguntas-frequentes" className="inline-flex min-h-11 items-center hover:text-[#C0F739] transition-colors">
              Dúvidas
            </a>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/50">
          <p>© {new Date().getFullYear()} AgendaPix. Todos os direitos reservados.</p>
          <p>Desenvolvido para barbearias, salões, clínicas, manicures e autônomos no Brasil.</p>
        </div>
      </div>
    </footer>
  );
}
