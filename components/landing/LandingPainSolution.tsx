import React from "react";

export function LandingPainSolution() {
  return (
    <section className="py-16 sm:py-24 border-t border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-block rounded-full bg-accent-forest text-primary px-3.5 py-1 text-xs font-bold uppercase tracking-wider mb-4">
            Comparativo Real
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Você perde clientes e dinheiro quando a reserva depende de conversa manual
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* O Jeito Antigo */}
          <div className="rounded-3xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-5 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 text-lg font-bold">
                ✕
              </span>
              <h3 className="font-display text-xl font-bold text-foreground">
                Como você perde dinheiro hoje
              </h3>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-rose-600 dark:text-rose-400 font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Cliente marca e não aparece:</strong> você reserva a vaga na confiança, recusa outros atendimentos e toma calote sem receber um centavo.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-600 dark:text-rose-400 font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Horas perdidas no WhatsApp:</strong> passar valores um por um, checar agenda no papel e tentar conciliar horários à noite.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-600 dark:text-rose-400 font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Desconforto de cobrar sinal:</strong> passar sua chave Pix pessoal, esperar o comprovante e conferir extrato enquanto atende.
                </span>
              </li>
            </ul>
          </div>

          {/* O Jeito com a Agenda Pix */}
          <div className="rounded-3xl border-2 border-accent-forest dark:border-primary/60 bg-surface p-5 sm:p-8 space-y-5 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-forest text-primary text-lg font-bold">
                ✓
              </span>
              <h3 className="font-display text-xl font-bold text-foreground">
                Com a Agenda Pix e Sinal Garantido
              </h3>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-accent-forest dark:text-primary font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Sinal no Pix garante o compromisso:</strong> o cliente paga uma entrada no Pix na hora. Quem paga o sinal não falta.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent-forest dark:text-primary font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Agendamento em 1 minuto:</strong> link público na bio do Instagram ou fixado no WhatsApp. O cliente agenda em 4 toques rápidos.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent-forest dark:text-primary font-bold shrink-0 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Confirmação instantânea do sinal:</strong> sistema gera o QR Code Pix com 15 min de prazo e libera o horário se não houver pagamento.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
