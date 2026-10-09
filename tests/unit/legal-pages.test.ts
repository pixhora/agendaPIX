import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StepCustomer } from "../../components/booking/StepCustomer";
import type { AvailabilitySlot, PublicService } from "../../components/booking/types";
import { LegalArticle } from "../../components/legal/LegalArticle";
import { legalHeadingId, legalTableOfContents } from "../../lib/legal/headings";
import { assertLegalPublicationAllowed, legalPublicationProblems } from "../../lib/legal/publish";
import { privacyPolicyLink } from "../../lib/marketing/flags";
import sitemap from "../../app/sitemap";

const service: PublicService = {
  id: "svc",
  name: "Corte",
  durationMinutes: 30,
  priceCents: 8000,
  depositCents: 0,
};
const slot: AvailabilitySlot = {
  startsAt: "2030-01-02T15:00:00.000Z",
  endsAt: "2030-01-02T15:30:00.000Z",
};

describe("âncoras dos títulos legais", () => {
  it("deriva 5-a, 5 e 4-1", () => {
    expect(legalHeadingId("5-A. Conexão com o Mercado Pago")).toBe("5-a");
    expect(legalHeadingId("5. Sinal, política e devoluções")).toBe("5");
    expect(legalHeadingId("4.1. Assinante")).toBe("4-1");
    expect(legalHeadingId("Quem é quem")).toBeNull();
  });

  it("o sumário e o artigo usam esses ids", () => {
    const markdown = readFileSync("tests/fixtures/legal/termos.md", "utf8");
    const toc = legalTableOfContents(markdown);
    expect(toc.map((item) => item.id)).toEqual(["5", "5-a", "4-1"]);
    const html = renderToStaticMarkup(createElement(LegalArticle, { markdown, toc }));
    expect(html).toContain('id="5-a"');
    expect(html).toContain('id="5"');
    expect(html).toContain('id="4-1"');
    expect(html).toContain('href="#5-a"');
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});

describe("guarda de publicação", () => {
  it("com a flag desligada, o rascunho não derruba", () => {
    const draft = readFileSync("content/legal/termos.md", "utf8");
    expect(() => assertLegalPublicationAllowed(draft, false, "termos")).not.toThrow();
  });

  it("com a flag ligada, rascunho e placeholder derrubam e o link markdown não entra", () => {
    const draft = readFileSync("content/legal/termos.md", "utf8");
    expect(draft).toContain("[Política de Privacidade](/privacidade)");
    expect(() => assertLegalPublicationAllowed(draft, true, "privacidade")).toThrow(/Rascunho para revisão/);
    expect(() => assertLegalPublicationAllowed(draft, true, "termos")).toThrow(/\[NOME COMPLETO/);
    expect(legalPublicationProblems(draft).join(" ")).not.toContain("[Política");
    expect(legalPublicationProblems("Leia a [Política de Privacidade](/privacidade).")).toEqual([]);
    const fixture = readFileSync("tests/fixtures/legal/termos.md", "utf8");
    expect(legalPublicationProblems(fixture)).toEqual([]);
    expect(() => assertLegalPublicationAllowed(fixture, true, "fixture")).not.toThrow();
  });
});

describe("link de privacidade no agendamento", () => {
  const noop = () => undefined;

  function html(published: boolean) {
    return renderToStaticMarkup(createElement(StepCustomer, {
      service,
      slot,
      timezone: "America/Sao_Paulo",
      name: "",
      phone: "",
      cpf: "",
      isSubmitting: false,
      errorMessage: null,
      onChangeName: noop,
      onChangePhone: noop,
      onChangeCpf: noop,
      onBack: noop,
      onSubmit: noop,
      requiresPayerCpf: false,
      legalPagesPublished: published,
    }));
  }

  it("some com a flag desligada e aponta para /privacidade com a flag ligada", () => {
    delete process.env.LEGAL_PAGES_PUBLISHED;
    expect(sitemap().some((item) => item.url.includes("/termos") || item.url.includes("/privacidade"))).toBe(false);
    expect(privacyPolicyLink(false)).toBeNull();
    expect(privacyPolicyLink(true)).toEqual({ href: "/privacidade", label: "Política de Privacidade" });
    expect(html(false)).not.toContain("/privacidade");
    expect(html(true)).toContain('href="/privacidade"');
    expect(html(true)).toContain("Política de Privacidade");
  });
});
