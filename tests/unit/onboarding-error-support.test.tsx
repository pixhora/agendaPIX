import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OnboardingError from "../../app/onboarding/error";
import { OnboardingSupportProvider } from "../../components/onboarding/support-href";

function screen(supportWhatsappHref: string | null) {
  return renderToStaticMarkup(
    <OnboardingSupportProvider supportWhatsappHref={supportWhatsappHref}>
      <OnboardingError error={new Error("onboarding_mp_return_probe")} retry={() => undefined} />
    </OnboardingSupportProvider>,
  );
}

describe("suporte no erro do onboarding", () => {
  it("mostra Suporte no WhatsApp quando o layout manda o link", () => {
    const html = screen("https://wa.me/5511912345678");
    expect(html).toContain("Tentar de novo");
    expect(html).toContain('href="https://wa.me/5511912345678"');
    expect(html).toContain("Suporte no WhatsApp");
  });

  it("esconde o link quando o layout manda null e a tela continua", () => {
    const html = screen(null);
    expect(html).toContain("Tentar de novo");
    expect(html).toContain("Não conseguimos voltar do Mercado Pago");
    expect(html).not.toContain("Suporte no WhatsApp");
    expect(html).not.toContain("wa.me");
  });
});
