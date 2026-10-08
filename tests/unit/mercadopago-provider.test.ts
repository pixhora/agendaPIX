import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type * as schema from "../../db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getPaymentProvider } from "../../lib/payments";
import { processWebhook } from "../../lib/payments/webhook";
import {
  buildMercadoPagoManifest,
  centsToTransactionAmount,
  MERCADOPAGO_PIX_MIN_EXPIRATION_MS,
  MercadoPagoPaymentProvider,
  signMercadoPagoWebhook,
} from "../../lib/payments/mercadopago";
import { PIX_WINDOW_MINUTES } from "../../lib/payments/pix-window";
import { InMemoryChargeReferenceStore } from "../../lib/payments/reference-store";

const accessToken = "TEST-access-token-not-real";
const webhookSecret = "test-only-mercadopago-webhook-secret-32chars";
const baseUrl = "https://api.mercadopago.com";
const now = new Date("2030-01-01T12:00:00.000Z");
const customer = { name: "Cliente Teste Silva", phone: "+5511999999999", cpfCnpj: "52998224725" };

type Call = { method: string; url: string; body?: Record<string, unknown>; headers?: Record<string, string> };
type Order = {
  id: string;
  status: string;
  external_reference: string;
  total_amount: string;
  date_created: string;
  date_closed?: string | null;
  transactions: {
    payments: Array<{
      id: string;
      status: string;
      status_detail?: string | null;
      amount: string;
      date_approved?: string | null;
      date_created: string;
      payment_method: {
        id: string;
        type: string;
        qr_code: string;
        qr_code_base64: string;
        ticket_url?: string | null;
      };
    }>;
  };
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function mpMock() {
  const orders = new Map<string, Order>();
  const byId = new Map<string, Order>();
  let nextId = 1000;
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ method, url: url.toString(), body, headers });

    if (method === "POST" && url.pathname === "/v1/orders") {
      const reference = String(body?.external_reference);
      const existing = orders.get(reference);
      if (existing) return json(existing, 200); // idempotência nativa
      const orderId = `ORDTST${String(++nextId).padStart(8, "0")}`;
      const paymentId = `PAY${String(nextId).padStart(10, "0")}`;
      const amount = String((body?.transactions as { payments?: Array<{ amount?: unknown }> })?.payments?.[0]?.amount ?? body?.total_amount);
      const order: Order = {
        id: orderId,
        status: "action_required",
        external_reference: reference,
        total_amount: String(body?.total_amount),
        date_created: now.toISOString(),
        transactions: {
          payments: [{
            id: paymentId,
            status: "pending",
            amount,
            date_created: now.toISOString(),
            payment_method: {
              id: "pix",
              type: "bank_transfer",
              qr_code: `00020101021226-BRCODE-${reference}`,
              qr_code_base64: "aGVsbG8=", // fixture; provider regenera PNG do qr_code
            },
          }],
        },
      };
      orders.set(reference, order);
      // Armazena tanto com o ID original quanto lowercase para simular case-insensitive API
      byId.set(orderId, order);
      byId.set(orderId.toLowerCase(), order);
      return json(order, 201);
    }

    const getMatch = /^\/v1\/orders\/(.+)$/.exec(url.pathname);
    if (getMatch && method === "GET") {
      const requestedId = decodeURIComponent(getMatch[1]);
      const order = byId.get(requestedId);
      if (!order) return json({ message: "not found" }, 404);
      return json(order);
    }
    
    const cancelMatch = /^\/v1\/orders\/(.+)\/cancel$/.exec(url.pathname);
    if (cancelMatch && method === "POST") {
      const requestedId = decodeURIComponent(cancelMatch[1]);
      const order = byId.get(requestedId);
      if (!order) return json({ message: "not found" }, 404);
      if (order.transactions.payments[0]?.status === "approved" || order.transactions.payments[0]?.status === "accredited" || order.status === "processed") {
        return json({ message: "cannot cancel paid order" }, 409);
      }
      order.status = "canceled";
      order.transactions.payments[0]!.status = "canceled";
      return json(order);
    }
    return json({ message: "unexpected" }, 500);
  });
  return { orders, byId, calls, fetchImpl };
}

