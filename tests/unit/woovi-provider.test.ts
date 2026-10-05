import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type * as schema from "../../db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getPaymentProvider } from "../../lib/payments";
import { processWebhook } from "../../lib/payments/webhook";
import { signWooviWebhook, WooviPaymentProvider } from "../../lib/payments/woovi";

const appId = "test-app-id-not-real";
const webhookSecret = "test-only-woovi-webhook-secret-32-characters";
const baseUrl = "https://api.woovi-sandbox.com";
const now = new Date("2030-01-01T12:00:00Z");
// CPF matematicamente válido, inventado só para mock (nunca enviado a API real).
const customer = { name: "Cliente Teste", phone: "+5511999999999", cpfCnpj: "52998224725" };

type Call = { method: string; url: string; body?: Record<string, unknown>; auth?: string };
type Charge = { correlationID: string; value: number; status: "ACTIVE" | "COMPLETED" | "EXPIRED"; brCode: string; expiresDate: string; paidAt?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

/** Gateway Woovi simulado em memória: fixtures de resposta nos formatos documentados. */
function wooviMock() {
  const charges = new Map<string, Charge>();
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ method, url: url.toString(), body, auth: (init?.headers as Record<string, string>)?.Authorization });
    if (method === "POST" && url.pathname === "/api/v1/charge") {
      const id = String(body?.correlationID);
      if (charges.has(id)) return json({ error: "correlationID already exists" }, 400);
      const charge: Charge = { correlationID: id, value: Number(body?.value), status: "ACTIVE", brCode: `00020101021226-BRCODE-${id}`,
        expiresDate: new Date(now.getTime() + Number(body?.expiresIn) * 1000).toISOString() };
      charges.set(id, charge);
      return json({ charge: { ...charge, qrCodeImage: `https://api.woovi.com/openpix/charge/brcode/image/${id}.png` }, correlationID: id, brCode: charge.brCode });
    }
    const match = /^\/api\/v1\/charge\/(.+)$/.exec(url.pathname);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const charge = charges.get(id);
      if (!charge) return json({ error: "Charge not found" }, 404);
      if (method === "GET") return json({ charge });
      if (method === "DELETE") { charges.delete(id); return json({ status: "OK", id }); }
    }
    return json({ error: "unexpected" }, 500);
  });
  return { charges, calls, fetchImpl };
}

function provider(mock = wooviMock(), extra: { webhookPublicKeyPem?: string } = {}) {
  return { mock, woovi: new WooviPaymentProvider({ appId, baseUrl, webhookSecret, fetchImpl: mock.fetchImpl, now: () => now, ...extra }) };
}

