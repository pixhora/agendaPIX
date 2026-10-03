import React from "react";

const FAQS = [
  {
    q: "Preciso cadastrar cartão de crédito para fazer o teste?",
    a: "Não! O teste de 7 dias é totalmente livre. Você só decide assinar depois de testar na prática com seus clientes.",
  },
  {
    q: "Como o cliente paga o sinal?",
    a: "Assim que ele escolhe o horário e digita o telefone, a tela gera um QR Code Pix instantâneo com código Copia e Cola e prazo de 15 minutos. Quando ele paga no aplicativo do banco dele, a reserva é confirmada imediatamente.",
  },
  {
    q: "E se o cliente não pagar o Pix a tempo?",
    a: "Se passarem os 15 minutos sem pagamento, a pré-reserva expira e o horário volta a ficar livre para outro cliente agendar automaticamente. Você não perde a vaga.",
  },
  {
    q: "Meu cliente precisa baixar algum aplicativo?",
    a: "Não. Ele apenas toca no seu link pelo celular e abre a página no navegador normal (Chrome, Safari, etc.). Funciona em qualquer celular.",
  },
  {
    q: "Posso escolher quais serviços cobram sinal?",
    a: "Sim. Você tem total controle: pode definir sinal de R$ 15, R$ 20, cobrar 50% do valor ou até mesmo deixar sem sinal para serviços específicos.",
  },
];

export function LandingFaq() {
  return (
    <section id="perguntas-frequentes" className="py-16 sm:py-24 border-t border-border bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block rounded-full bg-accent-forest text-primary px-3.5 py-1 text-xs font-bold uppercase tracking-wider mb-4">
            Tire Suas Dúvidas
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Perguntas frequentes
          </h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((item, index) => (
            <div
              key={index}
              className="rounded-3xl border border-border bg-surface p-6 sm:p-7 shadow-xs space-y-2.5"
            >
              <h3 className="font-display text-base sm:text-lg font-bold text-foreground">
                {item.q}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
