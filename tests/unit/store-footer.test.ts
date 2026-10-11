import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingFlow } from "../../components/booking/BookingFlow";

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

function footer(published: boolean, supportWhatsappHref: string | null) {
  return renderToStaticMarkup(createElement(BookingFlow, {
    slug: "studio-ana",
    previewBusiness: business,
    legalPagesPublished: published,
    supportWhatsappHref,
  }));
}

describe("rodapé da loja", () => {
  it("mostra o WhatsApp de suporte e esconde os links legais com a flag desligada", () => {
    const html = footer(false, "https://wa.me/5511912345678");
    expect(html).toContain('href="https://wa.me/5511912345678"');
    expect(html).toContain("Suporte no WhatsApp");
    expect(html).toContain("Feito com AgendaPix");
    expect(html).not.toContain('href="/termos"');
    expect(html).not.toContain('href="/privacidade"');
  });

  it("esconde o suporte quando SUPPORT_WHATSAPP_NUMBER não vem e a página continua", () => {
    const html = footer(false, null);
    expect(html).toContain("Feito com AgendaPix");
    expect(html).not.toContain("Suporte no WhatsApp");
    expect(html).not.toContain("wa.me");
  });

  it("mostra termos e privacidade quando a flag está ligada, do mesmo jeito que a landing", () => {
    const html = footer(true, "https://wa.me/5511912345678");
    expect(html).toContain('href="/termos"');
    expect(html).toContain("Termos de uso");
    expect(html).toContain('href="/privacidade"');
    expect(html).toContain("Política de privacidade");
    expect(html).toContain("Suporte no WhatsApp");
  });
});
