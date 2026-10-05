import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type * as schema from "../../db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getPaymentProvider } from "../../lib/payments";
import { processWebhook } from "../../lib/payments/webhook";
import {
  buildMercadoPagoManifest,
  centsToTransactionAmount,
  formatMercadoPagoDate,
  MERCADOPAGO_PIX_MIN_EXPIRATION_MS,
  MercadoPagoPaymentProvider,
  signMercadoPagoWebhook,
} from "../../lib/payments/mercadopago";

const accessToken = "TEST-access-token-not-real";
const webhookSecret = "test-only-mercadopago-webhook-secret-32chars";
const baseUrl = "https://api.mercadopago.com";
const now = new Date("2030-01-01T12:00:00.000Z");
const customer = { name: "Cliente Teste Silva", phone: "+5511999999999", cpfCnpj: "52998224725" };

type Call = { method: string; url: string; body?: Record<string, unknown>; headers?: Record<string, string> };
type Payment = {
  id: number;
  status: string;
  transaction_amount: number;
  external_reference: string;
  date_of_expiration: string;
  date_approved?: string | null;
  date_created: string;
  point_of_interaction: { transaction_data: { qr_code: string; qr_code_base64: string } };
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function mpMock() {
  const payments = new Map<string, Payment>();
  const byId = new Map<number, Payment>();
  let nextId = 1000;
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ method, url: url.toString(), body, headers });

    if (method === "POST" && url.pathname === "/v1/payments") {
      const reference = String(body?.external_reference);
      const existing = payments.get(reference);
      if (existing) return json(existing, 200); // idempotência nativa
      const id = ++nextId;
      const payment: Payment = {
        id,
        status: "pending",
        transaction_amount: Number(body?.transaction_amount),
        external_reference: reference,
        date_of_expiration: String(body?.date_of_expiration),
        date_created: now.toISOString(),
        date_approved: null,
        point_of_interaction: {
          transaction_data: {
            qr_code: `00020101021226-BRCODE-${reference}`,
            qr_code_base64: "aGVsbG8=", // fixture; provider regenera PNG do qr_code
          },
        },
      };
      payments.set(reference, payment);
      byId.set(id, payment);
      return json(payment, 201);
    }

    if (method === "GET" && url.pathname === "/v1/payments/search") {
      const ref = url.searchParams.get("external_reference") ?? "";
      const results = [...payments.values()].filter((p) => p.external_reference === ref);
      return json({ results, paging: { total: results.length, offset: 0, limit: 30 } });
    }

    const getMatch = /^\/v1\/payments\/(\d+)$/.exec(url.pathname);
    if (getMatch && method === "GET") {
      const payment = byId.get(Number(getMatch[1]));
      if (!payment) return json({ message: "not found" }, 404);
      return json(payment);
    }
    if (getMatch && method === "PUT") {
      const payment = byId.get(Number(getMatch[1]));
      if (!payment) return json({ message: "not found" }, 404);
      if (payment.status === "approved") return json({ message: "invalid status" }, 400);
      payment.status = "cancelled";
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
  it("cria Pix com X-Idempotency-Key=payment.id, external_reference, CPF e QR", async () => {
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
      date_of_expiration: formatMercadoPagoDate(expiresAt),
      payer: {
        email: "cpf52998224725@pagador.agendapix.invalid",
        first_name: "Cliente",
        last_name: "Teste Silva",
        identification: { type: "CPF", number: "52998224725" },
      },
    });
    expect(centsToTransactionAmount(1000)).toBe(10);
    // search (lookup) antes do POST
    expect(mock.calls.map((c) => c.method)).toEqual(["GET", "POST"]);
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
    const expected = formatMercadoPagoDate(new Date(now.getTime() + MERCADOPAGO_PIX_MIN_EXPIRATION_MS));
    expect(mock.calls.find((c) => c.method === "POST")!.body).toMatchObject({ date_of_expiration: expected });
  });

  it("retry sem pagador recupera cobrança existente via external_reference", async () => {
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

  it("consulta, localiza por external_reference, mapeia status e cancela pendente", async () => {
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
    expect(await mp.cancelCharge(created.externalId)).toMatchObject({ status: "cancelled" });

    const paidRef = randomUUID();
    const paid = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference: paidRef, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    Object.assign(mock.byId.get(Number(paid.externalId))!, {
      status: "approved",
      date_approved: "2030-01-01T12:01:00.000Z",
    });
    expect(await mp.cancelCharge(paid.externalId)).toMatchObject({ status: "paid" });
    expect(mock.calls.some((c) => c.method === "PUT" && c.url.endsWith(`/${paid.externalId}`))).toBe(false);
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
});

const untouchable = new Proxy({}, {
  get(_t, property) { throw new Error(`banco acessado: ${String(property)}`); },
}) as NodePgDatabase<typeof schema>;

describe("MercadoPagoPaymentProvider: webhook", () => {
  it("valida x-signature HMAC e normaliza payment.approved via GET", async () => {
    const { mock, mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1500,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    Object.assign(mock.byId.get(Number(created.externalId))!, {
      status: "approved",
      date_approved: "2030-01-01T12:05:00.000Z",
    });
    const body = JSON.stringify({
      id: 999001,
      type: "payment",
      action: "payment.updated",
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
    const body = JSON.stringify({ id: 1, type: "payment", action: "payment.updated", data: { id: "1" } });
    const request = new Request("http://localhost/api/webhooks/payments/mercadopago?data.id=1&type=payment", {
      method: "POST", body, headers: headers("1"),
    });
    await expect(processWebhook(request, "mercadopago", untouchable, mp, now)).rejects.toMatchObject({
      status: 401, code: "invalid_signature",
    });
  });

  it("payment.pending autenticado responde ignored sem tocar no banco", async () => {
    const { mp } = provider();
    const reference = randomUUID();
    const created = await mp.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000), customer,
    });
    const body = JSON.stringify({
      id: 42, type: "payment", action: "payment.created", data: { id: created.externalId },
    });
    const request = new Request(
      `http://localhost/api/webhooks/payments/mercadopago?data.id=${created.externalId}&type=payment`,
      { method: "POST", body, headers: signedHeaders(created.externalId) },
    );
    await expect(processWebhook(request, "mercadopago", untouchable, mp, now)).resolves.toEqual({
      outcome: "ignored", reason: "unsupported_event",
    });
  });

  it("tipo merchant_order autenticado → ignored", async () => {
    const { mp } = provider();
    const body = JSON.stringify({ id: 7, type: "merchant_order", action: "updated", data: { id: "99" } });
    const request = new Request(
      "http://localhost/api/webhooks/payments/mercadopago?data.id=99&type=merchant_order",
      { method: "POST", body, headers: signedHeaders("99") },
    );
    await expect(processWebhook(request, "mercadopago", untouchable, mp, now)).resolves.toEqual({
      outcome: "ignored", reason: "unsupported_event",
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
    await getPaymentProvider({ ...mpEnv, NODE_ENV: "test" }).getCharge("1");
    await getPaymentProvider({ ...mpEnv, NODE_ENV: "test", MERCADOPAGO_BASE_URL: "https://api.mercadopago.com" }).getCharge("2");
    await getPaymentProvider({ ...mpEnv, NODE_ENV: "test", MERCADOPAGO_BASE_URL: "https://api.mp-test.example" }).getCharge("3");
    spy.mockRestore();
    expect(calls).toEqual([
      "https://api.mercadopago.com/v1/payments/1",
      "https://api.mercadopago.com/v1/payments/2",
      "https://api.mp-test.example/v1/payments/3",
    ]);
  });
});
