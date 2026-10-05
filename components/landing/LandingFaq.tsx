import { ChevronDown } from "lucide-react";

const FAQS = [
  { q: "Preciso cadastrar cartão de crédito para testar?", a: "Não. O teste de 7 dias é livre. Você só decide assinar depois de usar com seus clientes." },
  { q: "Como o cliente paga o sinal?", a: "Depois de escolher o horário e informar nome e WhatsApp, ele recebe um QR Code Pix com o código copia e cola. Quando paga no app do banco, a reserva é confirmada na hora." },
  { q: "E se o cliente não pagar a tempo?", a: "Depois de 15 minutos sem pagamento, a pré-reserva expira e o horário volta a ficar livre para outra pessoa." },
  { q: "Meu cliente precisa baixar aplicativo ou criar conta?", a: "Não. Ele abre o seu link no navegador do celular, escolhe o horário e paga. Só isso." },
  { q: "Posso escolher quais serviços cobram sinal?", a: "Sim. Cada serviço tem o próprio valor de sinal, e você pode deixar sinal zero para confirmar sem cobrança." },
];

export function LandingFaq() {
  return (
    <section id="perguntas-frequentes" className="scroll-mt-20 border-t border-line py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-pix">Dúvidas</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Perguntas frequentes</h2>
        </div>
        <div className="divide-y divide-line rounded-frame border border-line bg-surface">
          {FAQS.map((item) => (
            <details key={item.q} className="group px-5 sm:px-6">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-lg [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <p className="pb-5 leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
