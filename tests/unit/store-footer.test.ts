import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingFlow } from "../../components/booking/BookingFlow";
import { supportWhatsappUrl } from "../../lib/support-contact";

const business = {
  name: "Studio Ana",
  timezone: "America/Sao_Paulo",
  services: [
    {
      id: "corte",
      name: "Corte",
      durationMinutes: 45,
      priceCents: 8000,
      depositCents: 2000,
    },
  ],
};

function footer(published: boolean) {
  return renderToStaticMarkup(createElement(BookingFlow, {
    slug: "studio-ana",
    previewBusiness: business,
    legalPagesPublished: published,
  }));
}

describe("rodapé da loja", () => {
  it("mostra o WhatsApp de suporte e esconde os links legais com a flag desligada", () => {
    const html = footer(false);
    expect(html).toContain(`href="${supportWhatsappUrl()}"`);
    expect(html).toContain("Suporte no WhatsApp");
    expect(html).toContain("Feito com AgendaPix");
    expect(html).not.toContain('href="/termos"');
    expect(html).not.toContain('href="/privacidade"');
  });

  it("mostra termos e privacidade quando a flag está ligada, do mesmo jeito que a landing", () => {
    const html = footer(true);
    expect(html).toContain('href="/termos"');
    expect(html).toContain("Termos de uso");
    expect(html).toContain('href="/privacidade"');
    expect(html).toContain("Política de privacidade");
    expect(html).toContain("Suporte no WhatsApp");
  });
});
