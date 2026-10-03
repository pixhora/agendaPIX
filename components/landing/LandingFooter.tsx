import React from "react";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface py-12 text-center text-xs text-muted-foreground">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-black text-primary-foreground">
              A
            </span>
            <span className="font-display font-bold text-foreground">Agenda</span>
            <span className="text-[11px]">— Agendamento online com sinal por Pix</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link href="/onboarding" className="hover:text-foreground transition-colors">
              Criar conta
            </Link>
            <a href="#precos" className="hover:text-foreground transition-colors">
              Planos
            </a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">
              Como funciona
            </a>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <p>© {new Date().getFullYear()} Agenda. Todos os direitos reservados.</p>
          <p className="flex items-center gap-1">
            <span>Desenvolvido para autônomos, barbearias, salões e clínicas no Brasil.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
