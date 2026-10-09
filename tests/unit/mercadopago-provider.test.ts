import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as schema from "../../db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getPaymentProvider } from "../../lib/payments";
import { processWebhook } from "../../lib/payments/webhook";
import { ObservedRefundEvent, UnverifiableSellerPayment } from "../../lib/payments/provider";
import { ProviderTimeoutError } from "../../lib/payments/timeout";
import { MpAccountNotConnectedError, resetSellerAccountHooks } from "../../lib/payments/seller-account";
import {
  buildMercadoPagoManifest,
  centsToTransactionAmount,
  MercadoPagoPaymentProvider,
  resolveMpAccessToken,
  signMercadoPagoWebhook,
} from "../../lib/payments/mercadopago";
import { InMemoryChargeReferenceStore } from "../../lib/payments/reference-store";

const accessToken = "TEST-access-token-not-real";
const webhookSecret = "test-only-mercadopago-webhook-secret-32chars";
const baseUrl = "https://api.mercadopago.com";
const now = new Date("2030-01-01T12:00:00.000Z");
const customer = { name: "Cliente Teste Silva", phone: "+5511999999999" };

afterEach(() => {
  resetSellerAccountHooks();
  vi.unstubAllEnvs();
});

type Call = { method: string; url: string; body?: Record<string, unknown>; headers?: Record<string, string> };
type Payment = {
  id: string;
  status: string;
  status_detail: string | null;
  external_reference: string;
  transaction_amount: number;
  date_created: string;
  date_of_expiration: string;
  date_approved?: string | null;
  collector_id: number;
  point_of_interaction: {
    transaction_data: {
      qr_code: string;
      qr_code_base64: string;
      ticket_url: string | null;
    };
  };
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function mpMock() {
  const payments = new Map<string, Payment>();
  const byId = new Map<string, Payment>();
  let nextId = 1000;
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ method, url: url.toString(), body, headers });

    if (method === "GET" && url.pathname === "/v1/payments/search") {
      const reference = url.searchParams.get("external_reference");
      const found = reference ? payments.get(reference) : undefined;
      return json({ results: found ? [found] : [] });
    }

    if (method === "POST" && url.pathname === "/v1/payments") {
      const reference = String(body?.external_reference);
      const existing = payments.get(reference);
      if (existing) return json(existing, 200);
      if ("application_fee" in (body ?? {})) return json({ message: "application_fee omitted" }, 400);
      const id = String(++nextId);
      const payment: Payment = {
        id,
        status: "pending",
        status_detail: "pending_waiting_transfer",
        external_reference: reference,
        transaction_amount: Number(body?.transaction_amount),
        date_created: now.toISOString(),
        date_of_expiration: String(body?.date_of_expiration),
        collector_id: 4444,
        point_of_interaction: {
          transaction_data: {
            qr_code: `00020101021226-BRCODE-${reference}`,
            qr_code_base64: "aGVsbG8=",
            ticket_url: null,
          },
        },
      };
      payments.set(reference, payment);
      byId.set(id, payment);
      byId.set(id.toLowerCase(), payment);
      return json(payment, 201);
    }

    const refundMatch = /^\/v1\/payments\/([^/]+)\/refunds$/.exec(url.pathname);
    if (refundMatch && method === "POST") {
      const payment = byId.get(decodeURIComponent(refundMatch[1]));
      if (!payment) return json({ message: "not found" }, 404);
      if (body && "amount" in body) return json({ message: "full refund omits amount" }, 400);
      payment.status = "refunded";
      payment.status_detail = "refunded";
      return json({ id: `9${payment.id}`, status: "approved", payment_id: payment.id }, 201);
    }

    const itemMatch = /^\/v1\/payments\/([^/]+)$/.exec(url.pathname);
    if (itemMatch && method === "GET") {
      const payment = byId.get(decodeURIComponent(itemMatch[1]));
      if (!payment) return json({ message: "not found" }, 404);
      return json(payment);
    }
    if (itemMatch && method === "PUT") {
      const payment = byId.get(decodeURIComponent(itemMatch[1]));
      if (!payment) return json({ message: "not found" }, 404);
      if (payment.status === "approved" && payment.status_detail === "accredited") return json({ message: "cannot cancel paid" }, 409);
      payment.status = "cancelled";
      payment.status_detail = "by_collector";
      return json(payment);
    }
    return json({ message: "unexpected" }, 500);
  });
  return { payments, byId, calls, fetchImpl };
}

