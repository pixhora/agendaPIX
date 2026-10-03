import React from "react";

export function LandingEditorialBenefits() {
  return (
    <section id="recursos" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho da Seção com Badge e Editorial */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-5 border-b border-border">
          <div>
            <span className="inline-block rounded-full bg-accent-forest text-primary px-3.5 py-1 text-xs font-bold uppercase tracking-wider mb-3">
              Vantagens
            </span>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground leading-tight max-w-3xl">
              Elimine o prejuízo de{" "}
              <span className="text-accent-forest dark:text-primary font-bold underline decoration-primary decoration-4 underline-offset-4">
                horários vazios
              </span>{" "}
              e recupere seu tempo com uma plataforma feita para o Brasil.
            </h2>
          </div>
          <p className="text-sm font-medium text-muted-foreground md:text-right shrink-0">
            Tudo o que você precisa, sem complicação.
          </p>
        </div>

        {/* Grid de 4 Blocos da Referência Visual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Bloco 1: Visual / Destaque de Notificação Pix */}
          <div className="rounded-3xl bg-surface p-6 border border-border shadow-xs flex flex-col justify-between min-h-[260px] sm:min-h-[280px]">
            <div className="h-10 w-10 rounded-full bg-accent-forest text-primary flex items-center justify-center font-bold text-lg">
              ⚡
            </div>
            <div>
              <div className="inline-block rounded-xl bg-muted p-3 border border-border mb-3">
                <p className="text-[11px] font-bold text-accent-forest dark:text-primary">✓ Notificação no celular</p>
                <p className="text-xs font-semibold text-foreground">&ldquo;Pix de R$ 30 recebido. Vaga das 14h garantida!&rdquo;</p>
              </div>
              <h3 className="text-lg font-bold text-foreground">Zero perda de tempo</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Você não precisa abrir o app do banco toda hora para checar se o comprovante é verdadeiro.
              </p>
            </div>
          </div>

          {/* Bloco 2: Verde-Lima com Sinal no Pix */}
          <div className="rounded-3xl bg-primary p-6 border border-lime-300 shadow-sm flex flex-col justify-between min-h-[260px] sm:min-h-[280px] text-primary-foreground">
            <div className="flex items-center justify-between">
              <span className="h-10 w-10 rounded-full bg-black/10 flex items-center justify-center font-extrabold text-sm">
                01
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-black/10 px-2.5 py-0.5 rounded-full">
                Compromisso
              </span>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-primary-foreground leading-snug">
                Sinal Automático no Pix
              </h3>
              <p className="mt-2 text-xs font-medium text-primary-foreground/80 leading-relaxed">
                O cliente paga uma entrada no ato do agendamento. Se ele comparecer, abate do total. Se ele faltar sem avisar, seu horário já está pago.
              </p>
            </div>
          </div>

          {/* Bloco 3: Verde-Lima Claro com Agenda Autônoma */}
          <div className="rounded-3xl bg-[#D6FA75] dark:bg-surface dark:border dark:border-border p-6 shadow-sm flex flex-col justify-between min-h-[260px] sm:min-h-[280px] text-[#111613] dark:text-foreground">
            <div className="flex items-center justify-between">
              <span className="h-10 w-10 rounded-full bg-black/10 dark:bg-muted flex items-center justify-center font-extrabold text-sm">
                02
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-black/10 dark:bg-muted px-2.5 py-0.5 rounded-full">
                24h por dia
              </span>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-foreground leading-snug">
                Sem Conversa Fiada no WhatsApp
              </h3>
              <p className="mt-2 text-xs font-medium text-foreground/80 leading-relaxed">
                Chega de trocar 15 mensagens para marcar um corte. O cliente abre seu link, vê as vagas em tempo real e fecha em 4 passos.
              </p>
            </div>
          </div>

          {/* Bloco 4: Verde Petróleo Profundo com Gestão Financeira */}
          <div className="rounded-3xl bg-accent-forest p-6 border border-emerald-950 shadow-md flex flex-col justify-between min-h-[260px] sm:min-h-[280px] text-white">
            <div className="flex items-center justify-between">
              <span className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center font-extrabold text-primary text-sm">
                03
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/10 px-2.5 py-0.5 rounded-full text-primary">
                Controle
              </span>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white leading-snug">
                Controle do Dia em Centavos
              </h3>
              <p className="mt-2 text-xs text-white/80 leading-relaxed">
                Saiba exatamente quanto já entrou em sinal por Pix e quanto resta a receber no atendimento presencial. Sem surpresas no caixa.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