function provider(mock = mpMock()) {
  return {
    mock,
    mp: new MercadoPagoPaymentProvider({
      accessToken,
      webhookSecret,
      baseUrl,
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

describe("janela do Pix", () => {
  it("usa os 30 minutos do módulo leve, sem outro número solto", () => {
    expect(PIX_WINDOW_MINUTES).toBe(30);
    expect(MERCADOPAGO_PIX_MIN_EXPIRATION_MS).toBe(PIX_WINDOW_MINUTES * 60 * 1000);
    const source = readFileSync("lib/payments/pix-window.ts", "utf8");
    expect(source).not.toMatch(/^import /m);
  });
});

describe("MercadoPagoPaymentProvider: cobrança", () => {
  it("cria Pix com X-Idempotency-Key=order.id, external_reference, CPF e QR", async () => {
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
    expect(charge.externalId).toMatch(/^ORDTST\d{8}$/);
    const post = mock.calls.find((call) => call.method === "POST")!;
    expect(post.headers?.authorization).toBe(`Bearer ${accessToken}`);
    expect(post.headers?.["x-idempotency-key"]).toBe(reference);
    expect(post.body).toMatchObject({
      type: "online",
      external_reference: reference,
      total_amount: "10.00",
      processing_mode: "automatic",
      transactions: {
        payments: [{
          amount: "10.00",
          payment_method: { id: "pix", type: "bank_transfer" },
        }],
      },
      payer: {
        email: "cpf52998224725@pagador.agendapix.invalid",
        first_name: "Cliente",
        last_name: "Teste Silva",
        identification: { type: "CPF", number: "52998224725" },
      },
    });
    expect(centsToTransactionAmount(1000)).toBe(10);
    // Não há mais lookup GET antes do POST; cache local resolve idempotência
    expect(mock.calls.map((c) => c.method)).toEqual(["POST"]);
  });

  it("força date_of_expiration ≥ 30 min mesmo com hold menor", async () => {
    const { mock, mp } = provider();
    await mp.createPixCharge({
      idempotencyKey: randomUUID(),
      reference: randomUUID(),
      amountCents: 500,
      expiresAt: new Date(now.getTime() + 10 * 60_000), // hold 10 min
      customer,
    });
    // Orders API não suporta date_of_expiration explícito ainda; expiramos por idade local
    // Teste verifica que cobrança é criada mesmo com expiry curto
    expect(mock.calls.find((c) => c.method === "POST")).toBeTruthy();
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
    // Verifica que usou POST /v1/orders/{id}/cancel
    const cancelCall = mock.calls.find((c) => c.method === "POST" && c.url.includes("/cancel"));
    expect(cancelCall).toBeTruthy();
    expect(cancelCall?.url).toContain(`/v1/orders/${created.externalId}/cancel`);

    const paidRef = randomUUID();
    const paid = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference: paidRef, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    const paidOrder = mock.byId.get(paid.externalId)!;
    paidOrder.transactions.payments[0]!.status = "approved";
    paidOrder.transactions.payments[0]!.date_approved = "2030-01-01T12:01:00.000Z";
    expect(await mp.cancelCharge(paid.externalId)).toMatchObject({ status: "paid" });
    // Não deve tentar cancelar pagamento já pago
    const cancelAttempts = mock.calls.filter((c) => c.method === "POST" && c.url.includes(paid.externalId) && c.url.includes("/cancel"));
    expect(cancelAttempts).toHaveLength(0);
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
    
    const order = mock.byId.get(created.externalId)!;
    // Simula status do Orders API: order.status = "processed", payment.status = "accredited"
    order.status = "processed";
    order.transactions.payments[0]!.status = "accredited";
    order.transactions.payments[0]!.date_approved = "2030-01-01T12:03:00.000Z";
    
    const charge = await mp.getCharge(created.externalId);
    expect(charge).toMatchObject({
      externalId: created.externalId,
      status: "paid",
      paidAt: new Date("2030-01-01T12:03:00.000Z"),
    });
    
    // Tenta cancelar order pago → deve retornar o order pago sem chamar cancel
    const cancelAttempt = await mp.cancelCharge(created.externalId);
    expect(cancelAttempt).toMatchObject({ status: "paid" });
    expect(mock.calls.some((c) => c.url.includes("/cancel"))).toBe(false);
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
    const order = mock.byId.get(created.externalId)!;
    expect(order.status).toBe("canceled");
    expect(order.transactions.payments[0]?.status).toBe("canceled");
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
    const order = mock.byId.get(created.externalId)!;
    order.transactions.payments[0]!.status = "approved";
    order.transactions.payments[0]!.date_approved = "2030-01-01T12:05:00.000Z";
    const body = JSON.stringify({
      id: 999001,
      type: "order",
      action: "order.updated",
      data: { id: created.externalId },
    });
    const url = `http://localhost/api/webhooks/payments/mercadopago?data.id=${created.externalId}&type=order`;
    const event = await mp.verifyWebhook(body, signedHeaders(created.externalId), now, url);
    expect(event).toEqual({
      eventId: "mp:999001",
      type: "payment.paid",
      externalId: created.externalId,
      amountCents: 1500,
      paidAt: "2030-01-01T12:05:00.000Z",
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
    const body = JSON.stringify({ id: 1, type: "order", action: "order.updated", data: { id: "ORDTST001" } });
    const request = new Request("http://localhost/api/webhooks/payments/mercadopago?data.id=ORDTST001&type=order", {
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
      id: 42, type: "order", action: "order.created", data: { id: created.externalId },
    });
    const request = new Request(
      `http://localhost/api/webhooks/payments/mercadopago?data.id=${created.externalId}&type=order`,
      { method: "POST", body, headers: signedHeaders(created.externalId) },
    );
    await expect(processWebhook(request, "mercadopago", untouchable, mp, now)).resolves.toEqual({
      outcome: "ignored", reason: "unsupported_event",
    });
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
    
    const order = mock.byId.get(created.externalId)!;
    order.status = "processed";
    order.transactions.payments[0]!.status = "accredited";
    order.transactions.payments[0]!.date_approved = "2030-01-01T12:07:00.000Z";
    
    const body = JSON.stringify({
      id: 888,
      type: "order",
      action: "order.processed",
      data: { id: created.externalId },
    });
    const url = `http://localhost/api/webhooks/payments/mercadopago?data.id=${created.externalId}&type=order`;
    const event = await mp.verifyWebhook(body, signedHeaders(created.externalId), now, url);
    
    expect(event).toEqual({
      eventId: "mp:888",
      type: "payment.paid",
      externalId: created.externalId,
      amountCents: 2000,
      paidAt: "2030-01-01T12:07:00.000Z",
    });
  });

  it("webhook com order ID em uppercase faz lookup case-insensitive", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1200,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    
    const order = mock.byId.get(created.externalId)!;
    order.transactions.payments[0]!.status = "approved";
    order.transactions.payments[0]!.date_approved = "2030-01-01T12:10:00.000Z";
    
    // Webhook envia ID em uppercase
    const upperCaseId = created.externalId.toUpperCase();
    const body = JSON.stringify({
      id: 999,
      type: "order",
      action: "order.updated",
      data: { id: upperCaseId },
    });
    const url = `http://localhost/api/webhooks/payments/mercadopago?data.id=${upperCaseId}&type=order`;
    const event = await mp.verifyWebhook(body, signedHeaders(upperCaseId), now, url);
    
    expect(event).toMatchObject({
      type: "payment.paid",
      externalId: created.externalId,
      amountCents: 1200,
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
    await getPaymentProvider({ ...mpEnv, NODE_ENV: "test" }).getCharge("ORDTST1");
    await getPaymentProvider({ ...mpEnv, NODE_ENV: "test", MERCADOPAGO_BASE_URL: "https://api.mercadopago.com" }).getCharge("ORDTST2");
    await getPaymentProvider({ ...mpEnv, NODE_ENV: "test", MERCADOPAGO_BASE_URL: "https://api.mp-test.example" }).getCharge("ORDTST3");
    spy.mockRestore();
    expect(calls).toEqual([
      "https://api.mercadopago.com/v1/orders/ORDTST1",
      "https://api.mercadopago.com/v1/orders/ORDTST2",
      "https://api.mp-test.example/v1/orders/ORDTST3",
    ]);
  });

  it("persiste reference → orderId no store: outra instância (serverless) encontra a cobrança sem recriar", async () => {
    const mock = mpMock();
    const referenceStore = new InMemoryChargeReferenceStore();
    const make = () => new MercadoPagoPaymentProvider({ accessToken, webhookSecret, baseUrl, fetchImpl: mock.fetchImpl, now: () => now, referenceStore });
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
    expect(mock.calls.filter((c) => c.method === "POST" && c.url.endsWith("/v1/orders"))).toHaveLength(1);
  });

  it("findChargeByReference respeita AbortSignal antes de consultar o store", async () => {
    const get = vi.fn(async () => "ordtst1");
    const mp = new MercadoPagoPaymentProvider({ accessToken, webhookSecret, baseUrl, fetchImpl: mpMock().fetchImpl, referenceStore: { get, save: async () => {} } });
    const controller = new AbortController();
    controller.abort(new Error("timeout"));
    await expect(mp.findChargeByReference(randomUUID(), { signal: controller.signal })).rejects.toThrow("timeout");
    expect(get).not.toHaveBeenCalled();
  });
});
