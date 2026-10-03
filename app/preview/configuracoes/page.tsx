import React from "react";
import Link from "next/link";
import { MOCK_BUSINESS_INFO, MOCK_BOOKINGS, MOCK_SERVICES } from "@/lib/preview/mock-data";
import { Button } from "@/components/ui/button";

export default function PreviewConfiguracoesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header do Painel */}
      <header className="border-b border-border bg-surface py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              SB
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold text-foreground">
                  Configurações
                </h1>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {MOCK_BUSINESS_INFO.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Dados cadastrais e horários de funcionamento do Studio Bella
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-xs font-semibold overflow-x-auto pb-1 sm:pb-0" aria-label="Navegação do painel">
            <Link
              href="/preview/dashboard"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              Visão Geral
            </Link>
            <Link
              href="/preview/reservas"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              Reservas ({MOCK_BOOKINGS.length})
            </Link>
            <Link
              href="/preview/servicos"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              Serviços ({MOCK_SERVICES.length})
            </Link>
            <Link
              href="/preview/configuracoes"
              className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 shrink-0"
            >
              Configurações
            </Link>
          </nav>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Dados do Negócio */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">
            Perfil do Estabelecimento
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Nome do Negócio</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 font-bold text-foreground">
                {MOCK_BUSINESS_INFO.name}
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Link Público (Slug)</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 font-mono text-primary font-bold">
                agenda.com.br/{MOCK_BUSINESS_INFO.slug}
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Cidade / Estado</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-foreground">
                {MOCK_BUSINESS_INFO.city}
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Fuso Horário</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 font-mono text-foreground">
                {MOCK_BUSINESS_INFO.timezone} (Horário de Brasília)
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-muted-foreground mb-1 font-medium">Endereço Completo</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-foreground">
                {MOCK_BUSINESS_INFO.address}
              </div>
            </div>
          </div>
        </div>

        {/* Horários de Atendimento */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
          <h2 className="font-display text-base font-bold text-foreground">
            Horários de Atendimento
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Dias da Semana</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 font-semibold text-foreground">
                {MOCK_BUSINESS_INFO.openDaysText}
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Abertura</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 font-bold text-foreground">
                {MOCK_BUSINESS_INFO.opensAt}
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Fechamento</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 font-bold text-foreground">
                {MOCK_BUSINESS_INFO.closesAt}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button asChild variant="outline" className="min-h-11 font-semibold">
            <Link href="/preview">Voltar ao Hub de Preview</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
