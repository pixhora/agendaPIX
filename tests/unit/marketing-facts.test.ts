import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { faqItems, moneyLead } from "../../lib/marketing/landing-copy";
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
    expect(rendered).toContain("Nada é devolvido sozinho");
    expect(rendered).not.toMatch(/repasse|chave Pix|devolv\w+ automaticamente/i);
  });

  it("hides the CPF question unless the server requires it", () => {
    expect(faqItems(withName).some((item) => item.id === "cpf")).toBe(false);
    expect(faqItems({ ...withName, requiresPayerCpf: true }).some((item) => item.id === "cpf")).toBe(true);
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
