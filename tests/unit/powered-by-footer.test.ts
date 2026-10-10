import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PoweredByFooter } from "@/components/booking/PoweredByFooter";
import { BookingFlow } from "@/components/booking/BookingFlow";
import {
  POWERED_BY_LEAD,
  POWERED_BY_LINK_LABEL,
  poweredByCampaign,
  poweredByHref,
} from "@/lib/brand/powered-by";

const publicHref = "/?utm_source=agendapix&utm_medium=rodape&utm_campaign=pagina_publica";
const confirmedHref = "/?utm_source=agendapix&utm_medium=rodape&utm_campaign=reserva_confirmada";

describe("rodapé AgendaPix", () => {
  it("omite o rodapé na tela de Pix e escolhe a campanha da página", () => {
    expect(poweredByCampaign("payment")).toBeNull();
    expect(poweredByCampaign("public_page")).toBe("pagina_publica");
    expect(poweredByCampaign("booking_confirmed")).toBe("reserva_confirmada");
  });

  it("aponta para a landing só com a UTM da spec", () => {
    expect(poweredByHref("pagina_publica")).toBe(publicHref);
    expect(poweredByHref("reserva_confirmada")).toBe(confirmedHref);
    for (const href of [publicHref, confirmedHref]) {
      const url = new URL(href, "https://www.agendapix.dev.br");
      expect(url.pathname).toBe("/");
      expect([...url.searchParams.keys()].sort()).toEqual(["utm_campaign", "utm_medium", "utm_source"]);
      expect(url.searchParams.get("utm_source")).toBe("agendapix");
      expect(url.searchParams.get("utm_medium")).toBe("rodape");
      expect(url.searchParams.get("utm_content")).toBeNull();
    }
  });

  it("mostra o texto exato e o link só em Crie a sua grátis", () => {
    const html = renderToStaticMarkup(createElement(PoweredByFooter, { campaign: "reserva_confirmada" }));
    expect(html).toContain(POWERED_BY_LEAD);
    expect(html).toContain(`>${POWERED_BY_LINK_LABEL}</a>`);
    expect(html).toContain(`href="${confirmedHref.replaceAll("&", "&amp;")}"`);
    expect(html).toContain("size-4");
    expect(html).toContain("text-xs");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("min-h-11");
    expect(html).toContain("mt-6");
    expect(html).toContain("border-line");
    expect(html).not.toContain("utm_content");
    expect(html).not.toContain(`${POWERED_BY_LEAD} ${POWERED_BY_LINK_LABEL}</a>`);
    expect(`${POWERED_BY_LEAD} ${POWERED_BY_LINK_LABEL}`).toBe(
      "Agenda com sinal no Pix feita no AgendaPix. Crie a sua grátis",
    );
  });

  it("aparece na página pública e some quando a renderização é a de pagamento", () => {
    const html = renderToStaticMarkup(createElement(BookingFlow, {
      slug: "studio-ana",
      previewBusiness: {
        name: "Studio Ana",
        timezone: "America/Sao_Paulo",
        phone: "5511999998888",
        services: [{
          id: "corte",
          name: "Corte",
          durationMinutes: 45,
          priceCents: 8000,
          depositCents: 2000,
          policySummary: "O sinal reserva o horário.",
          policyHash: "hash",
        }],
      },
    }));
    expect(html).toContain("Agenda com sinal no Pix feita no AgendaPix.");
    expect(html).toContain("utm_campaign=pagina_publica");
    expect(html).not.toContain("utm_campaign=reserva_confirmada");
    expect(html).not.toContain("Feito com AgendaPix");
    expect(poweredByCampaign("payment")).toBeNull();
  });
});
