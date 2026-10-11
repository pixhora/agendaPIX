import { faqItems } from "@/lib/marketing/landing-copy";
import type { PublicBookingFacts } from "@/lib/marketing/facts";
import { supportEmailAddress, supportMailtoUrl, supportWhatsappUrl } from "@/lib/support-contact";
import { Eyebrow, SectionTitle } from "./section";
import { FaqAccordion } from "./FaqAccordion";

export function LandingFaq({ facts }: { facts: PublicBookingFacts }) {
  const whatsapp = supportWhatsappUrl();
  return (
    <section id="perguntas-frequentes" aria-labelledby="faq-titulo" className="scroll-mt-24 border-t border-line py-16 lg:py-28">
      <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Eyebrow>Dúvidas</Eyebrow>
          <SectionTitle id="faq-titulo">Perguntas frequentes</SectionTitle>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Não achou?{" "}
            {whatsapp ? (
              <>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-semibold text-pix underline underline-offset-4">
                  Suporte no WhatsApp
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
                {" "}ou escreva para{" "}
              </>
            ) : "Escreva para "}
            <a href={supportMailtoUrl()} className="font-semibold text-pix underline underline-offset-4">
              {supportEmailAddress()}
            </a>
            .
          </p>
        </div>
        <FaqAccordion items={faqItems(facts)} />
      </div>
    </section>
  );
}
