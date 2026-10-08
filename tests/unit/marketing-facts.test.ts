import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { demoSteps, faqItems, moneyLead } from "../../lib/marketing/landing-copy";
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
  const previous = process.env.BOOKING_HOLD_MINUTES;

  afterEach(() => {
    if (previous === undefined) delete process.env.BOOKING_HOLD_MINUTES;
    else process.env.BOOKING_HOLD_MINUTES = previous;
  });

  it("reads the hold from booking config and returns a null recipient", async () => {
    process.env.BOOKING_HOLD_MINUTES = "12";
    await expect(getPublicBookingFacts()).resolves.toEqual({
      holdMinutes: 12,
      pixRecipientDisplayName: null,
      requiresPayerCpf: true,
    });
  });

  it("keeps the same public facts when a business id is passed", async () => {
    process.env.BOOKING_HOLD_MINUTES = "30";
    const facts = await getPublicBookingFacts("studio-bella");
    expect(facts.holdMinutes).toBe(30);
    expect(facts.pixRecipientDisplayName).toBeNull();
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
    expect(rendered).toContain("Devolver pelo AgendaPix");
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

  it("does not hardcode a payment deadline in the landing components", () => {
    const files = [...sourceFiles("components/landing"), "app/page.tsx"];
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return /10 min|15 min|minutos|PAYOUTS_ENABLED|chave Pix|repasse/i.test(source) ? [file] : [];
    });
    expect(offenders).toEqual([]);
  });
});