describe("WooviPaymentProvider: cobrança", () => {
  it("cria cobrança com correlationID = payment.id, valor em centavos, expiresIn do hold e brCode", async () => {
    const { mock, woovi } = provider();
    const reference = randomUUID();
    const charge = await woovi.createPixCharge({ idempotencyKey: randomUUID(), reference, amountCents: 1000, expiresAt: new Date(now.getTime() + 600_000), customer });
    expect(charge).toMatchObject({ externalId: reference, amountCents: 1000, copyPaste: `00020101021226-BRCODE-${reference}` });
    expect(charge.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    const post = mock.calls.find((call) => call.method === "POST")!;
    expect(post.auth).toBe(appId);
    expect(post.body).toMatchObject({ correlationID: reference, value: 1000, expiresIn: 600, customer: { name: "Cliente Teste", taxID: "52998224725", phone: "5511999999999" } });
    // Consulta por referência acontece antes do POST.
    expect(mock.calls.map((call) => call.method)).toEqual(["GET", "POST"]);
  });

  it("respeita o mínimo de 5 minutos da Woovi", async () => {
    const { mock, woovi } = provider();
    await woovi.createPixCharge({ idempotencyKey: randomUUID(), reference: randomUUID(), amountCents: 500, expiresAt: new Date(now.getTime() + 120_000) });
    expect(mock.calls.find((call) => call.method === "POST")!.body).toMatchObject({ expiresIn: 300 });
  });

  it("retry sem dados do pagador recupera a cobrança existente sem criar outra", async () => {
    const { mock, woovi } = provider();
    const reference = randomUUID();
    const first = await woovi.createPixCharge({ idempotencyKey: randomUUID(), reference, amountCents: 1000, expiresAt: new Date(now.getTime() + 600_000), customer });
    // Ex.: reconciliador retomando creating preso, que não conhece o CPF.
    const retry = await woovi.createPixCharge({ idempotencyKey: randomUUID(), reference, amountCents: 1000, expiresAt: new Date(now.getTime() + 600_000) });
    expect(retry).toEqual(first);
    expect(mock.calls.filter((call) => call.method === "POST")).toHaveLength(1);
    await expect(woovi.createPixCharge({ idempotencyKey: randomUUID(), reference, amountCents: 2000, expiresAt: new Date(now.getTime() + 600_000) })).rejects.toThrow("idempotência");
  });

  it("cria sem customer quando não há CPF (Woovi não exige pagador)", async () => {
    const { mock, woovi } = provider();
    await woovi.createPixCharge({ idempotencyKey: randomUUID(), reference: randomUUID(), amountCents: 1000, expiresAt: new Date(now.getTime() + 600_000) });
    expect(mock.calls.find((call) => call.method === "POST")!.body).not.toHaveProperty("customer");
  });

  it("consulta, localiza por referência, mapeia status e cancela pendente sem tocar em paga", async () => {
    const { mock, woovi } = provider();
    const reference = randomUUID();
    await woovi.createPixCharge({ idempotencyKey: randomUUID(), reference, amountCents: 1000, expiresAt: new Date(now.getTime() + 600_000) });
    expect(await woovi.getCharge(reference)).toMatchObject({ externalId: reference, reference, status: "pending", paidAt: null });
    expect(await woovi.findChargeByReference(reference)).toMatchObject({ status: "pending" });
    expect(await woovi.findChargeByReference(randomUUID())).toBeNull();
    expect(await woovi.cancelCharge(reference)).toMatchObject({ status: "cancelled" });
    expect(mock.charges.has(reference)).toBe(false);
    expect(await woovi.cancelCharge(reference)).toBeNull();

    const paid = randomUUID();
    await woovi.createPixCharge({ idempotencyKey: randomUUID(), reference: paid, amountCents: 1000, expiresAt: new Date(now.getTime() + 600_000) });
    Object.assign(mock.charges.get(paid)!, { status: "COMPLETED", paidAt: "2030-01-01T12:01:00.000Z" });
    expect(await woovi.cancelCharge(paid)).toMatchObject({ status: "paid", paidAt: new Date("2030-01-01T12:01:00.000Z") });
    expect(mock.calls.some((call) => call.method === "DELETE" && call.url.endsWith(paid))).toBe(false);

    const expired = randomUUID();
    await woovi.createPixCharge({ idempotencyKey: randomUUID(), reference: expired, amountCents: 1000, expiresAt: new Date(now.getTime() + 600_000) });
    mock.charges.get(expired)!.status = "EXPIRED";
    expect(await woovi.getCharge(expired)).toMatchObject({ status: "expired" });
  });

  it("propaga AbortSignal e erros 5xx", async () => {
    const { woovi } = provider();
    const controller = new AbortController();
    controller.abort(new Error("timeout"));
    await expect(woovi.getCharge("x", { signal: controller.signal })).rejects.toThrow("timeout");
    const failing = new WooviPaymentProvider({ appId, baseUrl, webhookSecret, fetchImpl: async () => json({ error: "boom" }, 503) });
    await expect(failing.getCharge("x")).rejects.toThrow("503");
  });
});

const completed = (correlationID = randomUUID(), extra: Record<string, unknown> = {}) => JSON.stringify({
  event: "OPENPIX:CHARGE_COMPLETED",
  charge: { correlationID, value: 1000, status: "COMPLETED", paidAt: "2030-01-01T11:59:00.000Z" },
  pix: { time: "2030-01-01T11:59:00.000Z", value: 1000, endToEndId: "E000" },
  ...extra,
});
const untouchable = new Proxy({}, { get(_target, property) { throw new Error(`banco acessado: ${String(property)}`); } }) as NodePgDatabase<typeof schema>;

describe("WooviPaymentProvider: webhook", () => {
  it("aceita HMAC válido e normaliza CHARGE_COMPLETED", async () => {
    const { woovi } = provider();
    const id = randomUUID();
    const body = completed(id);
    const event = await woovi.verifyWebhook(body, new Headers({ "x-openpix-signature": signWooviWebhook(body, webhookSecret) }), now);
    expect(event).toEqual({ eventId: `CHARGE_COMPLETED:${id}`, type: "payment.paid", externalId: id, amountCents: 1000, paidAt: "2030-01-01T11:59:00.000Z" });
  });

  it.each([
    ["sem assinatura", () => new Headers()],
    ["assinatura de outro segredo", (body: string) => new Headers({ "x-openpix-signature": signWooviWebhook(body, "another-secret-another-secret-123") })],
    ["assinatura malformada", () => new Headers({ "x-openpix-signature": "abc" })],
  ])("rejeita %s com 401 antes de qualquer escrita", async (_name, headers) => {
    const { woovi } = provider();
    const body = completed();
    const request = new Request("http://localhost/api/webhooks/payments/woovi", { method: "POST", body, headers: headers(body) });
    await expect(processWebhook(request, "woovi", untouchable, woovi, now)).rejects.toMatchObject({ status: 401, code: "invalid_signature" });
  });

  it("corpo adulterado invalida o HMAC", async () => {
    const { woovi } = provider();
    const body = completed();
    expect(() => woovi.verifyWebhook(body.replace("1000", "1"), new Headers({ "x-openpix-signature": signWooviWebhook(body, webhookSecret) }), now)).toThrow("Assinatura inválida");
  });

  it("evento autenticado que não é pagamento (teste do painel) responde ignored sem tocar no banco", async () => {
    const { woovi } = provider();
    const body = JSON.stringify({ evento: "teste_webhook", event: "OPENPIX:CHARGE_CREATED" });
    const request = new Request("http://localhost/api/webhooks/payments/woovi", { method: "POST", body, headers: { "x-openpix-signature": signWooviWebhook(body, webhookSecret) } });
    await expect(processWebhook(request, "woovi", untouchable, woovi, now)).resolves.toEqual({ outcome: "ignored", reason: "unsupported_event" });
  });

  it("CHARGE_COMPLETED assinado mas malformado → 400", async () => {
    const { woovi } = provider();
    const body = JSON.stringify({ event: "OPENPIX:CHARGE_COMPLETED", charge: { correlationID: "x", value: 1.5 } });
    const request = new Request("http://localhost/api/webhooks/payments/woovi", { method: "POST", body, headers: { "x-openpix-signature": signWooviWebhook(body, webhookSecret) } });
    await expect(processWebhook(request, "woovi", untouchable, woovi, now)).rejects.toMatchObject({ status: 400, code: "invalid_event" });
  });

  it("com chave pública configurada exige também x-webhook-signature RSA-SHA256", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const { woovi } = provider(wooviMock(), { webhookPublicKeyPem: pem });
    const body = completed();
    const hmac = signWooviWebhook(body, webhookSecret);
    const rsa = sign("sha256", Buffer.from(body), privateKey).toString("base64");
    expect(await woovi.verifyWebhook(body, new Headers({ "x-openpix-signature": hmac, "x-webhook-signature": rsa }), now)).toMatchObject({ type: "payment.paid" });
    expect(() => woovi.verifyWebhook(body, new Headers({ "x-openpix-signature": hmac }), now)).toThrow("Assinatura inválida");
    expect(() => woovi.verifyWebhook(body, new Headers({ "x-openpix-signature": hmac, "x-webhook-signature": rsa.replace(/^./, "A") }), now)).toThrow("Assinatura inválida");
  });
});