function provider(mock = mpMock()) {
  return {
    mock,
    mp: new MercadoPagoPaymentProvider({
      accessToken,
      webhookSecret,
      baseUrl,
      notificationUrl: "https://example.test/api/webhooks/payments/mercadopago",
      fetchImpl: mock.fetchImpl,
      now: () => now,
    }),
  };
}

function signedHeaders(dataId: string, requestId = "req-1") {
  const ts = String(now.getTime());
  const manifest = buildMercadoPagoManifest({ dataId, requestId, ts });
  const v1 = signMercadoPagoWebhook(manifest, webhookSecret);
  return new Headers({
    "x-signature": `ts=${ts},v1=${v1}`,
    "x-request-id": requestId,
    "content-type": "application/json",
  });
}

describe("MercadoPagoPaymentProvider: cobrança", () => {
  it("cria Pix em POST /v1/payments com idempotência, sem taxa e sem CPF", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const expiresAt = new Date(now.getTime() + 40 * 60_000);
    const charge = await mp.createPixCharge({
      idempotencyKey: randomUUID(),
      reference,
      amountCents: 1000,
      expiresAt,
      customer,
    });
    expect(charge).toMatchObject({
      amountCents: 1000,
      copyPaste: `00020101021226-BRCODE-${reference}`,
    });
    expect(charge.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(charge.externalId).toMatch(/^\d+$/);
    const post = mock.calls.find((call) => call.method === "POST")!;
    expect(post.headers?.authorization).toBe(`Bearer ${accessToken}`);
    expect(post.headers?.["x-idempotency-key"]).toBe(reference);
    expect(post.body).toMatchObject({
      transaction_amount: 10,
      payment_method_id: "pix",
      external_reference: reference,
      notification_url: "https://example.test/api/webhooks/payments/mercadopago",
      date_of_expiration: new Date(expiresAt.getTime() + 2 * 60_000).toISOString().replace(/Z$/, "-00:00"),
      payer: {
        email: `hold-${reference}@pagador.agendapix.invalid`,
        first_name: "Cliente",
        last_name: "Teste Silva",
      },
    });
    expect(post.body).not.toHaveProperty("application_fee");
    expect(JSON.stringify(post.body)).not.toContain("identification");
    expect(charge.expiresAt.toISOString()).toBe(expiresAt.toISOString());
    expect(charge.copyPaste).toBe(`00020101021226-BRCODE-${reference}`);
    expect(charge.qrCodeDataUrl).toBe("data:image/png;base64,aGVsbG8=");
    expect(centsToTransactionAmount(1000)).toBe(10);
    // Não há mais lookup GET antes do POST; cache local resolve idempotência
    expect(mock.calls.filter((call) => call.method === "POST").map((call) => call.url.endsWith("/v1/payments"))).toEqual([true]);
  });

  it("envia date_of_expiration com margem de 2 min e devolve o hold no expiresAt", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const hold = new Date(now.getTime() + 30 * 60_000);
    const charge = await mp.createPixCharge({
      idempotencyKey: randomUUID(),
      reference,
      amountCents: 500,
      expiresAt: hold,
      customer,
    });
    const post = mock.calls.find((call) => call.method === "POST" && call.url.endsWith("/v1/payments"))!;
    expect(post.body?.date_of_expiration).toBe(new Date(hold.getTime() + 2 * 60_000).toISOString().replace(/Z$/, "-00:00"));
    expect(charge.expiresAt.toISOString()).toBe(hold.toISOString());
    expect(Math.abs(charge.expiresAt.getTime() - hold.getTime())).toBeLessThanOrEqual(5000);

    const shifted = new Date(hold.getTime() + 2 * 60_000 + 15 * 60_000).toISOString().replace(/Z$/, "-00:00");
    mock.byId.get(charge.externalId)!.date_of_expiration = shifted;
    const viewed = await mp.getCharge(charge.externalId);
    expect(viewed?.expiresAt.toISOString()).toBe(new Date(new Date(shifted).getTime() - 2 * 60_000).toISOString());
  });

  it("retry sem pagador recupera cobrança existente via cache local", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const first = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    const retry = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000),
    });
    expect(retry).toEqual(first);
    expect(mock.calls.filter((c) => c.method === "POST")).toHaveLength(1);
    await expect(mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 2000,
      expiresAt: new Date(now.getTime() + 40 * 60_000),
    })).rejects.toThrow("idempotência");
  });

  it("consulta order por id, localiza por cache local, mapeia status e cancela pendente via POST /cancel", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    expect(await mp.getCharge(created.externalId)).toMatchObject({
      externalId: created.externalId, reference, status: "pending", paidAt: null,
    });
    expect(await mp.findChargeByReference(reference)).toMatchObject({ status: "pending" });
    expect(await mp.findChargeByReference(randomUUID())).toBeNull();
    
    const canceled = await mp.cancelCharge(created.externalId);
    expect(canceled).toMatchObject({ status: "cancelled" });
    const cancelCall = mock.calls.find((c) => c.method === "PUT" && c.url.includes(`/v1/payments/${created.externalId}`));
    expect(cancelCall?.body).toEqual({ status: "cancelled" });

    const paidRef = randomUUID();
    const paid = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference: paidRef, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    const paidPayment = mock.byId.get(paid.externalId)!;
    paidPayment.status = "approved";
    paidPayment.status_detail = "accredited";
    paidPayment.date_approved = "2030-01-01T12:01:00.000Z";
    expect(await mp.cancelCharge(paid.externalId)).toMatchObject({ status: "paid" });
    const cancelAttempts = mock.calls.filter((c) => c.method === "PUT" && c.url.endsWith(`/v1/payments/${paid.externalId}`));
    expect(cancelAttempts).toHaveLength(0);
  });

  it("estorno sem signal do chamador aborta no prazo configurado", async () => {
    vi.stubEnv("PAYMENT_PROVIDER_TIMEOUT_MS", "100");
    const slow = new MercadoPagoPaymentProvider({
      accessToken, webhookSecret, baseUrl,
      fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("lento")), 5_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(init.signal?.reason ?? new Error("abort"));
        });
      }),
    });
    const started = Date.now();
    await expect(slow.refundCharge("1001", { idempotencyKey: "pay-0001:1" })).rejects.toBeInstanceOf(ProviderTimeoutError);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("propaga AbortSignal e erros 5xx", async () => {
    const { mp } = provider();
    const controller = new AbortController();
    controller.abort(new Error("timeout"));
    await expect(mp.getCharge("1", { signal: controller.signal })).rejects.toThrow("timeout");
    const failing = new MercadoPagoPaymentProvider({
      accessToken, webhookSecret, baseUrl,
      fetchImpl: async () => json({ message: "boom" }, 503),
    });
    await expect(failing.getCharge("1")).rejects.toThrow("503");
  });

  it("detecta order.status=processed e payment.status=accredited como pago (Orders API)", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1500,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    
    const payment = mock.byId.get(created.externalId)!;
    payment.status = "approved";
    payment.status_detail = "accredited";
    payment.date_approved = "2030-01-01T12:03:00.000Z";
    
    const charge = await mp.getCharge(created.externalId);
    expect(charge).toMatchObject({
      externalId: created.externalId,
      status: "paid",
      paidAt: new Date("2030-01-01T12:03:00.000Z"),
    });
    
    // Tenta cancelar order pago → deve retornar o order pago sem chamar cancel
    const cancelAttempt = await mp.cancelCharge(created.externalId);
    expect(cancelAttempt).toMatchObject({ status: "paid" });
    expect(mock.calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("normaliza order ID para lowercase no cache e lookup (case-insensitive)", async () => {
    const { mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    
    // Verifica que findChargeByReference recupera com ID em lowercase
    const found = await mp.findChargeByReference(reference);
    expect(found).toMatchObject({
      externalId: created.externalId,
      status: "pending",
    });
    
    // Mock deve aceitar lookup case-insensitive
    const upperCaseId = created.externalId.toUpperCase();
    const charge = await mp.getCharge(upperCaseId);
    expect(charge).toMatchObject({
      externalId: created.externalId,
      status: "pending",
    });
  });

  it("mapeia status canceled (um L) corretamente após POST /cancel", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 800,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    
    const canceled = await mp.cancelCharge(created.externalId);
    expect(canceled?.status).toBe("cancelled");
    
    // Verifica que o mock retornou status "canceled" (um L)
    const payment = mock.byId.get(created.externalId)!;
    expect(payment.status).toBe("cancelled");
  });
});

