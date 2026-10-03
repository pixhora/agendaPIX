import React from "react";
import Link from "next/link";

export function LandingHighlightBanner() {
  const steps = [
    {
      num: "01",
      title: "Cadastre seus serviços em 3 minutos",
      desc: "Defina o nome, a duração do procedimento e quanto quer cobrar de sinal por Pix para segurar a vaga.",
    },
    {
      num: "02",
      title: "Coloque o link na bio e no WhatsApp",
      desc: "Seus clientes acessam o link direto do celular, sem precisar instalar nenhum aplicativo.",
    },
    {
      num: "03",
      title: "O cliente agenda e o Pix cai direto",
      desc: "O horário só é bloqueado após o Pix ser confirmado. Menos mensagens, zero calote.",
    },
  ];

  return (
    <section id="como-funciona" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div 
          className="rounded-[32px] sm:rounded-[44px] p-6 sm:p-10 lg:p-14 border border-lime-300 shadow-xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #C0F739 0%, #AEEF20 100%)",
            color: "#111613"
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Lado Esquerdo: Card Dark Mode do Estabelecimento */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-[340px] sm:max-w-[360px] rounded-3xl bg-[#0E1612] p-6 text-white shadow-2xl border border-emerald-900/50">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-[#C0F739]" />
                    <span className="text-xs font-bold text-white tracking-wide">Studio Bella · SP</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase bg-emerald-900/60 text-[#C0F739] px-2 py-0.5 rounded-full">
                    Pix Ligado
                  </span>
                </div>

                <div className="mt-6 mb-8">
                  <p className="text-xs text-white/60 font-medium">Sinais Recebidos Hoje</p>
                  <p className="text-3xl sm:text-4xl font-extrabold text-white mt-1 tracking-tight">
                    R$ 370,00
                  </p>
                  <p className="text-[11px] text-[#C0F739] mt-1 font-semibold">
                    ↑ 100% de presença confirmada
                  </p>
                </div>

                {/* Ações Rápidas no Card */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/10 p-2.5 text-center">
                    <p className="text-[10px] text-white/60">Agendados</p>
                    <p className="text-sm font-bold text-white mt-0.5">8 vagas</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-2.5 text-center">
                    <p className="text-[10px] text-white/60">No-show</p>
                    <p className="text-sm font-bold text-[#C0F739] mt-0.5">0 faltas</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-2.5 text-center">
                    <p className="text-[10px] text-white/60">Restante</p>
                    <p className="text-sm font-bold text-white mt-0.5">R$ 510</p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-white/60">Fuso oficial:</span>
                  <span className="text-white/90 font-mono text-[11px]">America/Sao_Paulo</span>
                </div>
              </div>
            </div>

            {/* Lado Direito: Os 3 Passos Simples */}
            <div className="lg:col-span-7">
              <span className="inline-block rounded-full bg-black/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#111613] mb-3">
                Simplicidade Total
              </span>
              <h2 className="font-display text-2xl sm:text-4xl lg:text-5xl font-extrabold text-[#111613] leading-tight">
                Receba sinal por Pix em 3 passos simples
              </h2>

              <div className="mt-8 space-y-6">
                {steps.map((s) => (
                  <div key={s.num} className="flex items-start gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-[#111613] text-[#C0F739] flex items-center justify-center font-extrabold text-sm shadow-sm">
                      {s.num}
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[#111613]">
                        {s.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-[#111613]/80 leading-relaxed max-w-xl">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-9">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center justify-center rounded-full bg-[#111613] hover:bg-black text-[#C0F739] px-7 py-3.5 text-sm sm:text-base font-bold shadow-md transition-all focus:outline-hidden"
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
