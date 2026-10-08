import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http";
import {
  executeOwnerRefund,
  markRefundedByExternalId,
  notifyDisconnectedConfirmation,
  recordUnverifiableSellerPayment,
  settleAutomaticLateRefund,
  previewOwnerRefund,
  type RefundPorts,
  type RefundView,
  type RefundWriter,
} from "../../lib/payments/refund-flow";
import { assessRefund } from "../../lib/payments/refund-eligibility";
import {
  disconnectedConfirmedNotice,
  lateRefundFailedNotice,
  lateRefundedNotice,
  unverifiableSellerNotice,
} from "../../lib/payments/notices";
import {
  MpAccountNotConnectedError,
  resetSellerAccountHooks,
  resolveMpAccessToken,
  setSellerAccountHooks,
} from "../../lib/payments/seller-account";

const now = new Date("2030-06-01T12:00:00.000Z");

function view(overrides: Partial<RefundView> = {}): RefundView {
  return {
    paymentId: "pay-1",
    businessId: "biz-1",
    bookingId: "book-1",
    ownerId: "owner-1",
    ownerEmail: "dono@example.com",
    externalId: "mp-1",
    amountCents: 1500,
    paymentStatus: "paid",
    refundStatus: null,
    refundedAt: null,
    paidAt: new Date("2030-06-01T11:00:00.000Z"),
    customerName: "Ana",
    customerEmail: "ana@example.com",
    serviceName: "Corte",
    startsAt: new Date("2030-06-02T15:00:00.000Z"),
    timezone: "America/Sao_Paulo",
    policyText: null,
    policyHash: null,
    policyRefundDeadlineAt: null,
    ...overrides,
  };
}

function memory(initial: RefundView): RefundPorts & { audits: { action: string; detail: Record<string, unknown> }[]; emails: string[] } {
  let current = { ...initial };
  const audits: { action: string; detail: Record<string, unknown> }[] = [];
  const emails: string[] = [];
  let chain: Promise<unknown> = Promise.resolve();
  const writer = (): RefundWriter => ({
    async setRefund(patch) {
      current = { ...current, refundStatus: patch.refundStatus, refundedAt: patch.refundedAt, paymentStatus: patch.paymentStatus ?? current.paymentStatus };
    },
    async audit(action, detail) { audits.push({ action, detail }); },
    async hasAudit(action) { return audits.some((row) => row.action === action); },
  });
  return {
    audits,
    emails,
    async loadOwned(businessId, bookingId, ownerId) {
      if (current.businessId !== businessId || current.bookingId !== bookingId || current.ownerId !== ownerId) return null;
      return { ...current };
    },
    async loadByPaymentId(paymentId) { return paymentId === current.paymentId ? { ...current } : null; },
    async loadByExternalId(externalId) { return externalId === current.externalId ? { ...current } : null; },
    async withPaymentLock(_paymentId, run) {
      const previous = chain;
      let release: () => void = () => {};
      chain = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try { return await run({ ...current }, writer()); }
      finally { release(); }
    },
    async listLateRefundIds() { return current.refundStatus ? [] : [current.paymentId]; },
    async listInProcessIds() { return current.refundStatus === "in_process" ? [current.paymentId] : []; },
  };
}

const mailerFor = (ports: { emails: string[] }) => async (_to: string, subject: string, text: string) => {
  ports.emails.push(`${subject}\n${text}`);
};

