import { describe, expect, it } from "vitest";
import { expiredPixBody, latePaymentChoice } from "../../components/booking/pix-deadline-copy";
import { parsePaymentStatusResponse, paymentStatusResponseSchema } from "../../lib/public/payment-status";

const base = {
  bookingId: "11111111-1111-4111-8111-111111111111",
  status: "pending_payment",
  startsAt: "2030-01-02T15:00:00.000Z",
  endsAt: "2030-01-02T15:30:00.000Z",
  expiresAt: "2030-01-02T15:10:00.000Z",
  payment: {
    id: "22222222-2222-4222-8222-222222222222",
    provider: "mercadopago",
    externalId: "pay-1",
    amountCents: 2000,
    status: "pending",
    expiresAt: "2030-01-02T15:10:00.000Z",
    qrCodeDataUrl: "data:image/png;base64,abc",
    copyPaste: "000201",
  },
  policy: {
    text: "Pode cancelar até 24 h antes.",
    snapshot: { preset: "padrao" },
    refundDeadlineAt: null,
    rescheduleDeadlineAt: null,
  },
};

describe("schema do status do Pix", () => {
  it("aceita o corpo 200 e trata policy null como política desconhecida", () => {
    const parsed = parsePaymentStatusResponse(base);
    expect(parsed.payment?.copyPaste).toBe("000201");
    expect(latePaymentChoice(parsed.policy)).toBeNull();
    expect(expiredPixBody(latePaymentChoice(parsed.policy))).toContain("não puder ser mantido");
    const withoutPolicy = parsePaymentStatusResponse({ ...base, policy: null, payment: { ...base.payment, qrCodeDataUrl: null, copyPaste: null, status: "expired" } });
    expect(withoutPolicy.policy).toBeNull();
    expect(expiredPixBody(latePaymentChoice(withoutPolicy.policy))).toContain("não puder ser mantido");
  });

  it("usa a política quando o payload já traz latePaymentPolicy", () => {
    const refund = parsePaymentStatusResponse({ ...base, policy: { ...base.policy, latePaymentPolicy: "refund" } });
    const rebook = parsePaymentStatusResponse({ ...base, policy: { latePaymentPolicy: "rebook_if_free" } });
    expect(expiredPixBody(latePaymentChoice(refund.policy))).toContain("Como o prazo terminou");
    expect(expiredPixBody(latePaymentChoice(rebook.policy))).toContain("horário continuar livre");
    expect(paymentStatusResponseSchema.safeParse({ ...base, status: "nope" }).success).toBe(false);
  });

  it("lê o erro rate_limited sem confundir com timeout do gateway", () => {
    const pending = parsePaymentStatusResponse({ ...base, payment: { ...base.payment, status: "pending" } });
    expect(pending.status).toBe("pending_payment");
    expect(pending.payment?.status).toBe("pending");
  });
});
