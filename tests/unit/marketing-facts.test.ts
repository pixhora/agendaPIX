import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bookingConfig } from "../../lib/bookings/config";
import { demoSteps, faqItems, holdAnswer, moneyLead } from "../../lib/marketing/landing-copy";
import { subscriptionActivationHours, subscriptionPriceRule } from "../../lib/marketing/plans";
import { formatMinutes, getPublicBookingFacts, type PublicBookingFacts } from "../../lib/marketing/facts";

const feminineBrand = /(?:^|[^\p{L}])(?:a|da|pela|na)\s+AgendaPix/iu;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

describe("formatMinutes", () => {
  it("uses the singular only for one minute", () => {
    expect(formatMinutes(1)).toBe("1 minuto");
    expect(formatMinutes(12)).toBe("12 minutos");
    expect(formatMinutes(30)).toBe("30 minutos");
  });
});

describe("getPublicBookingFacts", () => {
  const previousHold = process.env.BOOKING_HOLD_MINUTES;
  const previousCpf = process.env.MP_REQUIRES_PAYER_CPF;

  afterEach(() => {
    if (previousHold === undefined) delete process.env.BOOKING_HOLD_MINUTES;
    else process.env.BOOKING_HOLD_MINUTES = previousHold;
    if (previousCpf === undefined) delete process.env.MP_REQUIRES_PAYER_CPF;
    else process.env.MP_REQUIRES_PAYER_CPF = previousCpf;
  });

  it("follows bookingConfig when the env is unset: hold 30, no CPF, null recipient", async () => {
    delete process.env.BOOKING_HOLD_MINUTES;
    delete process.env.MP_REQUIRES_PAYER_CPF;
    await expect(getPublicBookingFacts()).resolves.toEqual({
      holdMinutes: 30,
      pixRecipientDisplayName: null,
      requiresPayerCpf: false,
    });
  });

  it("reads the hold and the CPF flag from the env", async () => {
    process.env.BOOKING_HOLD_MINUTES = "28";
    process.env.MP_REQUIRES_PAYER_CPF = "true";
    await expect(getPublicBookingFacts()).resolves.toEqual({
      holdMinutes: 28,
      pixRecipientDisplayName: null,
      requiresPayerCpf: true,
    });
  });

  it("accepts a hold inside the configured range", async () => {
    process.env.BOOKING_HOLD_MINUTES = "30";
    await expect(getPublicBookingFacts()).resolves.toMatchObject({ holdMinutes: 30 });
  });

  it("keeps a null recipient for a non-uuid business id and does not query the database", async () => {
    delete process.env.BOOKING_HOLD_MINUTES;
    const facts = await getPublicBookingFacts("studio-bella");
    expect(facts.pixRecipientDisplayName).toBeNull();
    expect(facts.holdMinutes).toBe(30);
  });
});

