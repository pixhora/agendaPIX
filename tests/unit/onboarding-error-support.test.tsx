import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OnboardingError from "../../app/onboarding/error";
import OnboardingRecebimentoError from "../../app/onboarding/recebimento/error";
import { OnboardingSupportProvider } from "../../components/onboarding/support-href";

function cadastro(supportWhatsappHref: string | null) {
  return renderToStaticMarkup(
    <OnboardingSupportProvider supportWhatsappHref={supportWhatsappHref}>
      <OnboardingError error={new Error("onboarding_generic_probe")} reset={() => undefined} />
    </OnboardingSupportProvider>,
  );
}

function recebimento(supportWhatsappHref: string | null) {
  return renderToStaticMarkup(
    <OnboardingSupportProvider supportWhatsappHref={supportWhatsappHref}>
      <OnboardingRecebimentoError error={new Error("onboarding_mp_return_probe")} reset={() => undefined} />
    </OnboardingSupportProvider>,
  );
}

describe("suporte no erro do onboarding", () => {
  it("mostra Suporte no WhatsApp no cadastro e no recebimento quando o layout manda o link", () => {
    for (const html of [cadastro("https://wa.me/5511912345678"), recebimento("https://wa.me/5511912345678")]) {
      expect(html).toContain("Tentar de novo");
      expect(html).toContain('href="https://wa.me/5511912345678"');
      expect(html).toContain("Suporte no WhatsApp");
    }
    expect(cadastro("https://wa.me/5511912345678")).toContain("Algo deu errado no cadastro");
    expect(recebimento("https://wa.me/5511912345678")).toContain("Não conseguimos voltar do Mercado Pago");
  });

  it("esconde o link quando o layout manda null e as duas telas continuam", () => {
    const cadastroHtml = cadastro(null);
    const recebimentoHtml = recebimento(null);
    expect(cadastroHtml).toContain("Algo deu errado no cadastro");
    expect(recebimentoHtml).toContain("Não conseguimos voltar do Mercado Pago");
    for (const html of [cadastroHtml, recebimentoHtml]) {
      expect(html).toContain("Tentar de novo");
      expect(html).not.toContain("Suporte no WhatsApp");
      expect(html).not.toContain("wa.me");
      expect(html).not.toContain("Falar com o suporte");
    }
  });
});
