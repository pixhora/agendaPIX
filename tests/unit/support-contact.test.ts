import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingFaq } from "../../components/landing/LandingFaq";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { readManualCheckoutConfig } from "../../lib/billing/config";
import { readSupportWhatsappNumber, supportWhatsappUrl } from "../../lib/support-contact";

/** Número que a landing usava quando a env faltava. Não pode voltar para o código. */
const retiredLandingNumber = "5514997504655";

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

describe("WhatsApp de apoio", () => {
  it("lê SUPPORT_WHATSAPP_NUMBER com a mesma regra do checkout e omite o link sem a env", () => {
    const env = { SUPPORT_WHATSAPP_NUMBER: "5511912345678" };
    expect(readSupportWhatsappNumber(env)).toBe("5511912345678");
    expect(supportWhatsappUrl(env)).toBe("https://wa.me/5511912345678");
    expect(readManualCheckoutConfig({ ...env, SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: "1" })).toMatchObject({
      available: true,
      whatsappNumber: "5511912345678",
    });
    expect(readSupportWhatsappNumber({ SUPPORT_WHATSAPP_NUMBER: "5500000000000" })).toBeNull();
    expect(supportWhatsappUrl({ SUPPORT_WHATSAPP_NUMBER: "5500000000000" })).toBeNull();

    for (const missing of [{}, { SUPPORT_WHATSAPP_NUMBER: "" }, { SUPPORT_WHATSAPP_NUMBER: "+5500000000000" }, { SUPPORT_WHATSAPP_NUMBER: "123" }]) {
      expect(readSupportWhatsappNumber(missing)).toBeNull();
      expect(supportWhatsappUrl(missing)).toBeNull();
      expect(readManualCheckoutConfig(missing)).toMatchObject({ available: false, whatsappNumber: null });
    }
  });

  it("não grava o número antigo da landing", () => {
    const roots = ["lib", "components", "app"].map((dir) => join(import.meta.dirname, "../../", dir));
    for (const root of roots) {
      for (const path of filesUnder(root)) {
        expect(readFileSync(path, "utf8"), path).not.toContain(retiredLandingNumber);
      }
    }
    expect(readFileSync(join(import.meta.dirname, "../../.env.example"), "utf8")).not.toContain(retiredLandingNumber);
  });

  it("componentes de cliente não importam o contato de suporte", () => {
    const clientSurfaces = [
      "components/booking/BookingFlow.tsx",
      "components/dashboard/app-frame.tsx",
      "app/onboarding/error.tsx",
      "app/onboarding/recebimento/error.tsx",
    ];
    for (const file of clientSurfaces) {
      const source = readFileSync(join(import.meta.dirname, "../../", file), "utf8");
      expect(source, file).not.toContain("support-contact");
      expect(source, file).not.toContain("supportWhatsappUrl(");
    }
  });

  it("a landing esconde o Fale com a gente sem a env e mostra o mesmo link do checkout com ela", () => {
    const key = "SUPPORT_WHATSAPP_NUMBER";
    const previous = process.env[key];
    const facts = { holdMinutes: 15, pixRecipientDisplayName: null, requiresPayerCpf: false };
    try {
      delete process.env[key];
      const hiddenFooter = renderToStaticMarkup(createElement(LandingFooter));
      const hiddenFaq = renderToStaticMarkup(createElement(LandingFaq, { facts }));
      expect(hiddenFooter).toContain("Contato");
      expect(hiddenFooter).not.toContain("wa.me");
      expect(hiddenFaq).toContain("Escreva para ");
      expect(hiddenFooter).not.toContain("Suporte no WhatsApp");
      expect(hiddenFaq).not.toContain("Suporte no WhatsApp");
      expect(hiddenFaq).not.toContain("wa.me");

      process.env[key] = "5511912345678";
      const footer = renderToStaticMarkup(createElement(LandingFooter));
      const faq = renderToStaticMarkup(createElement(LandingFaq, { facts }));
      expect(footer).toContain('href="https://wa.me/5511912345678"');
      expect(faq).toContain('href="https://wa.me/5511912345678"');
      expect(footer).toContain("Suporte no WhatsApp");
      expect(faq).toContain("Suporte no WhatsApp");
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });
});