describe("prévia e devolução do dono", () => {
  it("nega quem não é o dono", async () => {
    const ports = memory(view());
    await expect(previewOwnerRefund(ports, "biz-1", "book-1", "outro", now)).rejects.toMatchObject({ status: 404 });
  });

  it("recusa valor diferente, já devolvido, em andamento, janela e falha do gateway", async () => {
    const ports = memory(view());
    const provider = { refundCharge: async () => ({ status: "refunded" as const, refundId: "r-1" }) };
    await expect(executeOwnerRefund(ports, provider, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 999, now }))
      .rejects.toMatchObject({ status: 409, code: "refund_amount_changed" });

    const refunded = memory(view({ refundStatus: "refunded", refundedAt: now, paymentStatus: "refunded" }));
    await expect(executeOwnerRefund(refunded, provider, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now }))
      .rejects.toMatchObject({ status: 409, code: "already_refunded" });

    const running = memory(view({ refundStatus: "in_process" }));
    await expect(executeOwnerRefund(running, provider, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now }))
      .rejects.toMatchObject({ status: 409, code: "refund_in_process" });
    expect(await previewOwnerRefund(running, "biz-1", "book-1", "owner-1", now)).toMatchObject({ eligible: false, reason: "refund_in_process" });

    const expired = memory(view({ paidAt: new Date("2029-01-01T00:00:00.000Z") }));
    await expect(executeOwnerRefund(expired, provider, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now }))
      .rejects.toMatchObject({ status: 409, code: "refund_window_expired" });

    let calls = 0;
    const failing = memory(view());
    const broken = { refundCharge: async () => { calls += 1; throw new Error("collector has insufficient available balance"); } };
    await expect(executeOwnerRefund(failing, broken, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now }))
      .rejects.toMatchObject({ status: 502, code: "refund_failed" });
    await expect(executeOwnerRefund(failing, broken, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now }))
      .rejects.toSatisfy((error: HttpError) => error instanceof HttpError && error.status === 502 && !error.message.includes("insufficient"));
    expect(calls).toBe(2);
    expect(failing.audits.some((row) => row.action === "owner_refund" && row.detail.status === "failed" && String(row.detail.failureCause).includes("insufficient"))).toBe(true);
    expect(failing.audits[0]?.detail.actorUserId).toBe("owner-1");
  });

  it("dois cliques em andamento geram um único estorno", async () => {
    const ports = memory(view());
    let calls = 0;
    const provider = {
      refundCharge: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { status: "in_process" as const, refundId: "r-9" };
      },
    };
    const input = { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now };
    const [first, second] = await Promise.allSettled([
      executeOwnerRefund(ports, provider, input),
      executeOwnerRefund(ports, provider, input),
    ]);
    expect(calls).toBe(1);
    const statuses = [first, second].map((item) => item.status === "fulfilled" ? item.value.status : (item.reason as HttpError).code);
    expect(statuses).toContain("in_process");
    expect(statuses).toContain("refund_in_process");
  });

  it("marca refunded quando o webhook observa o estorno e libera nova tentativa depois de failed", async () => {
    const ports = memory(view({ refundStatus: "in_process" }));
    expect(await markRefundedByExternalId(ports, "mp-1", now)).toBe(true);
    expect(await previewOwnerRefund(ports, "biz-1", "book-1", "owner-1", now)).toMatchObject({ eligible: false, reason: "already_refunded" });
    const failed = memory(view({ refundStatus: "failed" }));
    expect((await previewOwnerRefund(failed, "biz-1", "book-1", "owner-1", now)).eligible).toBe(true);
    expect(assessRefund({ paymentStatus: "pending", refundStatus: null, paidAt: null, now, settlementAvailable: true, policyDeadlineAt: null }).reason).toBe("not_paid");
  });
});

describe("devolução automática só no atraso sem horário", () => {
  it("estorna uma vez, avisa uma vez e não repete", async () => {
    const ports = memory(view());
    let calls = 0;
    const provider = { refundCharge: async () => { calls += 1; return { status: "refunded" as const, refundId: "auto-1" }; } };
    const mailer = mailerFor(ports);
    expect(await settleAutomaticLateRefund(ports, provider, "pay-1", mailer, now)).toBe("submitted");
    expect(await settleAutomaticLateRefund(ports, provider, "pay-1", mailer, now)).toBe("done");
    expect(calls).toBe(1);
    expect(ports.emails).toHaveLength(1);
    expect(ports.emails[0]).toContain("O AgendaPix devolveu o valor automaticamente");
    expect(ports.audits.some((row) => row.detail.actor === "system" && row.detail.reason === "late_no_slot")).toBe(true);
  });

  it("falha do gateway marca failed e pede devolução manual, sem segundo estorno", async () => {
    const ports = memory(view());
    let calls = 0;
    const provider = { refundCharge: async () => { calls += 1; throw new Error("collector has insufficient available balance"); } };
    const mailer = mailerFor(ports);
    expect(await settleAutomaticLateRefund(ports, provider, "pay-1", mailer, now)).toBe("failed_now");
    expect(await settleAutomaticLateRefund(ports, provider, "pay-1", mailer, now)).toBe("failed_already");
    expect(calls).toBe(1);
    expect(ports.emails).toHaveLength(1);
    expect(ports.emails[0]).toContain("Devolver pelo AgendaPix");
    expect(ports.audits.some((row) => row.detail.status === "failed" && String(row.detail.failureCause).includes("insufficient"))).toBe(true);
  });

  it("sem token não estorna, audita e avisa", async () => {
    setSellerAccountHooks({
      getSellerLinkState: async () => "unlinked",
      getSellerAccessTokenForSettlement: async () => null,
    });
    try {
      const ports = memory(view());
      let calls = 0;
      const provider = { refundCharge: async () => { calls += 1; return { status: "refunded" as const, refundId: "nope" }; } };
      const mailer = mailerFor(ports);
      expect(await settleAutomaticLateRefund(ports, provider, "pay-1", mailer, now)).toBe("no_token");
      expect(await settleAutomaticLateRefund(ports, provider, "pay-1", mailer, now)).toBe("no_token_already");
      expect(calls).toBe(0);
      expect(ports.emails).toHaveLength(1);
      expect(ports.audits.some((row) => row.action === "unverifiable_seller_disconnected")).toBe(true);
    } finally {
      resetSellerAccountHooks();
    }
  });

  it("nenhum outro fluxo chama o estorno", () => {
    for (const file of ["lib/payments/webhook.ts", "lib/payments/reconcile.ts", "lib/payments/apply-paid.ts"]) {
      expect(readFileSync(file, "utf8")).not.toContain(".refundCharge(");
    }
    expect(readFileSync("lib/payments/refund-flow.ts", "utf8")).toContain("purpose: \"settlement\"");
  });
});