describe("seleção do provedor", () => {
  const woovi = { PAYMENT_PROVIDER: "woovi", WOOVI_AUTH_TOKEN: appId, WOOVI_WEBHOOK_SECRET: webhookSecret };
  it("woovi em produção com envs; fake recusado em produção; fake é o padrão fora de produção", () => {
    expect(getPaymentProvider({ ...woovi, NODE_ENV: "production" }).name).toBe("woovi");
    expect(() => getPaymentProvider({ ...woovi, NODE_ENV: "production", WOOVI_AUTH_TOKEN: "" })).toThrow("Cobrança indisponível");
    expect(() => getPaymentProvider({ ...woovi, NODE_ENV: "production", WOOVI_WEBHOOK_SECRET: "replace-this-with-the-woovi-webhook-secret-32-characters" })).toThrow("Cobrança indisponível");
    expect(() => getPaymentProvider({ NODE_ENV: "production", PAYMENT_PROVIDER: "fake", FAKE_WEBHOOK_SECRET: webhookSecret })).toThrow("Cobrança indisponível");
    expect(() => getPaymentProvider({ NODE_ENV: "production" })).toThrow("Cobrança indisponível");
    expect(getPaymentProvider({ NODE_ENV: "test", FAKE_WEBHOOK_SECRET: webhookSecret }).name).toBe("fake");
    expect(() => getPaymentProvider({ NODE_ENV: "test", PAYMENT_PROVIDER: "asaas" })).toThrow("Cobrança indisponível");
  });
  it("WOOVI_ENV escolhe a URL base e WOOVI_BASE_URL sobrescreve", async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => { calls.push(String(input)); return json({ error: "Charge not found" }, 404); });
    await getPaymentProvider({ ...woovi, NODE_ENV: "test" }).getCharge("a");
    await getPaymentProvider({ ...woovi, NODE_ENV: "test", WOOVI_ENV: "production" }).getCharge("b");
    await getPaymentProvider({ ...woovi, NODE_ENV: "test", WOOVI_BASE_URL: "https://api.openpix.com.br" }).getCharge("c");
    spy.mockRestore();
    expect(calls).toEqual(["https://api.woovi-sandbox.com/api/v1/charge/a", "https://api.woovi.com/api/v1/charge/b", "https://api.openpix.com.br/api/v1/charge/c"]);
  });
});
