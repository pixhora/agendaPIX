import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatPolicyWindowTitle,
  mirrorCustomerPolicy,
  policyHowToChange,
  policyLateCancelDetail,
  policyLinesForCustomer,
  confirmationPolicyCopy,
  policyNoShowCredit,
  policyNoShowRefund,
  policyOneLiner,
  policyLateBookingNotice,
  policyReceiptRefund,
  policyWindowBody,
  receiptRefundCopy,
} from "../../components/booking/policy-copy";
import { policyLineTone, readPolicyChangedUpdate } from "../../components/booking/policy-gate";
import { serviceCardAside, serviceCardMeta } from "../../components/booking/service-card";
import { isPreviewBadgeEnabled } from "../../components/preview/preview-badge-gate";
import { previewLateSlot, previewOpeningSlot, previewPayDeadline } from "../../lib/preview/preview-schedule";
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
      policyLateBookingNotice(24),
      MOCK_SERVICES[0]?.policySummary ?? "",
      ...(MOCK_SERVICES[0]?.policyDetails ?? []).map((line) => `${line.title} ${line.body}`),
    ];
    for (const line of customerLines) {
      expect(line).not.toMatch(/\bpainel\b|Devolver pelo AgendaPix/);
      expect(line).not.toContain(OWNER_POLICY_TEXT);
    }

    for (const file of CUSTOMER_SCREEN_FILES) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\bpainel\b|Devolver pelo AgendaPix/);
      if (file !== "components/booking/BookingConfirmation.tsx") {
        expect(source, file).not.toMatch(/policy\.text|\bpolicyText\b/);
      }
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

describe("frases de crédito", () => {
  it("espelha as três frases da spec 06", () => {
    expect(policyOneLiner(business, 24, "credit")).toBe(
      "Com 24 h de antecedência, Barbearia do Zé pode devolver o sinal. Mais perto da hora, o sinal vira crédito para outro horário, válido por 60 dias.",
    );
    expect(policyLateCancelDetail(business, "credit")).toBe(
      "Se cancelar, o sinal vira crédito para outro horário em Barbearia do Zé, válido por 60 dias.",
    );
    expect(policyNoShowCredit()).toBe("O sinal vira crédito para outro horário, válido por 60 dias.");
    const credit = mirrorCustomerPolicy({
      businessName: business,
      hours: 24,
      startsAt: new Date("2026-10-11T14:30:00.000Z"),
      now: new Date("2026-10-08T15:00:00.000Z"),
      late: "credit",
      noShow: "credit",
    });
    expect(credit.details.find((line) => line.title === "Se faltar")?.body).toBe(policyNoShowCredit());
  });
});

