import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatPolicyWindowTitle,
  mirrorCustomerPolicy,
  closedWindowLine,
  closedWindowReceipt,
  paymentLateWindowNotice,
  confirmationCardTone,
  confirmationPolicyText,
  policyHowToChange,
  policyLateCancelDetail,
  policyNoShowCredit,
  policyNoShowRefund,
  policyOneLiner,
  policyLateBookingNotice,
  policyReceiptRefund,
  policyWindowBody,
  receiptRefundCopy,
  refundWindowClosedAtBooking,
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
  it("não citam painel nem Devolver pelo AgendaPix, e só o comprovante lê policy.text", () => {
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
      if (file !== "components/booking/BookingConfirmation.tsx" && file !== "components/booking/BookingFlow.tsx") {
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

describe("linha acima do Pix dentro do prazo", () => {
  const startsAt = "2026-10-09T14:30:00.000Z";
  const inside = new Date("2026-10-08T21:54:00.000Z");

  it("usa o prazo em horas da política nas duas frases", () => {
    expect(paymentLateWindowNotice({
      refundUntilHours: 24,
      lateCancel: "retain",
      startsAt,
      now: inside,
    })).toBe("Faltam menos de 24 h para o horário: se cancelar, o sinal não é devolvido.");
    expect(paymentLateWindowNotice({
      refundUntilHours: 24,
      lateCancel: "credit",
      startsAt,
      now: inside,
    })).toBe("Faltam menos de 24 h para o horário: se cancelar, o sinal vira crédito para outro horário, válido por 60 dias.");
    expect(paymentLateWindowNotice({
      refundUntilHours: 12,
      lateCancel: "retain",
      startsAt,
      now: new Date("2026-10-09T08:00:00.000Z"),
    })).toBe("Faltam menos de 12 h para o horário: se cancelar, o sinal não é devolvido.");
  });

  it("não aparece fora da janela nem sem o prazo em horas", () => {
    expect(paymentLateWindowNotice({
      refundUntilHours: 24,
      lateCancel: "retain",
      startsAt,
      now: new Date("2026-10-08T10:00:00.000Z"),
    })).toBeNull();
    expect(paymentLateWindowNotice({
      lateCancel: "credit",
      startsAt,
      now: inside,
    })).toBeNull();
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

describe("policy.text do comprovante", () => {
  const now = new Date("2026-10-08T21:54:00.000Z");
  const pastDeadline = "2026-10-08T14:30:00.000Z";
  const futureDeadline = "2026-10-10T14:30:00.000Z";
  const dated = "Studio Bella pode devolver o sinal até sábado, 10 de outubro, às 11:30.";

  it("mostra policy.text como chegou, inclusive com data no passado", () => {
    const incoming = "Studio Bella pode devolver o sinal até qui, 08 out, às 11:30. Cancele e Studio Bella pode devolver o sinal.";
    expect(confirmationPolicyText(incoming, dated)).toBe(incoming);
    expect(confirmationPolicyText("Este sinal não é devolvido se cancelar.", dated)).toBe("Este sinal não é devolvido se cancelar.");
  });

  it("usa a data futura só quando policy.text não veio", () => {
    expect(confirmationPolicyText(null, dated)).toBe(dated);
    expect(confirmationPolicyText("  ", dated)).toBe(dated);
    expect(confirmationPolicyText(undefined, null)).toBeNull();
  });

  it("não inventa frase de aviso nem a variante de crédito quando o prazo já passou", () => {
    expect(receiptRefundCopy({
      businessName: "Studio Bella",
      refundDeadlineAt: pastDeadline,
      dateLabel: "quinta-feira, 08 de outubro",
      timeLabel: "11:30",
      now,
    })).toBeNull();
    expect(receiptRefundCopy({
      businessName: "Studio Bella",
      refundDeadlineAt: futureDeadline,
      dateLabel: "sábado, 10 de outubro",
      timeLabel: "11:30",
      now,
    })).toBe(dated);
  });

  it("pinta o cartão em âmbar só com a flag, que nasce desligada", () => {
    expect(confirmationCardTone()).toBe("ok");
    expect(confirmationCardTone(false)).toBe("ok");
    expect(confirmationCardTone(true)).toBe("warn");
    const confirmation = readFileSync("components/booking/BookingConfirmation.tsx", "utf8");
    expect(confirmation).toContain("refundWindowClosedAtBooking");
    expect(confirmation).toContain("TriangleAlert");
    expect(confirmation).toContain('aria-hidden="true"');
    expect(confirmation).not.toContain("lateBooking");
    expect(confirmation).not.toContain("Este sinal não é devolvido se cancelar.");
    expect(confirmation).not.toContain("vira crédito");
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
      refundDeadlineAt: view.refundDeadlineAt,
      dateLabel: "sábado, 10 de outubro",
      timeLabel: "11:30",
      now,
    });
    expect(receipt).toBe("Studio Bella pode devolver o sinal até sábado, 10 de outubro, às 11:30.");
    expect(policyLineTone({ refundUntilHours: 24 }, startsAt.toISOString(), now.getTime())).toBe("ok");
  });

  it("com o horário amanhã avisa em âmbar e esconde a data que já passou", () => {
    const now = new Date("2026-10-08T21:54:00.000Z");
    const startsAt = new Date("2026-10-09T14:30:00.000Z");
    const view = mirrorCustomerPolicy({ businessName: name, hours: 24, startsAt, now });
    expect(view.tone).toBe("warn");
    expect(view.summary).toBe("Faltam menos de 24 h para o horário: se cancelar, o sinal não é devolvido.");
    expect(view.details[0]).toEqual({
      title: "Perto do horário",
      body: "Faltam menos de 24 h para o horário: se cancelar, o sinal não é devolvido.",
      tone: "warn",
    });
    expect(view.summary).not.toMatch(/pode devolver o sinal até/);
    expect(closedWindowReceipt({ lateCancel: "retain" })).toBe("Este sinal não é devolvido se cancelar.");
    expect(refundWindowClosedAtBooking({ refundUntilHours: 24 }, startsAt, now)).toBe(true);

    const receipt = receiptRefundCopy({
      businessName: name,
      refundDeadlineAt: view.refundDeadlineAt,
      dateLabel: "quinta-feira, 08 de outubro",
      timeLabel: "11:30",
      now,
    });
    expect(receipt).toBeNull();
    expect(policyLineTone({ refundUntilHours: 24 }, startsAt.toISOString(), now.getTime())).toBe("warn");

    const preview = readFileSync("components/preview/PreviewBookingFlow.tsx", "utf8");
    const flow = readFileSync("components/booking/BookingFlow.tsx", "utf8");
    expect(preview).toContain("lines={selectedService.policyDetails}");
    expect(flow).toContain("lines={selectedService.policyDetails}");
    expect(preview).not.toContain("policyLinesForCustomer");
    expect(preview).toContain("refundWindowClosedAtBooking: true");
    expect(preview).toContain("closedWindowReceipt({ lateCancel })");
    expect(preview).toContain('lateCancel: "credit"');
    expect(preview).toContain('id: "credito"');
    expect(preview).not.toContain("lateBooking");
    expect(flow).toContain("refundWindowClosedAtBooking={bookingResponse?.policy?.refundWindowClosedAtBooking}");
  });

  it("espelha as duas frases de crédito da janela fechada e usa bookedAt como referência", () => {
    const now = new Date("2026-10-08T15:00:00.000Z");
    const startsAt = new Date("2026-10-11T14:30:00.000Z");
    const bookedAt = new Date("2026-10-10T20:00:00.000Z");
    expect(refundWindowClosedAtBooking({ refundUntilHours: 24 }, startsAt, now)).toBe(false);
    expect(refundWindowClosedAtBooking({ refundUntilHours: 24 }, startsAt, bookedAt)).toBe(true);

    const open = mirrorCustomerPolicy({ businessName: name, hours: 24, startsAt, now });
    expect(open.tone).toBe("ok");
    expect(open.details[0]?.title).toBe("Até sáb, 10 out, 11:30");

    const closed = mirrorCustomerPolicy({ businessName: name, hours: 24, startsAt, now, bookedAt, late: "credit" });
    expect(closed.summary).toBe(closedWindowLine({ refundUntilHours: 24, lateCancel: "credit" }));
    expect(closed.summary).toBe("Faltam menos de 24 h para o horário: se cancelar, o sinal vira crédito para outro horário, válido por 60 dias.");
    expect(closed.details[0]).toEqual({ title: "Perto do horário", body: closed.summary, tone: "warn" });
    expect(closedWindowReceipt({ lateCancel: "credit" })).toBe("Se cancelar, o sinal vira crédito para outro horário, válido por 60 dias.");
    expect(closed.summary).not.toMatch(/pode devolver o sinal até/);
    expect(closedWindowReceipt({ lateCancel: "credit" })).not.toMatch(/pode devolver o sinal até/);
  });
});
