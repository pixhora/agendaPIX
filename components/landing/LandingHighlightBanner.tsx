import React from "react";
import Link from "next/link";

export function LandingHighlightBanner() {
  const steps = [
    {
      num: "1",
      title: "Cadastre seus serviços em 3 minutos",
      desc: "Defina o nome, a duração do procedimento e quanto quer cobrar de sinal por Pix para segurar a vaga.",
    },
    {
      num: "2",
      title: "Coloque o link na bio e no WhatsApp",
      desc: "Seus clientes acessam o link direto do celular, sem precisar instalar nenhum aplicativo.",
    },
    {
      num: "3",
      title: "O cliente agenda e paga o sinal no Pix",
      desc: "O horário só é bloqueado após o Pix ser confirmado. Menos mensagens, zero calote.",
    },
  ];

  return (
    <section id="como-funciona" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[32px] sm:rounded-[44px] p-6 sm:p-10 lg:p-14 border border-line bg-surface shadow-md overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Lado Esquerdo: Placa do Estabelecimento */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-[340px] sm:max-w-[360px] rounded-3xl bg-slab p-6 text-slab-foreground shadow-2xl border border-line">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-lime" />
                    <span className="text-xs font-bold text-white tracking-wide">Studio Bella · SP</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/10 text-white px-2 py-0.5 rounded-full">
                    Pix ativo
                  </span>
                </div>

                <div className="mt-6 mb-8">
                  <p className="text-xs text-white/60 font-medium">Sinais recebidos hoje</p>
                  <p className="font-display text-4xl sm:text-5xl font-black text-white mt-1 tabular-nums tracking-tight">
                    R$ 370
                  </p>
                  <p className="text-[11px] text-lime mt-1 font-semibold">
                    ↑ 100% de presença confirmada
                  </p>
                </div>

                {/* Métricas no Card */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/10 p-2.5 text-center">
                    <p className="text-[10px] text-white/60">Agendados</p>
                    <p className="text-sm font-bold text-white mt-0.5 tabular-nums">8 vagas</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-2.5 text-center">
                    <p className="text-[10px] text-white/60">No-show</p>
                    <p className="text-sm font-bold text-lime mt-0.5 tabular-nums">0 faltas</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-2.5 text-center">
                    <p className="text-[10px] text-white/60">Restante</p>
                    <p className="text-sm font-bold text-white mt-0.5 tabular-nums">R$ 510</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lado Direito: Passos Legítimos */}
            <div className="lg:col-span-7">
              <span className="inline-block rounded-full bg-paper border border-line px-3.5 py-1 text-xs font-bold text-muted-foreground mb-3">
                Simplicidade total
              </span>
              <h2 className="font-display text-2xl sm:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
                Receba sinal por Pix em 3 passos simples
              </h2>

              <div className="mt-8 space-y-6">
                {steps.map((s) => (
                  <div key={s.num} className="flex items-start gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-ink text-paper flex items-center justify-center font-extrabold text-sm shadow-sm">
                      {s.num}
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground">
                        {s.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-9">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center justify-center rounded-full bg-ink hover:opacity-90 text-paper px-7 py-3.5 text-sm sm:text-base font-bold shadow-md transition-all focus:outline-hidden"
                >
                  Criar minha agenda agora
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