describe("policy.text do cliente", () => {
  const now = new Date("2026-10-08T21:54:00.000Z");
  const pastDeadline = "2026-10-08T14:30:00.000Z";
  const futureDeadline = "2026-10-10T14:30:00.000Z";

  it("mostra o texto do cliente quando o prazo ainda está aberto", () => {
    const copy = confirmationPolicyCopy({
      policyText: "Studio Bella pode devolver o sinal até sáb, 10 out, às 11:30. Cancele e Studio Bella pode devolver o sinal, ou remarque usando o sinal (1 vez).",
      businessName: "Studio Bella",
      hours: 24,
      refundDeadlineAt: futureDeadline,
      dateLabel: "sábado, 10 de outubro",
      timeLabel: "11:30",
      now,
    });
    expect(copy.tone).toBe("ok");
    expect(copy.text).toMatch(/^Studio Bella pode devolver o sinal até sáb, 10 out/);
  });

  it("troca a data vencida que ainda vem em policy.text pelo aviso âmbar", () => {
    const copy = confirmationPolicyCopy({
      policyText: "Studio Bella pode devolver o sinal até qui, 08 out, às 11:30. Cancele e Studio Bella pode devolver o sinal.",
      businessName: "Studio Bella",
      hours: 24,
      refundDeadlineAt: pastDeadline,
      dateLabel: "quinta-feira, 08 de outubro",
      timeLabel: "11:30",
      now,
    });
    expect(copy).toEqual({
      tone: "warn",
      text: "Faltam menos de 24 h para o horário: se cancelar, o sinal não é devolvido.",
    });
  });

  it("não exibe a prévia do dono se ela ainda vier no campo", () => {
    const copy = confirmationPolicyCopy({
      policyText: OWNER_POLICY_TEXT,
      businessName: "Studio Bella",
      hours: 24,
      refundDeadlineAt: futureDeadline,
      dateLabel: "sábado, 10 de outubro",
      timeLabel: "11:30",
      now,
    });
    expect(copy.text).toBe("Studio Bella pode devolver o sinal até sábado, 10 de outubro, às 11:30.");
    expect(copy.text).not.toMatch(/\bpainel\b|Devolver pelo AgendaPix/);
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
  it("marca o horário para daqui a 3 dias e o prazo de pagamento antes dele", () => {
    const now = new Date("2026-10-08T21:54:00.000Z");
    const slot = previewOpeningSlot(now);
    expect(slot).not.toBeNull();
    const startsAt = new Date(slot!.startsAt);
    expect(startsAt.getTime()).toBeGreaterThan(now.getTime());
    expect(startsAt.toISOString()).toBe("2026-10-11T14:30:00.000Z");

    const payBy = previewPayDeadline("pix", now);
    expect(payBy.toISOString()).toBe("2026-10-08T22:24:00.000Z");
    expect(payBy.getTime()).toBeLessThan(startsAt.getTime());

    const close = previewPayDeadline("pix-perto", now);
    expect(close.getTime() - now.getTime()).toBe(4 * 60 * 1000);
    expect(close.getTime()).toBeLessThan(startsAt.getTime());

    expect(previewLateSlot(now)?.startsAt).toBe("2026-10-09T14:30:00.000Z");
  });
});

describe("reserva dentro e fora do prazo de devolução", () => {
  const name = "Studio Bella";

  it("com o horário em 3 dias mostra a data futura e o tom ok", () => {
    const now = new Date("2026-10-08T15:00:00.000Z");
    const startsAt = new Date("2026-10-11T14:30:00.000Z");
    const view = mirrorCustomerPolicy({ businessName: name, hours: 24, startsAt, now });
    expect(view.tone).toBe("ok");
    expect(view.summary).toBe("Com 24 h de antecedência, Studio Bella pode devolver o sinal. Mais perto da hora, o sinal fica com Studio Bella.");
    expect(view.details[0]).toEqual({
      title: "Até sáb, 10 out, 11:30",
      body: "Cancele e Studio Bella pode devolver o sinal, ou remarque usando o sinal (1 vez).",
      tone: "ok",
    });
    const receipt = receiptRefundCopy({
      businessName: name,
      hours: 24,
      refundDeadlineAt: view.refundDeadlineAt,
      dateLabel: "sábado, 10 de outubro",
      timeLabel: "11:30",
      now,
    });
    expect(receipt).toEqual({ tone: "ok", text: "Studio Bella pode devolver o sinal até sábado, 10 de outubro, às 11:30." });
    expect(policyLineTone({ refundUntilHours: 24 }, startsAt.toISOString(), now.getTime())).toBe("ok");
  });

  it("com o horário amanhã avisa em âmbar e esconde a data que já passou", () => {
    const now = new Date("2026-10-08T21:54:00.000Z");
    const startsAt = new Date("2026-10-09T14:30:00.000Z");
    const view = mirrorCustomerPolicy({ businessName: name, hours: 24, startsAt, now });
    expect(view.tone).toBe("warn");
    expect(view.summary).toBe("Faltam menos de 24 h para o horário: se cancelar, o sinal não é devolvido.");
    expect(view.details[0]?.tone).toBe("warn");
    expect(`${view.details[0]?.title}: ${view.details[0]?.body.charAt(0).toLowerCase()}${view.details[0]?.body.slice(1)}`).toBe(view.summary);
    expect(view.details.map((line) => line.title).join(" ")).not.toMatch(/^Até | Até /);

    const receipt = receiptRefundCopy({
      businessName: name,
      hours: 24,
      refundDeadlineAt: view.refundDeadlineAt,
      dateLabel: "quinta-feira, 08 de outubro",
      timeLabel: "11:30",
      now,
    });
    expect(receipt.tone).toBe("warn");
    expect(receipt.text).toBe(view.summary);
    expect(receipt.text).not.toMatch(/pode devolver o sinal até/);

    const shown = policyLinesForCustomer(
      [{ title: "Até qui, 08 out, 11:30", body: "Cancele e Studio Bella pode devolver o sinal, ou remarque usando o sinal (1 vez).", tone: "warn" }, view.details[1]!],
      true,
      24,
    );
    expect(shown.map((line) => line.title)).not.toContain("Até qui, 08 out, 11:30");
    expect(shown[0]?.tone).toBe("warn");
    expect(policyLineTone({ refundUntilHours: 24 }, startsAt.toISOString(), now.getTime())).toBe("warn");
  });
});