const untouchable = new Proxy({}, {
  get(_t, property) { throw new Error(`banco acessado: ${String(property)}`); },
}) as NodePgDatabase<typeof schema>;

describe("MercadoPagoPaymentProvider: webhook", () => {
  it("valida x-signature HMAC e normaliza order.approved via GET", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1500,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    const payment = mock.byId.get(created.externalId)!;
    payment.status = "approved";
    payment.status_detail = "accredited";
    payment.date_approved = "2030-01-01T12:05:00.000Z";
    const body = JSON.stringify({
      id: 999001,
      type: "payment",
      action: "payment.updated",
      user_id: 4444,
      data: { id: created.externalId },
    });
    const url = `http://localhost/api/webhooks/payments/mercadopago?data.id=${created.externalId}&type=payment`;
    const event = await mp.verifyWebhook(body, signedHeaders(created.externalId), now, url);
    expect(event).toEqual({
      eventId: "mp:999001",
      type: "payment.paid",
      externalId: created.externalId,
      amountCents: 1500,
      paidAt: "2030-01-01T12:05:00.000Z",
      paidAtSource: "date_approved",
      statusDetail: "accredited",
    });
  });

  it.each([
    ["sem assinatura", () => new Headers()],
    ["assinatura de outro segredo", (dataId: string) => {
      const ts = String(now.getTime());
      const v1 = signMercadoPagoWebhook(buildMercadoPagoManifest({ dataId, requestId: "r", ts }), "another-secret-another-secret-32xx");
      return new Headers({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "r" });
    }],
    ["assinatura malformada", () => new Headers({ "x-signature": "nope" })],
  ])("rejeita %s com 401 antes de qualquer escrita", async (_name, headers) => {
    const { mp } = provider();
    const body = JSON.stringify({ id: 1, type: "payment", action: "payment.updated", data: { id: "1001" } });
    const request = new Request("http://localhost/api/webhooks/payments/mercadopago?data.id=1001&type=payment", {
      method: "POST", body, headers: headers("ORDTST001"),
    });
    await expect(processWebhook(request, "mercadopago", untouchable, mp, now)).rejects.toMatchObject({
      status: 401, code: "invalid_signature",
    });
  });

  it("order.pending autenticado responde ignored sem tocar no banco", async () => {
    const { mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    const body = JSON.stringify({
      id: 42, type: "payment", action: "payment.created", user_id: 4444, data: { id: created.externalId },
    });
    const request = new Request(
      `http://localhost/api/webhooks/payments/mercadopago?data.id=${created.externalId}&type=payment`,
      { method: "POST", body, headers: signedHeaders(created.externalId) },
    );
    await expect(processWebhook(request, "mercadopago", untouchable, mp, now)).resolves.toEqual({
      outcome: "ignored", reason: "unsupported_event",
    });
  });

  it("timeout ao consultar o pagamento responde 503 sem tocar no banco", async () => {
    vi.stubEnv("PAYMENT_PROVIDER_TIMEOUT_MS", "100");
    const slow = new MercadoPagoPaymentProvider({
      accessToken, webhookSecret, baseUrl,
      fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("lento")), 5_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(init.signal?.reason ?? new Error("abort"));
        });
      }),
    });
    const body = JSON.stringify({ id: 1, type: "payment", action: "payment.updated", user_id: 4444, data: { id: "1001" } });
    const request = new Request("http://localhost/api/webhooks/payments/mercadopago?data.id=1001&type=payment", {
      method: "POST", body, headers: signedHeaders("1001"),
    });
    const started = Date.now();
    await expect(processWebhook(request, "mercadopago", untouchable, slow, now)).rejects.toMatchObject({
      status: 503, code: "webhook_unavailable",
    });
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("tipo merchant_order autenticado → ignored", async () => {
    const { mp } = provider();
    const body = JSON.stringify({ id: 7, type: "merchant_order", action: "updated", data: { id: "ORDTST99" } });
    const request = new Request(
      "http://localhost/api/webhooks/payments/mercadopago?data.id=ORDTST99&type=merchant_order",
      { method: "POST", body, headers: signedHeaders("ORDTST99") },
    );
    await expect(processWebhook(request, "mercadopago", untouchable, mp, now)).resolves.toEqual({
      outcome: "ignored", reason: "unsupported_event",
    });
  });

  it("webhook detecta order.status=processed + payment.status=accredited como pago", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 2000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    
    const payment = mock.byId.get(created.externalId)!;
    payment.status = "approved";
    payment.status_detail = "accredited";
    payment.date_approved = "2030-01-01T12:07:00.000Z";
    
    const body = JSON.stringify({
      id: 888,
      type: "payment",
      action: "payment.updated",
      user_id: 4444,
      data: { id: created.externalId },
    });
    const url = `http://localhost/api/webhooks/payments/mercadopago?data.id=${created.externalId}&type=payment`;
    const event = await mp.verifyWebhook(body, signedHeaders(created.externalId), now, url);
    
    expect(event).toEqual({
      eventId: "mp:888",
      type: "payment.paid",
      externalId: created.externalId,
      amountCents: 2000,
      paidAt: "2030-01-01T12:07:00.000Z",
      paidAtSource: "date_approved",
      statusDetail: "accredited",
    });
  });

  it("webhook com order ID em uppercase faz lookup case-insensitive", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1200,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    
    const payment = mock.byId.get(created.externalId)!;
    payment.status = "approved";
    payment.status_detail = "accredited";
    payment.date_approved = "2030-01-01T12:10:00.000Z";
    
    // Webhook envia ID em uppercase
    const upperCaseId = created.externalId.toUpperCase();
    const body = JSON.stringify({
      id: 999,
      type: "payment",
      action: "payment.updated",
      user_id: 4444,
      data: { id: upperCaseId },
    });
    const url = `http://localhost/api/webhooks/payments/mercadopago?data.id=${upperCaseId}&type=payment`;
    const event = await mp.verifyWebhook(body, signedHeaders(upperCaseId), now, url);
    
    expect(event).toMatchObject({
      type: "payment.paid",
      externalId: created.externalId,
      amountCents: 1200,
      paidAtSource: "date_approved",
    });
  });

  it("sem date_approved válido não usa date_created nem o relógio como aprovação", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1500,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    const payment = mock.byId.get(created.externalId)!;
    payment.status = "approved";
    payment.status_detail = "accredited";
    payment.date_created = "2030-01-01T11:00:00.000Z";
    payment.date_approved = "nao-e-data";
    expect(await mp.getCharge(created.externalId)).toMatchObject({ status: "paid", paidAt: null });

    payment.date_approved = null;
    const body = JSON.stringify({
      id: 777, type: "payment", action: "payment.updated", user_id: 4444, data: { id: created.externalId },
    });
    const url = `http://localhost/api/webhooks/payments/mercadopago?data.id=${created.externalId}&type=payment`;
    const event = await mp.verifyWebhook(body, signedHeaders(created.externalId), now, url);
    expect(event).toMatchObject({
      paidAt: now.toISOString(),
      paidAtSource: "fallback",
      statusDetail: "accredited",
    });
  });
});