describe("landing copy", () => {
  const withName: PublicBookingFacts = {
    holdMinutes: 12,
    pixRecipientDisplayName: "Titular Que Não Pode Aparecer",
    requiresPayerCpf: false,
  };

  it("does not render the recipient name", () => {
    const rendered = `${moneyLead()}\n${faqItems(withName).map((item) => item.answer).join("\n")}`;
    expect(rendered).not.toContain("Titular Que Não Pode Aparecer");
    expect(rendered).toContain("12 minutos");
    expect(rendered).toContain("conta Mercado Pago");
    expect(rendered).toContain("você devolve pelo app do Mercado Pago");
    expect(rendered).not.toContain("Devolver pelo AgendaPix");
    expect(rendered).toContain("devolvido sozinho, o valor inteiro");
    expect(rendered).toContain("você recebe um e-mail");
    expect(rendered).not.toMatch(/nada é devolvido sozinho|nada é automático|reembolsos nunca|repasse|chave Pix/i);
  });

  it("shows the CPF step and FAQ only when requiresPayerCpf is true", () => {
    const withoutCpf = faqItems(withName);
    const withCpf = faqItems({ ...withName, requiresPayerCpf: true });

    expect(demoSteps(false)[2]).toBe("Informa nome e WhatsApp e lê a política do sinal antes de pagar.");
    expect(demoSteps(true)[2]).toBe("Informa nome, WhatsApp e CPF e lê a política do sinal antes de pagar.");
    expect(withoutCpf.some((item) => item.id === "cpf" || item.question.includes("CPF"))).toBe(false);
    expect(withCpf.find((item) => item.id === "cpf")?.question).toBe("Por que o cliente informa o CPF?");
  });

  it("does not publish FAQ JSON-LD, so the CPF question cannot leak into structured data", () => {
    const files = [...sourceFiles("components/landing"), ...sourceFiles("lib/marketing"), "app/page.tsx"];
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return /FAQPage|ld\+json/.test(source) ? [file] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("keeps the brand masculine in landing source", () => {
    const files = [...sourceFiles("components/landing"), ...sourceFiles("lib/marketing"), "app/page.tsx"];
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return feminineBrand.test(source) ? [file] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("labels the fictional hero composition and keeps the cards decorative", () => {
    const source = readFileSync("components/landing/HeroMotion.tsx", "utf8");
    expect(source).toContain("Demonstração com dados fictícios");
    expect(source).toContain("Studio Bella");
    expect(source).toContain("Sinal recebido pelo Pix");
    expect(source).toContain("Horário confirmado");
    expect(source).toContain("R$ 40,00");
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/Ana|Bruna|Exemplo ilustrativo|R\$ 80,00|4 reservas|minutos|chave Pix/);
  });

  it("does not ship invented customers or sample businesses on the landing", () => {
    const files = ["components/landing/LandingHero.tsx", "components/landing/LandingSteps.tsx", "components/landing/DemoSection.tsx"];
    const rendered = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(rendered).not.toMatch(/Studio Bella|Nova reserva · Ana|Bruna|Exemplo ilustrativo|R\$ 80,00|4 reservas/);
  });

  it("says the deposit lands in the owner's Mercado Pago account", () => {
    const files = [...sourceFiles("components/landing"), ...sourceFiles("lib/marketing")];
    const rendered = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(rendered).toContain("O sinal cai direto na sua conta Mercado Pago");
    expect(rendered).not.toMatch(/processados pelo Mercado Pago/);
    for (const file of [
      "components/landing/LandingFooter.tsx",
      "components/landing/LandingHero.tsx",
      "components/landing/LandingSteps.tsx",
      "components/landing/LandingPricing.tsx",
      "components/landing/LandingFinalCta.tsx",
      "lib/marketing/landing-copy.ts",
      "components/landing/Roadmap.tsx",
    ]) {
      expect(readFileSync(file, "utf8"), file).toMatch(/conta Mercado Pago/);
    }
    expect(readFileSync("components/landing/LandingFooter.tsx", "utf8")).toContain("O AgendaPix");
  });

  it("renders the landing hold from facts.ts", async () => {
    delete process.env.BOOKING_HOLD_MINUTES;
    const facts = await getPublicBookingFacts();
    expect(facts.holdMinutes).toBe(bookingConfig({}).BOOKING_HOLD_MINUTES);
    const answer = faqItems(facts).find((item) => item.id === "hold_time")?.answer;
    expect(answer).toBe(holdAnswer(facts.holdMinutes));
    expect(answer).toBe(`${formatMinutes(facts.holdMinutes)} depois de escolher o horário. Se o Pix não for pago nesse tempo, o código vence e o horário volta a ficar livre para outra pessoa.`);
    expect(answer).not.toMatch(/10 minutos/);
    const files = [...sourceFiles("components/landing"), ...sourceFiles("lib/marketing"), "app/page.tsx"];
    const offenders = files.flatMap((file) => (/10 min/i.test(readFileSync(file, "utf8")) ? [file] : []));
    expect(offenders).toEqual([]);
  });

  it("says the old link redirects and the plan rule follows the activation hours", () => {
    const answer = faqItems({ holdMinutes: 30, pixRecipientDisplayName: null, requiresPayerCpf: false }).find((item) => item.id === "change_link");
    expect(answer?.answer).toBe("Dá pra mudar o link em Configurações. O link antigo passa a levar para o novo.");
    expect(subscriptionActivationHours({})).toBeNull();
    expect(subscriptionActivationHours({ SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: "0" })).toBeNull();
    expect(subscriptionActivationHours({ SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: "02" })).toBeNull();
    expect(subscriptionPriceRule(null)).toBe("R$ 49/mês, pago pela página de assinatura. Ativação assim que confirmarmos o pagamento.");
    expect(subscriptionPriceRule(1)).toBe("R$ 49/mês, pago pela página de assinatura. Ativação em até 1 hora depois do pagamento.");
    expect(subscriptionPriceRule(6)).toBe("R$ 49/mês, pago pela página de assinatura. Ativação em até 6 horas depois do pagamento.");
    const pricing = readFileSync("components/landing/LandingPricing.tsx", "utf8");
    expect(pricing.match(/text-\[14px\]/g)).toHaveLength(1);
    expect(pricing.match(/\{rule\}/g)).toHaveLength(1);
  });

  it("does not hardcode a payment deadline in the landing components", () => {
    const files = [...sourceFiles("components/landing"), "app/page.tsx"];
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return /10 min|15 min|minutos|PAYOUTS_ENABLED|chave Pix|repasse/i.test(source) ? [file] : [];
    });
    expect(offenders).toEqual([]);
  });
});
