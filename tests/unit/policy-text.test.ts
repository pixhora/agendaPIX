import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PADRAO_DEPOSIT_POLICY, type DepositPolicy } from "../../lib/policy/schema";
import { CREDIT_PHRASE, clientPolicyText, ownerPreview, policyDetails, policyIcsText, policyListLabel, policySummary, refundWindowClosedAtBooking } from "../../lib/policy/text";

const HOURS = [null, 2, 12, 24, 48] as const;
const LATE = ["retain", "credit"] as const;
const NO_SHOW = ["retain", "credit", "refund"] as const;

function policy(partial: Pick<DepositPolicy, "refundUntilHours" | "rescheduleUntilHours" | "lateCancel" | "noShow">): DepositPolicy {
  return { ...PADRAO_DEPOSIT_POLICY, preset: "personalizada", ...partial };
}

describe("texto da política do sinal", () => {
  it("mantém a prévia do dono em até 320 caracteres em todas as combinações", () => {
    for (const refundUntilHours of HOURS) {
      for (const rescheduleUntilHours of HOURS) {
        for (const lateCancel of LATE) {
          for (const noShow of NO_SHOW) {
            const text = ownerPreview(policy({ refundUntilHours, rescheduleUntilHours, lateCancel, noShow }), {
              businessName: "Studio Bella",
              depositCents: 2000,
            });
            expect(text.length).toBeLessThanOrEqual(320);
            expect(text.toLowerCase()).not.toContain("repass");
            expect(text).not.toMatch(/\b(a|da|na|pela) AgendaPix\b/);
            if (refundUntilHours !== null || noShow === "refund") {
              expect(text).toContain("devolve pelo AgendaPix, conforme a política, se confirmar no painel");
              expect(text).not.toMatch(/receba o sinal|sinal devolvido/i);
            }
          }
        }
      }
    }
  });

  it("não importa banco nem servidor", () => {
    const source = readFileSync(new URL("../../lib/policy/text.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/node:|server-only|@\/db|drizzle/);
  });

  it("resume a política padrão e o caso dentro do prazo", () => {
    expect(policySummary(PADRAO_DEPOSIT_POLICY, { depositCents: 2000, businessName: "Barbearia do Zé" })).toBe(
      "Com 24 h de antecedência, Barbearia do Zé pode devolver o sinal. Mais perto da hora, o sinal fica com Barbearia do Zé.",
    );
    expect(policySummary(creditPolicy(), { depositCents: 2000, businessName: "Barbearia do Zé" })).toBe(
      "Com 24 h de antecedência, Barbearia do Zé pode devolver o sinal. Mais perto da hora, o sinal vira crédito para outro horário, válido por 60 dias.",
    );
    expect(policySummary({ ...creditPolicy(), creditValidityDays: 45 } as unknown as DepositPolicy, { depositCents: 2000, businessName: "Barbearia do Zé" })).toContain(CREDIT_PHRASE);
    expect(policySummary(PADRAO_DEPOSIT_POLICY, { depositCents: 0, businessName: "Barbearia do Zé" })).toBe("Sem sinal.");
    const startsAt = new Date("2030-01-02T15:00:00.000Z");
    expect(policySummary(PADRAO_DEPOSIT_POLICY, { depositCents: 2000, businessName: "Barbearia do Zé", startsAt, now: new Date("2030-01-02T12:00:00.000Z") }))
      .toBe("Faltam menos de 24 h para o horário: se cancelar, o sinal não é devolvido.");
    expect(policyListLabel(PADRAO_DEPOSIT_POLICY, 2000)).toBe("Até 24 h, conforme a política");
    expect(policyListLabel(PADRAO_DEPOSIT_POLICY, 0)).toBe("Sem sinal");
  });

  it("fala com o cliente pelo nome cadastrado, sem painel e sem artigo", () => {
    const startsAt = new Date("2026-10-08T14:30:00.000Z");
    const now = new Date("2026-10-01T15:00:00.000Z");
    const context = { businessName: "Barbearia do Zé", startsAt, now, timezone: "America/Sao_Paulo" as const };

    const withWhatsapp = policyDetails(PADRAO_DEPOSIT_POLICY, { ...context, contactWhatsapp: "+5511999999999" });
    expect(withWhatsapp.map((line) => line.title)).toEqual(["Até qua, 07 out, 11:30", "Depois disso", "Se faltar", "Como cancelar ou remarcar"]);
    expect(withWhatsapp.map((line) => line.body)).toEqual([
      "Cancele e Barbearia do Zé pode devolver o sinal, ou remarque usando o sinal (1 vez).",
      "Se cancelar, o sinal fica com Barbearia do Zé.",
      "O sinal fica com Barbearia do Zé.",
      "Fale com Barbearia do Zé pelo WhatsApp. A devolução não é automática: quem devolve é Barbearia do Zé, da conta Mercado Pago do negócio, depois de confirmar o cancelamento.",
    ]);

    const withoutWhatsapp = policyDetails(PADRAO_DEPOSIT_POLICY, { ...context, contactWhatsapp: null });
    expect(withoutWhatsapp[3]?.body).toBe(
      "Fale com Barbearia do Zé pelos canais de sempre. A devolução não é automática: quem devolve é Barbearia do Zé, da conta Mercado Pago do negócio, depois de confirmar o cancelamento.",
    );

    const creditLines = policyDetails(creditPolicy(), { ...context, contactWhatsapp: "+5511999999999" });
    expect(policySummary(creditPolicy(), { depositCents: 2000, businessName: "Barbearia do Zé" })).toBe(
      "Com 24 h de antecedência, Barbearia do Zé pode devolver o sinal. Mais perto da hora, o sinal vira crédito para outro horário, válido por 60 dias.",
    );
    expect(creditLines[1]?.body).toBe("Se cancelar, o sinal vira crédito para outro horário em Barbearia do Zé, válido por 60 dias.");
    expect(creditLines[2]?.body).toBe("O sinal vira crédito para outro horário, válido por 60 dias.");

    const noShowRefund = policyDetails(policy({ refundUntilHours: null, rescheduleUntilHours: null, lateCancel: "retain", noShow: "refund" }), {
      businessName: "Barbearia do Zé",
      contactWhatsapp: null,
    });
    expect(noShowRefund.find((line) => line.title === "Se faltar")?.body).toBe("Barbearia do Zé pode devolver o sinal.");

    const twice = policyDetails({ ...PADRAO_DEPOSIT_POLICY, maxReschedules: 2 } as unknown as DepositPolicy, { ...context, contactWhatsapp: null });
    expect(twice[0]?.body).toContain("(2 vezes)");

    expect(policyIcsText(PADRAO_DEPOSIT_POLICY, { businessName: "Barbearia do Zé", depositCents: 2000, startsAt, now })).toBe(
      "Barbearia do Zé pode devolver o sinal até qua, 07 out, às 11:30.",
    );

    for (const lines of [withWhatsapp, withoutWhatsapp, creditLines]) {
      const blob = lines.map((line) => `${line.title} ${line.body}`).join(" ");
      expect(blob).not.toMatch(/painel|AgendaPix|Devolver pelo/i);
      expect(blob.toLowerCase()).not.toContain("repass");
      expect(blob).not.toMatch(/(?:^|\s)(?:o|a|do|da|no|na|pelo|pela)\s+Barbearia do Zé/);
    }
    const receipt = policyIcsText(PADRAO_DEPOSIT_POLICY, { businessName: "Barbearia do Zé", depositCents: 2000, startsAt, now });
    expect(receipt).not.toMatch(/painel|AgendaPix/);
  });

  it("nenhuma saída do cliente cita o painel nem Devolver pelo AgendaPix", () => {
    const startsAt = new Date("2026-10-08T14:30:00.000Z");
    const now = new Date("2026-10-01T15:00:00.000Z");
    const forbidden = /painel|Devolver pelo AgendaPix|pelo AgendaPix/;
    for (const refundUntilHours of HOURS) {
      for (const rescheduleUntilHours of HOURS) {
        for (const lateCancel of LATE) {
          for (const noShow of NO_SHOW) {
            const current = policy({ refundUntilHours, rescheduleUntilHours, lateCancel, noShow });
            for (const contactWhatsapp of ["+5511999999999", null]) {
              const summary = policySummary(current, { depositCents: 2000, businessName: "Barbearia do Zé", startsAt, now });
              const details = policyDetails(current, { businessName: "Barbearia do Zé", contactWhatsapp, startsAt, now, timezone: "America/Sao_Paulo" });
              const ics = policyIcsText(current, { businessName: "Barbearia do Zé", depositCents: 2000, startsAt, now, timezone: "America/Sao_Paulo" });
              const stored = clientPolicyText(current, { businessName: "Barbearia do Zé", depositCents: 2000, contactWhatsapp, startsAt, now, timezone: "America/Sao_Paulo" });
              const blob = [summary, ics, stored, ...details.map((line) => `${line.title} ${line.body}`)].join("\n");
              expect(blob).not.toMatch(forbidden);
            }
          }
        }
      }
    }
    const stored = clientPolicyText(PADRAO_DEPOSIT_POLICY, {
      businessName: "Barbearia do Zé",
      depositCents: 2000,
      contactWhatsapp: "+5511999999999",
      startsAt,
      now,
      timezone: "America/Sao_Paulo",
    });
    expect(stored.startsWith("Barbearia do Zé pode devolver o sinal até qua, 07 out, às 11:30.")).toBe(true);
    expect(stored).not.toBe(ownerPreview(PADRAO_DEPOSIT_POLICY, { businessName: "Barbearia do Zé", depositCents: 2000 }));
  });

  it("reserva dentro e fora do prazo de devolução", () => {
    const startsAt = new Date("2026-10-09T14:30:00.000Z");
    const bookedInside = new Date("2026-10-08T22:00:00.000Z");
    const bookedOutside = new Date(startsAt.getTime() - 48 * 3_600_000);
    const deadline = "qui, 08 out";
    const dated = /até\s+(dom|seg|ter|qua|qui|sex|sáb)|Até\s+(dom|seg|ter|qua|qui|sex|sáb)/;
    const base = { businessName: "Barbearia do Zé", timezone: "America/Sao_Paulo" as const, startsAt };

    expect(refundWindowClosedAtBooking(PADRAO_DEPOSIT_POLICY, startsAt, bookedInside)).toBe(true);
    expect(refundWindowClosedAtBooking(creditPolicy(), startsAt, bookedOutside)).toBe(false);

    const insideRetain = "Faltam menos de 24 h para o horário: se cancelar, o sinal não é devolvido.";
    const insideCredit = `Faltam menos de 24 h para o horário: se cancelar, o sinal vira ${CREDIT_PHRASE}.`;
    expect(policySummary(PADRAO_DEPOSIT_POLICY, { depositCents: 2000, ...base, bookedAt: bookedInside })).toBe(insideRetain);
    expect(policySummary(creditPolicy(), { depositCents: 2000, ...base, bookedAt: bookedInside })).toBe(insideCredit);
    expect(policyIcsText(PADRAO_DEPOSIT_POLICY, { ...base, depositCents: 2000, bookedAt: bookedInside })).toBe("Este sinal não é devolvido se cancelar.");
    expect(policyIcsText(creditPolicy(), { ...base, depositCents: 2000, bookedAt: bookedInside })).toBe(`Se cancelar, o sinal vira ${CREDIT_PHRASE}.`);

    for (const current of [PADRAO_DEPOSIT_POLICY, creditPolicy()]) {
      const context = { ...base, contactWhatsapp: "+5511999999999" as string | null, bookedAt: bookedInside };
      const details = policyDetails(current, context);
      const summary = policySummary(current, { depositCents: 2000, ...base, bookedAt: bookedInside });
      const ics = policyIcsText(current, { ...base, depositCents: 2000, bookedAt: bookedInside });
      const stored = clientPolicyText(current, { ...context, depositCents: 2000 });
      expect(details[0]?.tone).toBe("warn");
      expect(details[0]?.title).not.toMatch(/^Até /);
      expect(details.find((line) => line.title === "Se faltar")?.body).toBe(
        current.noShow === "credit" ? `O sinal vira ${CREDIT_PHRASE}.` : "O sinal fica com Barbearia do Zé.",
      );
      const blob = [summary, ics, stored, ...details.flatMap((line) => [line.title, line.body])].join("\n");
      expect(blob).not.toMatch(dated);
      expect(blob).not.toContain(deadline);
      expect(blob).not.toContain("pode devolver o sinal até");
    }

    const openContext = { ...base, contactWhatsapp: null, bookedAt: bookedOutside };
    const openDetails = policyDetails(PADRAO_DEPOSIT_POLICY, openContext);
    expect(openDetails[0]?.title).toBe(`Até ${deadline}, 11:30`);
    expect(openDetails[0]?.body).toBe("Cancele e Barbearia do Zé pode devolver o sinal, ou remarque usando o sinal (1 vez).");
    expect(policyIcsText(PADRAO_DEPOSIT_POLICY, { ...base, depositCents: 2000, bookedAt: bookedOutside })).toBe(
      `Barbearia do Zé pode devolver o sinal até ${deadline}, às 11:30.`,
    );
    expect(policySummary(PADRAO_DEPOSIT_POLICY, { depositCents: 2000, ...base, bookedAt: bookedOutside })).toBe(
      "Com 24 h de antecedência, Barbearia do Zé pode devolver o sinal. Mais perto da hora, o sinal fica com Barbearia do Zé.",
    );
    expect(clientPolicyText(creditPolicy(), { ...openContext, depositCents: 2000, contactWhatsapp: "+5511999999999" })).toContain(
      `Se cancelar, o sinal vira crédito para outro horário em Barbearia do Zé, válido por 60 dias.`,
    );
  });
});

function creditPolicy(): DepositPolicy {
  return { ...PADRAO_DEPOSIT_POLICY, preset: "personalizada", lateCancel: "credit", noShow: "credit" };
}
