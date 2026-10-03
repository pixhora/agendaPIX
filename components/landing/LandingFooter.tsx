import React from "react";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-dark-card text-muted-foreground py-12 sm:py-16 text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-xs font-black text-primary-foreground">
              A
            </span>
            <div>
              <span className="font-display font-extrabold text-foreground text-base">AgendaPix</span>
              <p className="text-[11px] text-muted-foreground">Agendamento autônomo com sinal por Pix no Brasil</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
            <Link href="/login" className="hover:text-primary transition-colors">
              Entrar na conta
            </Link>
            <Link href="/onboarding" className="hover:text-primary transition-colors">
              Criar conta
            </Link>
            <a href="#como-funciona" className="hover:text-primary transition-colors">
              Como funciona
            </a>
            <a href="#recursos" className="hover:text-primary transition-colors">
              Vantagens
            </a>
            <a href="#precos" className="hover:text-primary transition-colors">
              Planos & Preços
            </a>
            <a href="#perguntas-frequentes" className="hover:text-primary transition-colors">
              Dúvidas
            </a>
          </div>
        </div>

        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <p>© {new Date().getFullYear()} AgendaPix. Todos os direitos reservados.</p>
          <p>Desenvolvido para barbearias, salões, clínicas, manicures e autônomos no Brasil.</p>
        </div>
      </div>
    </footer>
  );
}
