import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AsaasPaymentProvider } from "../../lib/payments/asaas";
import { getPaymentProvider } from "../../lib/payments";
import { HttpError } from "../../lib/http";

const webhookToken = "test-asaas-webhook-token-with-32-chars!!";
const apiKey = "$aact_test_key_not_real";
const customer = { name: "Cliente Teste", phone: "+5511999999999", cpfCnpj: "52998224725" };
const expiresAt = new Date("2030-01-01T12:15:00Z");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function provider(fetchImpl: typeof fetch) {
  return new AsaasPaymentProvider({ apiKey, env: "sandbox", webhookToken, fetchImpl });
}

describe("AsaasPaymentProvider", () => {
  it("cria cobrança Pix com customer + externalReference e emula idempotência via find", async () => {
    const calls: { method?: string; url: string; body?: string }[] = [];
    const paymentId = "pay_test_1";
    const reference = randomUUID();
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      calls.push({ method: init?.method, url, body: typeof init?.body === "string" ? init.body : undefined });
      if (url.includes("/v3/payments?") && url.includes("externalReference")) return json({ data: [] });
      if (url.includes("/v3/customers?") && url.includes("cpfCnpj")) return json({ data: [] });
      if (url.endsWith("/v3/customers") && init?.method === "POST") return json({ id: "cus_test_1" });
      if (url.endsWith("/v3/payments") && init?.method === "POST") {
        return json({ id: paymentId, value: 10, status: "PENDING", dueDate: "2030-01-01", externalReference: reference });
      }
      if (url.endsWith(`/v3/payments/${paymentId}/pixQrCode`)) {
        return json({ encodedImage: "aaa", payload: "PIX-COPIA-E-COLA-TESTE", expirationDate: "2030-01-01 12:15:00" });
      }
      if (url.includes("/v3/payments?") && url.includes("externalReference")) {
        return json({ data: [{ id: paymentId, value: 10, status: "PENDING", dueDate: "2030-01-01", externalReference: reference }] });
      }
      return json({ errors: [{ code: "not_found", description: "x" }] }, 404);
    }) as unknown as typeof fetch;

    const asaas = provider(fetchImpl);
    const first = await asaas.createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000, expiresAt, customer,
    });
    expect(first.externalId).toBe(paymentId);
    expect(first.copyPaste).toBe("PIX-COPIA-E-COLA-TESTE");
    expect(first.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(calls.some((call) => call.method === "POST" && call.url.endsWith("/v3/payments") && call.body?.includes(reference))).toBe(true);

    // Segunda chamada: find encontra a cobrança e não cria de novo.
    let createdAgain = false;
    const fetchImpl2 = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v3/payments?") && url.includes("externalReference")) {
        return json({ data: [{ id: paymentId, value: 10, status: "PENDING", dueDate: "2030-01-01", externalReference: reference }] });
      }
      if (url.endsWith(`/v3/payments/${paymentId}/pixQrCode`)) {
        return json({ encodedImage: "aaa", payload: "PIX-COPIA-E-COLA-TESTE", expirationDate: "2030-01-01 12:15:00" });
      }
      if (url.endsWith("/v3/payments") && init?.method === "POST") {
        createdAgain = true;
        return json({ id: "pay_dup", value: 10, status: "PENDING", dueDate: "2030-01-01", externalReference: reference });
      }
      throw new Error(`unexpected ${init?.method} ${url}`);
    }) as unknown as typeof fetch;
    const second = await provider(fetchImpl2).createPixCharge({
      idempotencyKey: randomUUID(), reference, amountCents: 1000, expiresAt, customer,
    });
    expect(second.externalId).toBe(paymentId);
    expect(createdAgain).toBe(false);
  });

  it("exige CPF do customer e não inventa documento", async () => {
    const asaas = provider(vi.fn(async () => json({})) as unknown as typeof fetch);
    await expect(asaas.createPixCharge({
      idempotencyKey: randomUUID(), reference: randomUUID(), amountCents: 1000, expiresAt,
    })).rejects.toMatchObject({ code: "cpf_required" });
  });

  it("consulta, localiza por referência e cancela pendente sem alterar pago", async () => {
    const paymentId = "pay_cancel";
    const reference = randomUUID();
    const state = { status: "PENDING", deleted: false };
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("externalReference")) {
        return json({ data: [{ id: paymentId, value: 25.5, status: state.status, dueDate: "2030-01-01", externalReference: reference, deleted: state.deleted }] });
      }
      if (url.endsWith(`/v3/payments/${paymentId}`) && (!init?.method || init.method === "GET")) {
        return json({ id: paymentId, value: 25.5, status: state.status, dueDate: "2030-01-01", externalReference: reference, deleted: state.deleted });
      }
      if (url.endsWith(`/v3/payments/${paymentId}`) && init?.method === "DELETE") {
        state.deleted = true;
        state.status = "PENDING";
        return json({ id: paymentId, deleted: true });
      }
      if (url.endsWith(`/pixQrCode`)) return json({ encodedImage: "bbb", payload: "PIX", expirationDate: "2030-01-01 12:15:00" });
      return json({}, 404);
    }) as unknown as typeof fetch;
    const asaas = provider(fetchImpl);
    expect(await asaas.findChargeByReference(reference)).toMatchObject({ externalId: paymentId, amountCents: 2550, status: "pending" });
    expect(await asaas.getCharge(paymentId)).toMatchObject({ reference, status: "pending" });
    expect(await asaas.cancelCharge(paymentId)).toMatchObject({ status: "cancelled" });

    state.deleted = false;
    state.status = "RECEIVED";
    expect(await asaas.cancelCharge(paymentId)).toMatchObject({ status: "paid" });
  });

  it("webhook aceita token e eventos pagos; rejeita token inválido", async () => {
    const asaas = provider(vi.fn(async () => json({})) as unknown as typeof fetch);
    const now = new Date("2030-01-01T12:00:00Z");
    const body = JSON.stringify({
      id: "evt_1",
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_1", value: 10.5, status: "RECEIVED", paymentDate: "2030-01-01", confirmedDate: "2030-01-01" },
    });
    const ok = await asaas.verifyWebhook(body, new Headers({ "asaas-access-token": webhookToken }), now);
    expect(ok).toMatchObject({ eventId: "evt_1", type: "payment.paid", externalId: "pay_1", amountCents: 1050 });

    const confirmed = JSON.stringify({
      id: "evt_2",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_2", value: 10, status: "CONFIRMED", confirmedDate: "2030-01-01" },
    });
    expect(await asaas.verifyWebhook(confirmed, new Headers({ "asaas-access-token": webhookToken }), now)).toMatchObject({ eventId: "evt_2", externalId: "pay_2" });

    await expect(asaas.verifyWebhook(body, new Headers({ "asaas-access-token": "wrong-token-wrong-token-wrong-token!!" }), now))
      .rejects.toBeInstanceOf(HttpError);
    await expect(asaas.verifyWebhook(body, new Headers(), now)).rejects.toMatchObject({ code: "invalid_signature" });
    await expect(asaas.verifyWebhook(JSON.stringify({ id: "evt_x", event: "PAYMENT_CREATED", payment: { id: "pay_x" } }), new Headers({ "asaas-access-token": webhookToken }), now))
      .rejects.toMatchObject({ code: "invalid_event" });
  });
});

describe("seleção getPaymentProvider", () => {
  it("aceita asaas com envs e recusa fake em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_PROVIDER", "fake");
    vi.stubEnv("FAKE_WEBHOOK_SECRET", "test-only-fake-webhook-secret-32-characters");
    expect(() => getPaymentProvider()).toThrow("Cobrança indisponível");

    vi.stubEnv("PAYMENT_PROVIDER", "asaas");
    vi.stubEnv("ASAAS_API_KEY", apiKey);
    vi.stubEnv("ASAAS_ENV", "sandbox");
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", webhookToken);
    expect(getPaymentProvider().name).toBe("asaas");

    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PAYMENT_PROVIDER", "fake");
    vi.stubEnv("FAKE_WEBHOOK_SECRET", "test-only-fake-webhook-secret-32-characters");
    expect(getPaymentProvider().name).toBe("fake");
    vi.unstubAllEnvs();
  });
});