describe("seleção do provedor", () => {
  const mpEnv = {
    PAYMENT_PROVIDER: "mercadopago",
    MERCADOPAGO_ACCESS_TOKEN: accessToken,
    MERCADOPAGO_WEBHOOK_SECRET: webhookSecret,
  };
  it("mercadopago em produção com envs; fake recusado em produção; fake é o padrão fora de produção", () => {
    expect(getPaymentProvider({ ...mpEnv, NODE_ENV: "production" }).name).toBe("mercadopago");
    expect(() => getPaymentProvider({ ...mpEnv, NODE_ENV: "production", MERCADOPAGO_ACCESS_TOKEN: "" })).toThrow("Cobrança indisponível");
    expect(() => getPaymentProvider({
      ...mpEnv, NODE_ENV: "production",
      MERCADOPAGO_WEBHOOK_SECRET: "replace-this-with-the-mercadopago-webhook-secret-32c",
    })).toThrow("Cobrança indisponível");
    expect(() => getPaymentProvider({ NODE_ENV: "production", PAYMENT_PROVIDER: "fake", FAKE_WEBHOOK_SECRET: webhookSecret })).toThrow("Cobrança indisponível");
    expect(() => getPaymentProvider({ NODE_ENV: "production" })).toThrow("Cobrança indisponível");
    expect(getPaymentProvider({ NODE_ENV: "test", FAKE_WEBHOOK_SECRET: webhookSecret }).name).toBe("fake");
    expect(() => getPaymentProvider({ NODE_ENV: "test", PAYMENT_PROVIDER: "woovi" })).toThrow("Cobrança indisponível");
  });

  it("MERCADOPAGO_BASE_URL sobrescreve a URL padrão", async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      calls.push(String(input));
      return json({ message: "not found" }, 404);
    });
    await getPaymentProvider({ ...mpEnv, NODE_ENV: "test" }).getCharge("ORDTST1", { accessToken });
    await getPaymentProvider({ ...mpEnv, NODE_ENV: "test", MERCADOPAGO_BASE_URL: "https://api.mercadopago.com" }).getCharge("ORDTST2", { accessToken });
    await getPaymentProvider({ ...mpEnv, NODE_ENV: "test", MERCADOPAGO_BASE_URL: "https://api.mp-test.example" }).getCharge("ORDTST3", { accessToken });
    spy.mockRestore();
    expect(calls).toEqual([
      "https://api.mercadopago.com/v1/payments/ORDTST1",
      "https://api.mercadopago.com/v1/payments/ORDTST2",
      "https://api.mp-test.example/v1/payments/ORDTST3",
    ]);
  });

  it("persiste reference → orderId no store: outra instância (serverless) encontra a cobrança sem recriar", async () => {
    const mock = mpMock();
    const referenceStore = new InMemoryChargeReferenceStore();
    const make = () => new MercadoPagoPaymentProvider({ accessToken, webhookSecret, baseUrl, notificationUrl: "https://example.test/api/webhooks/payments/mercadopago", fetchImpl: mock.fetchImpl, now: () => now, referenceStore });
    const reference = randomUUID();
    const created = await make().createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    expect(await referenceStore.get(reference)).toBe(created.externalId.toLowerCase());

    const other = make();
    expect(await other.findChargeByReference(reference)).toMatchObject({ externalId: created.externalId, status: "pending" });
    const replay = await other.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000),
    });
    expect(replay.externalId).toBe(created.externalId);
    expect(mock.calls.filter((c) => c.method === "POST" && c.url.endsWith("/v1/payments"))).toHaveLength(1);
  });

  it("findChargeByReference respeita AbortSignal antes de consultar o store", async () => {
    const get = vi.fn(async () => "ordtst1");
    const mp = new MercadoPagoPaymentProvider({ accessToken, webhookSecret, baseUrl, fetchImpl: mpMock().fetchImpl, referenceStore: { get, save: async () => {} } });
    const controller = new AbortController();
    controller.abort(new Error("timeout"));
    await expect(mp.findChargeByReference(randomUUID(), { signal: controller.signal })).rejects.toThrow("timeout");
    expect(get).not.toHaveBeenCalled();
  });

  it("estorna em POST /v1/payments/{id}/refunds sem amount e não repete", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    const payment = mock.byId.get(created.externalId)!;
    payment.status = "approved";
    payment.status_detail = "accredited";
    const key = randomUUID();
    const first = await mp.refundCharge(created.externalId, { idempotencyKey: key });
    expect(first).toMatchObject({ status: "refunded" });
    const refundCall = mock.calls.find((call) => call.url.includes("/refunds"))!;
    expect(refundCall.method).toBe("POST");
    expect(refundCall.body).toEqual({});
    expect(refundCall.headers?.["x-idempotency-key"]).toBe(key);
    expect(refundCall.headers?.["x-render-in-process-refunds"]).toBe("true");
    expect(refundCall.headers?.authorization).toBe(`Bearer ${accessToken}`);
    expect(await mp.refundCharge(created.externalId, { idempotencyKey: key })).toMatchObject({ status: "refunded" });
    expect(mock.calls.filter((call) => call.url.includes("/refunds"))).toHaveLength(1);
  });

  it("usa o token devolvido por resolveMpAccessToken na criação e no webhook", async () => {
    const ownerToken = "APP_USR-owner-token-not-real";
    const seen: Array<{ businessId?: string; mpUserId?: string; purpose?: string }> = [];
    const { mock } = provider();
    const custom = new MercadoPagoPaymentProvider({
      accessToken,
      webhookSecret,
      baseUrl,
      notificationUrl: "https://example.test/api/webhooks/payments/mercadopago",
      fetchImpl: mock.fetchImpl,
      now: () => now,
      resolveAccessToken: async (query) => {
        seen.push(query);
        return ownerToken;
      },
    });
    const reference = randomUUID();
    const created = await custom.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 800,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer: { ...customer, cpfCnpj: "52998224725" },
    }, { businessId: "biz-1" });
    const post = mock.calls.find((call) => call.method === "POST" && call.url.endsWith("/v1/payments"))!;
    expect(post.headers?.authorization).toBe(`Bearer ${ownerToken}`);
    expect(JSON.stringify(post.body)).not.toContain("identification");
    expect(seen.some((query) => query.businessId === "biz-1" && query.purpose === "charge")).toBe(true);
    expect(seen.some((query) => query.purpose === "settlement")).toBe(true);
    expect(await resolveMpAccessToken({}, { MERCADOPAGO_ACCESS_TOKEN: accessToken })).toBe(accessToken);

    mock.byId.get(created.externalId)!.status = "refunded";
    mock.byId.get(created.externalId)!.status_detail = "refunded";
    const body = JSON.stringify({ id: 7, type: "payment", action: "payment.updated", user_id: "seller-9", data: { id: created.externalId } });
    const url = `http://localhost/api/webhooks/payments/mercadopago?data.id=${created.externalId}&type=payment`;
    await expect(custom.verifyWebhook(body, signedHeaders(created.externalId), now, url)).rejects.toBeInstanceOf(ObservedRefundEvent);
    expect(seen.some((query) => query.mpUserId === "seller-9" && query.purpose === "settlement")).toBe(true);
    expect(mock.calls.filter((call) => call.url.includes("/refunds"))).toHaveLength(0);
  });

  it("só envia identification quando MP_REQUIRES_PAYER_CPF=true", async () => {
    const previous = process.env.MP_REQUIRES_PAYER_CPF;
    process.env.MP_REQUIRES_PAYER_CPF = "true";
    try {
      const { mock, mp } = provider();
      const reference = randomUUID();
      await mp.createPixCharge({
        idempotencyKey: randomUUID(),
        reference,
        amountCents: 800,
        expiresAt: new Date(now.getTime() + 40 * 60_000),
        customer: { ...customer, cpfCnpj: "52998224725" },
      });
      const post = mock.calls.find((call) => call.method === "POST" && call.url.endsWith("/v1/payments"))!;
      expect(post.body).toMatchObject({ payer: { identification: { type: "CPF", number: "52998224725" } } });
    } finally {
      if (previous === undefined) delete process.env.MP_REQUIRES_PAYER_CPF;
      else process.env.MP_REQUIRES_PAYER_CPF = previous;
    }
  });

  it("webhook sem token de liquidação não confirma o pagamento", async () => {
    const mp = new MercadoPagoPaymentProvider({
      accessToken,
      webhookSecret,
      baseUrl,
      fetchImpl: vi.fn(),
      resolveAccessToken: async (query) => {
        if (query.purpose === "settlement") throw new MpAccountNotConnectedError();
        return accessToken;
      },
    });
    const body = JSON.stringify({ id: 9, type: "payment", action: "payment.updated", user_id: "seller-1", data: { id: "555" } });
    const url = "http://localhost/api/webhooks/payments/mercadopago?data.id=555&type=payment";
    await expect(mp.verifyWebhook(body, signedHeaders("555"), now, url)).rejects.toBeInstanceOf(UnverifiableSellerPayment);
  });

  it("rejeita webhook com ts fora de ±300s", async () => {
    const { mp } = provider();
    const body = JSON.stringify({ id: 1, type: "payment", data: { id: "1001" } });
    const ts = String(Math.floor(now.getTime() / 1000) - 301);
    const manifest = buildMercadoPagoManifest({ dataId: "1001", requestId: "r", ts });
    const headers = new Headers({ "x-signature": `ts=${ts},v1=${signMercadoPagoWebhook(manifest, webhookSecret)}`, "x-request-id": "r" });
    await expect(mp.verifyWebhook(body, headers, now, "http://localhost/api/webhooks/payments/mercadopago?data.id=1001&type=payment"))
      .rejects.toMatchObject({ status: 401, code: "invalid_signature" });
  });
});