describe("conta desconectada", () => {
  it("charge falha e settlement usa o token retido; sem token não resolve", async () => {
    const env = { MERCADOPAGO_ACCESS_TOKEN: "TEST-platform-token" };
    setSellerAccountHooks({
      getSellerLinkState: async () => "disconnected",
      getSellerAccessTokenForSettlement: async () => "retained-token",
    });
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "charge" }, env)).rejects.toBeInstanceOf(MpAccountNotConnectedError);
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "settlement" }, env)).resolves.toBe("retained-token");
    setSellerAccountHooks({
      getSellerLinkState: async () => "unlinked",
      getSellerAccessTokenForSettlement: async () => null,
    });
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "settlement" }, env)).rejects.toBeInstanceOf(MpAccountNotConnectedError);
    resetSellerAccountHooks();
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "charge" }, env)).resolves.toBe("TEST-platform-token");
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "settlement" }, env)).resolves.toBe("TEST-platform-token");
  });

  it("confirmação desconectada avisa uma vez e o caso sem consulta não confirma", async () => {
    setSellerAccountHooks({ getSellerLinkState: async () => "disconnected" });
    try {
      const ports = memory(view());
      const mailer = mailerFor(ports);
      await notifyDisconnectedConfirmation(ports, "pay-1", mailer);
      await notifyDisconnectedConfirmation(ports, "pay-1", mailer);
      expect(ports.emails).toHaveLength(1);
      expect(ports.emails[0]).toContain("desconectada do AgendaPix");
      expect(ports.emails[0]).toContain("O agendamento foi confirmado");
      const unverifiable = memory(view());
      const unverifiableMail = mailerFor(unverifiable);
      expect(await recordUnverifiableSellerPayment(unverifiable, "mp-1", unverifiableMail)).toBe(true);
      expect(await recordUnverifiableSellerPayment(unverifiable, "mp-1", unverifiableMail)).toBe(true);
      expect(unverifiable.emails).toHaveLength(1);
      expect(unverifiable.audits.filter((row) => row.action === "unverifiable_seller_disconnected")).toHaveLength(1);
      expect(unverifiable.audits.some((row) => row.action === "payment_confirmed")).toBe(false);
    } finally {
      resetSellerAccountHooks();
    }
  });

  it("os textos usam o AgendaPix no masculino", () => {
    const sample = [
      disconnectedConfirmedNotice({ customerName: "Ana", serviceName: "Corte", when: "02/06/2030" }).text,
      lateRefundedNotice({ customerName: "Ana", serviceName: "Corte", when: "02/06/2030" }).text,
      lateRefundFailedNotice({ customerName: "Ana", serviceName: "Corte", when: "02/06/2030" }).text,
      unverifiableSellerNotice().text,
    ].join("\n");
    expect(sample).not.toMatch(/a AgendaPix/);
    expect(sample).toMatch(/do AgendaPix|O AgendaPix|pelo AgendaPix/);
  });
});
