import React from "react";
import Link from "next/link";
import { MOCK_BUSINESS_INFO } from "@/lib/preview/mock-data";
import { Button } from "@/components/ui/button";
import { PreviewHeader } from "@/components/preview/PreviewNav";

export default function PreviewConfiguracoesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <PreviewHeader
        title="Configurações"
        subtitle="Dados cadastrais e horários de funcionamento do Studio Bella"
        currentPath="/preview/configuracoes"
      />

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

        {/* Recebimento de Pagamentos Pix */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">
              Recebimento de Pagamentos Pix
            </h2>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              Pix Direto
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Os sinais pagos pelos clientes são transferidos para a conta bancária cadastrada do estabelecimento.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Tipo de Chave</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 font-semibold text-foreground">
                CNPJ
              </div>
            </div>
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Chave Cadastrada</label>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 font-mono text-foreground">
                12.345.678/0001-90
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
            🔒 Repasse de sinais antecipados para proteção contra faltas e perda de horário.
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
