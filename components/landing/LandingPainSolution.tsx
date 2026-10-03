import React from "react";

export function LandingPainSolution() {
  return (
    <section id="como-funciona" className="py-14 sm:py-20 border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            A realidade do seu dia a dia
          </span>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Você perde clientes e dinheiro porque a reserva ainda depende de conversa manual
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* O Jeito Antigo */}
          <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.02] p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive text-lg font-bold">
                ✕
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">
                Como você perde dinheiro hoje
              </h3>
            </div>

            <ul className="space-y-3.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <span className="text-destructive font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong>Cliente marca e não aparece:</strong> você reserva a vaga na confiança, recusa outros atendimentos e toma calote sem receber um centavo.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-destructive font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong>Horas perdidas no WhatsApp:</strong> passar valores um por um, checar disponibilidade de agenda e tentar conciliar horários à noite.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-destructive font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong>Desconforto de cobrar sinal:</strong> ter que passar sua chave Pix pessoal, esperar o comprovante e conferir extrato enquanto atende.
                </span>
              </li>
            </ul>
          </div>

          {/* O Jeito com a Agenda */}
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.02] p-6 sm:p-8 space-y-4 ring-1 ring-primary/20">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 text-lg font-bold">
                ✓
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">
                Como funciona com a Agenda
              </h3>
            </div>

            <ul className="space-y-3.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong>Sinal no Pix confirma o horário:</strong> o cliente paga R$ 15 ou R$ 20 de entrada direto no Pix. Quem paga o sinal não falta.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong>Agendamento em 1 minuto:</strong> link público na bio do Instagram ou fixado no WhatsApp. O cliente escolhe sozinho em 4 toques rápidos.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong>Confirmação 100% automática:</strong> o sistema gera o QR Code Pix com vencimento de 15 minutos e libera a vaga se o pagamento não ocorrer.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
