import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PADRAO_DEPOSIT_POLICY, type DepositPolicy } from "../../lib/policy/schema";
import { ownerPreview, policyDetails, policyIcsText, policyListLabel, policySummary } from "../../lib/policy/text";

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
    expect(policySummary(PADRAO_DEPOSIT_POLICY, { depositCents: 2000 })).toBe("Se cancelar até 24 h antes, o negócio faz a devolução conforme a política.");
    expect(policySummary(PADRAO_DEPOSIT_POLICY, { depositCents: 0 })).toBe("Sem sinal.");
    const startsAt = new Date("2030-01-02T15:00:00.000Z");
    expect(policySummary(PADRAO_DEPOSIT_POLICY, { depositCents: 2000, startsAt, now: new Date("2030-01-02T12:00:00.000Z") }))
      .toBe("Faltam menos de 24 h para o horário: se cancelar, o sinal não é devolvido.");
    expect(policyListLabel(PADRAO_DEPOSIT_POLICY, 2000)).toBe("Até 24 h, conforme a política");
    expect(policyListLabel(PADRAO_DEPOSIT_POLICY, 0)).toBe("Sem sinal");
  });

  it("diz que o negócio devolve pelo AgendaPix, sem prometer devolução automática", () => {
    const lines = policyDetails(PADRAO_DEPOSIT_POLICY, { businessName: "Studio Bella", contactWhatsapp: "+5511999999999" });
    const body = lines.map((line) => line.body).join(" ");
    expect(body).toContain("Studio Bella devolve pelo AgendaPix, conforme a política, se confirmar no painel");
    expect(body).toContain("A devolução não é automática: Studio Bella confirma no painel, em Devolver pelo AgendaPix, e o valor sai da conta Mercado Pago dele.");
    expect(body.toLowerCase()).not.toContain("repass");
    expect(body).not.toMatch(/receba o sinal|sinal devolvido/i);
    expect(policyIcsText(PADRAO_DEPOSIT_POLICY, { businessName: "Studio Bella", depositCents: 2000 })).toContain("pelo AgendaPix");
  });
});
