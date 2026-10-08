import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatPolicyWindowTitle,
  policyHowToChange,
  policyLateCancelDetail,
  policyNoShowRefund,
  policyOneLiner,
  policyReceiptRefund,
  policyWindowBody,
} from "../../components/booking/policy-copy";
import { readPolicyChangedUpdate } from "../../components/booking/policy-gate";
import { serviceCardAside, serviceCardMeta } from "../../components/booking/service-card";
import { isPreviewBadgeEnabled } from "../../components/preview/preview-badge-gate";
import { previewOpeningSlot, previewPayDeadline } from "../../lib/preview/preview-schedule";
import { MOCK_SERVICES } from "../../lib/preview/mock-data";

const business = "Barbearia do Zé";

describe("texto da política para o cliente", () => {
  it("não põe artigo antes do nome e não cita painel nem Devolver pelo AgendaPix", () => {
    const lines = [
      policyOneLiner(business, 24, "keep"),
      policyOneLiner(business, 24, "credit"),
      policyWindowBody(business),
      policyNoShowRefund(business),
      policyHowToChange(business, true),
      policyHowToChange(business, false),
      policyReceiptRefund(business, "quarta-feira, 07 de outubro", "11:30"),
    ];
    expect(lines[0]).toBe("Com 24 h de antecedência, Barbearia do Zé pode devolver o sinal. Mais perto da hora, o sinal fica com Barbearia do Zé.");
    expect(lines[1]).toContain("Mais perto da hora, o sinal vira crédito para outro horário, válido por 60 dias.");
    expect(policyLateCancelDetail(business, "keep")).toBe("Se cancelar, o sinal fica com Barbearia do Zé.");
    expect(policyLateCancelDetail(business, "credit")).toBe("Se cancelar, o sinal vira crédito para outro horário em Barbearia do Zé, válido por 60 dias.");
    expect(lines[2]).toBe("Cancele e Barbearia do Zé pode devolver o sinal, ou remarque usando o sinal (1 vez).");
    expect(lines[3]).toBe("Barbearia do Zé pode devolver o sinal.");
    expect(lines[4]).toBe("Fale com Barbearia do Zé pelo WhatsApp. A devolução não é automática: quem devolve é Barbearia do Zé, da conta Mercado Pago do negócio, depois de confirmar o cancelamento.");
    expect(lines[5]).toMatch(/^Fale com Barbearia do Zé pelos canais de sempre\. A devolução não é automática:/);
    expect(lines[6]).toBe("Barbearia do Zé pode devolver o sinal até quarta-feira, 07 de outubro, às 11:30.");
    for (const line of lines) {
      expect(line).not.toMatch(/\b[Oo] Barbearia|\bcom o Barbearia|\bpainel\b|Devolver pelo AgendaPix/);
    }
  });

  it("formata o título curto da janela", () => {
    expect(formatPolicyWindowTitle(new Date("2026-10-07T14:30:00.000Z"))).toBe("Até qua, 07 out, 11:30");
  });
});

const OWNER_POLICY_TEXT = "O dono confirma no painel, em Devolver pelo AgendaPix.";

const CUSTOMER_SCREEN_FILES = [
  "components/booking/BookingConfirmation.tsx",
  "components/booking/BookingFlow.tsx",
  "components/booking/PausedState.tsx",
  "components/booking/StepCustomer.tsx",
  "components/booking/StepPayment.tsx",
  "components/booking/StepService.tsx",
  "components/booking/UnbookableNotice.tsx",
  "components/policy/PolicySheet.tsx",
  "components/policy/PolicySummaryLine.tsx",
];

describe("telas do cliente", () => {
  it("não renderizam policy.text nem citam painel ou Devolver pelo AgendaPix", () => {
    const customerLines = [
      policyOneLiner(business, 24, "keep"),
      policyOneLiner(business, 24, "credit"),
      policyWindowBody(business),
      policyLateCancelDetail(business, "keep"),
      policyLateCancelDetail(business, "credit"),
      policyNoShowRefund(business),
      policyHowToChange(business, true),
      policyHowToChange(business, false),
      policyReceiptRefund(business, "sexta-feira, 09 de outubro", "11:30"),
      MOCK_SERVICES[0]?.policySummary ?? "",
      ...(MOCK_SERVICES[0]?.policyDetails ?? []).map((line) => `${line.title} ${line.body}`),
    ];
    for (const line of customerLines) {
      expect(line).not.toMatch(/\bpainel\b|Devolver pelo AgendaPix/);
      expect(line).not.toContain(OWNER_POLICY_TEXT);
    }

    for (const file of CUSTOMER_SCREEN_FILES) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/policy\.text/);
      expect(source, file).not.toMatch(/\bpolicyText\b/);
      expect(source, file).not.toMatch(/\bpainel\b|Devolver pelo AgendaPix/);
    }
  });

  it("não promove policy.text do payload para o resumo do cliente", () => {
    const update = readPolicyChangedUpdate({
      error: {
        code: "policy_changed",
        policy: { text: OWNER_POLICY_TEXT, policyHash: "hash-novo" },
      },
    });
    expect(update?.policySummary).toBeNull();
    expect(update?.policyHash).toBe("hash-novo");
    expect(`${update?.policySummary ?? ""}`).not.toMatch(/\bpainel\b|Devolver pelo AgendaPix/);
  });
});

describe("card de serviço sem sinal", () => {
  it("mostra duração e preço na meta e só Sem sinal à direita", () => {
    const service = { durationMinutes: 20, priceCents: 3000, depositCents: 0 };
    expect(serviceCardMeta(service)).toMatch(/^20 min · R\$\s*30,00$/);
    expect(serviceCardAside(service)).toBe("Sem sinal");
    expect(`${serviceCardMeta(service)} ${serviceCardAside(service)}`).not.toMatch(/R\$\s*0,00/);
  });

  it("não renderiza R$ 0,00 quando o preço também é zero", () => {
    const service = { durationMinutes: 20, priceCents: 0, depositCents: 0 };
    expect(serviceCardMeta(service)).toBe("20 min");
    expect(serviceCardAside(service)).toBe("Sem sinal");
    expect(`${serviceCardMeta(service)} ${serviceCardAside(service)}`).not.toMatch(/R\$\s*0,00/);
  });
});

describe("selo de preview", () => {
  it("não aparece em produção", () => {
    expect(isPreviewBadgeEnabled("production")).toBe(false);
    expect(isPreviewBadgeEnabled("development")).toBe(true);
  });
});

describe("datas do preview", () => {
  it("marca o horário para amanhã e o prazo de pagamento antes dele", () => {
    const now = new Date("2026-10-08T21:54:00.000Z");
    const slot = previewOpeningSlot(now);
    expect(slot).not.toBeNull();
    const startsAt = new Date(slot!.startsAt);
    expect(startsAt.getTime()).toBeGreaterThan(now.getTime());
    expect(startsAt.toISOString()).toBe("2026-10-09T14:30:00.000Z");

    const payBy = previewPayDeadline("pix", now);
    expect(payBy.toISOString()).toBe("2026-10-08T22:24:00.000Z");
    expect(payBy.getTime()).toBeLessThan(startsAt.getTime());

    const close = previewPayDeadline("pix-perto", now);
    expect(close.getTime() - now.getTime()).toBe(4 * 60 * 1000);
    expect(close.getTime()).toBeLessThan(startsAt.getTime());
  });
});
