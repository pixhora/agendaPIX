import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http";
import {
  executeOwnerRefund,
  markRefundedByExternalId,
  notifyDisconnectedConfirmation,
  parseOwnerRefundBody,
  recordUnverifiableSellerPayment,
  settleAutomaticLateRefund,
  previewOwnerRefund,
  type RefundAttempt,
  type RefundPorts,
  type RefundView,
  type RefundWriter,
} from "../../lib/payments/refund-flow";
import { formatBusinessDay, manualRefundDueAtFromNotice } from "../../lib/payments/manual-refund-calendar";
import { OWNER_MANUAL_MARK_LABEL } from "../../lib/payments/refund-copy";
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
const dueAt = () => manualRefundDueAtFromNotice(now, "America/Sao_Paulo");
const dueLabel = () => formatBusinessDay(dueAt(), "America/Sao_Paulo", true);

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
    manualRefundDueAt: null,
    policyRefundRequestedOn: null,
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

function memory(initial: RefundView): RefundPorts & { audits: { action: string; detail: Record<string, unknown> }[]; emails: string[]; attempts: RefundAttempt[] } {
  let current = { ...initial };
  const audits: { action: string; detail: Record<string, unknown> }[] = [];
  const emails: string[] = [];
  const attempts: RefundAttempt[] = [];
  let chain: Promise<unknown> = Promise.resolve();
  const writer = (): RefundWriter => ({
    async setRefund(patch) {
      current = {
        ...current,
        ...(patch.refundStatus !== undefined ? { refundStatus: patch.refundStatus } : {}),
        ...(patch.refundedAt !== undefined ? { refundedAt: patch.refundedAt } : {}),
        ...(patch.paymentStatus !== undefined ? { paymentStatus: patch.paymentStatus } : {}),
        ...(patch.manualRefundDueAt !== undefined ? { manualRefundDueAt: patch.manualRefundDueAt } : {}),
        ...(patch.policyRefundRequestedOn !== undefined ? { policyRefundRequestedOn: patch.policyRefundRequestedOn } : {}),
      };
    },
    async audit(action, detail) { audits.push({ action, detail }); },
    async hasAudit(action) { return audits.some((row) => row.action === action); },
    async listAttempts() { return attempts.map((row) => ({ ...row })); },
    async beginAttempt(input) {
      const created: RefundAttempt = { id: `attempt-${attempts.length + 1}`, status: "requested", mpRefundId: null, ...input };
      attempts.push(created);
      return { ...created };
    },
    async finishAttempt(id, patch) {
      const found = attempts.find((row) => row.id === id);
      if (found) Object.assign(found, patch);
    },
  });
  return {
    audits,
    emails,
    attempts,
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

  it("recusa valor diferente e janela vencida antes de gravar a data do pedido", async () => {
    const ports = memory(view());
    const provider = { refundCharge: async () => ({ status: "refunded" as const, refundId: "r-1" }) };
    await expect(executeOwnerRefund(ports, provider, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 999, now }))
      .rejects.toMatchObject({ status: 409, code: "refund_amount_changed" });
    expect((await ports.loadByPaymentId("pay-1"))?.policyRefundRequestedOn).toBeNull();

    const expired = memory(view({ paidAt: new Date("2029-01-01T00:00:00.000Z") }));
    await expect(executeOwnerRefund(expired, provider, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now }))
      .rejects.toMatchObject({ status: 409, code: "refund_window_expired" });
    expect((await expired.loadByPaymentId("pay-1"))?.policyRefundRequestedOn).toBeNull();
    expect(await previewOwnerRefund(memory(view({ refundStatus: "in_process" })), "biz-1", "book-1", "owner-1", now)).toMatchObject({ eligible: false, reason: "refund_in_process" });
  });

  it("devolve o estado atual sem chamar o Mercado Pago de novo", async () => {
    const provider = { refundCharge: async () => { throw new Error("não deveria chamar"); } };
    const refunded = memory(view({ refundStatus: "refunded", refundedAt: now, paymentStatus: "refunded" }));
    await expect(executeOwnerRefund(refunded, provider, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now }))
      .resolves.toMatchObject({ status: "refunded", refundId: null });
    const running = memory(view({ refundStatus: "in_process" }));
    await expect(executeOwnerRefund(running, provider, { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1, now }))
      .resolves.toMatchObject({ status: "in_process", refundId: null });
  });

  it("grava a data do pedido uma vez, mesmo sem saldo, e a próxima tentativa usa outra chave", async () => {
    const keys: string[] = [];
    const failing = memory(view());
    const broken = {
      refundCharge: async (_externalId: string, input: { idempotencyKey: string }) => {
        keys.push(input.idempotencyKey);
        throw new Error("collector has insufficient available balance");
      },
    };
    const input = { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now, requestedOn: "2030-06-01" };
    await expect(executeOwnerRefund(failing, broken, input)).rejects.toMatchObject({ status: 502, code: "refund_failed", message: expect.stringContaining(OWNER_MANUAL_MARK_LABEL) });
    await expect(executeOwnerRefund(failing, broken, { ...input, requestedOn: "2099-01-01" }))
      .rejects.toSatisfy((error: HttpError) => error instanceof HttpError && error.status === 502 && !error.message.includes("insufficient") && !error.message.includes("ou devolva por outro meio") && !error.message.includes("Marcar como devolvido"));
    expect(keys).toEqual(["pay-1:1", "pay-1:2"]);
    const stored = await failing.loadByPaymentId("pay-1");
    expect(stored?.policyRefundRequestedOn).toBe("2030-06-01");
    expect(stored?.manualRefundDueAt?.toISOString()).toBe(dueAt().toISOString());
    expect(failing.attempts.map((row) => row.status)).toEqual(["failed", "failed"]);
    expect(failing.audits[0]?.detail.actorUserId).toBe("owner-1");
    expect(await previewOwnerRefund(failing, "biz-1", "book-1", "owner-1", now)).toMatchObject({
      requestedOn: "2030-06-01",
      todayLocal: "2030-06-01",
      paidOnLocal: "2030-06-01",
      manualRefundDueAt: dueAt().toISOString(),
    });
  });

  it("rejeita data inválida, futura e anterior ao pagamento, e respeita o fuso", async () => {
    const provider = { refundCharge: async () => ({ status: "refunded" as const, refundId: "r-1" }) };
    const base = { businessId: "biz-1", bookingId: "book-1", ownerId: "owner-1", expectedAmountCents: 1500, now };
    const invalid = memory(view());
    await expect(executeOwnerRefund(invalid, provider, { ...base, requestedOn: "01/06/2030" })).rejects.toMatchObject({ status: 422, code: "refund_requested_on_invalid" });
    await expect(executeOwnerRefund(invalid, provider, { ...base, requestedOn: "2030-06-02" })).rejects.toMatchObject({ status: 422, code: "refund_requested_on_in_future" });
    await expect(executeOwnerRefund(invalid, provider, { ...base, requestedOn: "2030-05-31" })).rejects.toMatchObject({ status: 422, code: "refund_requested_on_before_payment" });
    expect((await invalid.loadByPaymentId("pay-1"))?.policyRefundRequestedOn).toBeNull();
    expect(() => parseOwnerRefundBody({ confirm: true, expectedAmountCents: 1500, requestedOn: 1 })).toThrowError(expect.objectContaining({ status: 422, code: "refund_requested_on_invalid" }));
    expect(() => parseOwnerRefundBody({ confirm: true, expectedAmountCents: 1500, extra: true })).toThrow();

    const lateNight = new Date("2030-06-02T02:30:00.000Z");
    const zoned = memory(view());
    await executeOwnerRefund(zoned, provider, { ...base, now: lateNight });
    expect((await zoned.loadByPaymentId("pay-1"))?.policyRefundRequestedOn).toBe("2030-06-01");
    await expect(executeOwnerRefund(memory(view()), provider, { ...base, now: lateNight, requestedOn: "2030-06-02" }))
      .rejects.toMatchObject({ status: 422, code: "refund_requested_on_in_future" });
  });

  it("dois cliques em andamento geram uma só chamada ao Mercado Pago", async () => {
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
    expect(first.status).toBe("fulfilled");
    expect(second.status).toBe("fulfilled");
    if (first.status === "fulfilled" && second.status === "fulfilled") {
      expect([first.value.status, second.value.status]).toEqual(["in_process", "in_process"]);
    }
    expect(ports.attempts).toHaveLength(1);
    expect(ports.attempts[0]?.idempotencyKey).toBe("pay-1:1");
    expect(readFileSync("lib/payments/refund-flow.ts", "utf8")).toContain("for update");
    const migration = readFileSync("db/migrations/0014_manual_refund_due.sql", "utf8");
    expect(migration).toContain("payment_refunds_one_active_per_payment");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "owner_notices"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "email_sent_at"');
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "owner_notices_business_kind_uq"');
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "owner_notices_booking_kind_uq"');
    expect(migration).not.toContain("owner_notices_business_booking_kind_unique");
  });

  it("marca refunded quando o webhook observa o estorno e mantém o prazo", async () => {
    const ports = memory(view({ refundStatus: "in_process" }));
    expect(await markRefundedByExternalId(ports, "mp-1", now)).toBe(true);
    expect(await previewOwnerRefund(ports, "biz-1", "book-1", "owner-1", now)).toMatchObject({ eligible: false, reason: "already_refunded" });
    const pendingDeadline = memory(view({ refundStatus: "failed", manualRefundDueAt: dueAt(), policyRefundRequestedOn: "2030-06-01" }));
    expect(await markRefundedByExternalId(pendingDeadline, "mp-1", now)).toBe(true);
    expect((await pendingDeadline.loadByPaymentId("pay-1"))?.manualRefundDueAt?.toISOString()).toBe(dueAt().toISOString());
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
    expect(await settleAutomaticLateRefund(ports, provider, "pay-1", mailer, new Date("2030-06-03T12:00:00.000Z"))).toBe("failed_already");
    expect(calls).toBe(1);
    expect(ports.emails).toHaveLength(1);
    expect(ports.emails[0]).toContain("Devolver pelo AgendaPix");
    expect(ports.emails[0]).toContain(dueLabel());
    expect(ports.emails[0]).not.toContain("horário de Brasília");
    const stored = await ports.loadByPaymentId("pay-1");
    expect(stored?.manualRefundDueAt?.toISOString()).toBe(dueAt().toISOString());
    expect(ports.attempts[0]?.idempotencyKey).toBe("auto_late:pay-1");
    expect(ports.audits.some((row) => row.detail.status === "failed" && String(row.detail.failureCause).includes("insufficient"))).toBe(true);
  });

  it("sem token não estorna, audita e avisa", async () => {
    setSellerAccountHooks({
      getSellerAccessToken: async () => null,
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
      expect(ports.emails[0]).toContain(dueLabel());
      expect((await ports.loadByPaymentId("pay-1"))?.manualRefundDueAt?.toISOString()).toBe(dueAt().toISOString());
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
    expect(readFileSync("lib/payments/manual-refund-reminders.ts", "utf8")).not.toContain("refundCharge");
  });
});

describe("conta desconectada", () => {
  it("charge falha e settlement usa o token retido; sem token não resolve", async () => {
    const env = { MERCADOPAGO_ACCESS_TOKEN: "TEST-platform-token" };
    setSellerAccountHooks({
      getSellerAccessToken: async () => null,
      getSellerAccessTokenForSettlement: async () => ({ accessToken: "retained-token", mpUserId: "42" }),
    });
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "charge" }, env)).rejects.toBeInstanceOf(MpAccountNotConnectedError);
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "settlement" }, env)).resolves.toBe("retained-token");
    setSellerAccountHooks({
      getSellerAccessToken: async () => null,
      getSellerAccessTokenForSettlement: async () => null,
      findBusinessIdByMpUserId: async () => null,
    });
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "settlement" }, env)).rejects.toBeInstanceOf(MpAccountNotConnectedError);
    await expect(resolveMpAccessToken({ mpUserId: "seller-9", purpose: "settlement" }, env)).rejects.toBeInstanceOf(MpAccountNotConnectedError);
    const seen: string[] = [];
    setSellerAccountHooks({
      findBusinessIdByMpUserId: async (mpUserId) => { seen.push(mpUserId); return "biz-9"; },
      getSellerAccessToken: async () => null,
      getSellerAccessTokenForSettlement: async (businessId) => businessId === "biz-9" ? { accessToken: "seller-token", mpUserId: "99" } : null,
    });
    await expect(resolveMpAccessToken({ mpUserId: "99", purpose: "settlement" }, env)).resolves.toBe("seller-token");
    expect(seen).toEqual(["99"]);
    resetSellerAccountHooks();
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "charge" }, env)).resolves.toBe("TEST-platform-token");
    await expect(resolveMpAccessToken({ businessId: "biz-1", purpose: "settlement" }, env)).resolves.toBe("TEST-platform-token");
    await expect(resolveMpAccessToken({}, env)).resolves.toBe("TEST-platform-token");
  });

  it("confirmação desconectada avisa uma vez e o caso sem consulta não confirma", async () => {
    setSellerAccountHooks({
      getSellerAccessToken: async () => null,
      getSellerAccessTokenForSettlement: async () => ({ accessToken: "retained-token", mpUserId: "42" }),
    });
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
      expect(await recordUnverifiableSellerPayment(unverifiable, "mp-1", unverifiableMail, now)).toBe(true);
      expect(await recordUnverifiableSellerPayment(unverifiable, "mp-1", unverifiableMail, new Date("2030-06-03T12:00:00.000Z"))).toBe(true);
      expect(unverifiable.emails).toHaveLength(1);
      expect(unverifiable.emails[0]).toContain(dueLabel());
      expect((await unverifiable.loadByPaymentId("pay-1"))?.manualRefundDueAt?.toISOString()).toBe(dueAt().toISOString());
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
      lateRefundFailedNotice({ customerName: "Ana", serviceName: "Corte", when: "02/06/2030", deadlineLabel: "sáb, 8 jun" }).text,
      unverifiableSellerNotice({ deadlineLabel: "sáb, 8 jun" }).text,
    ].join("\n");
    expect(sample).not.toMatch(/a AgendaPix/);
    expect(sample).toMatch(/do AgendaPix|O AgendaPix|pelo AgendaPix/);
  });
});
