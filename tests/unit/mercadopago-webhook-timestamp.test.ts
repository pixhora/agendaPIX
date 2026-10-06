import { describe, expect, it } from "vitest";
import { MercadoPagoPaymentProvider, buildMercadoPagoManifest, signMercadoPagoWebhook } from "../../lib/payments/mercadopago";

const accessToken = "TEST_1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdef";
const webhookSecret = "test-webhook-secret-at-least-32-characters-long";

function mockFetch(): Promise<Response> {
  return Promise.reject(new Error("Network should not be called in this test"));
}

const provider = new MercadoPagoPaymentProvider({
  accessToken,
  webhookSecret,
  env: "sandbox",
  fetchImpl: mockFetch,
});

function buildSignedRequest(timestampSeconds: number, body: string) {
  const ts = String(timestampSeconds);
  const dataId = "ordtst123";
  const requestId = "req-abc";
  const manifest = buildMercadoPagoManifest({ dataId, requestId, ts });
  const signature = signMercadoPagoWebhook(manifest, webhookSecret);
  
  const headers = new Headers({
    "x-signature": `ts=${ts},v1=${signature}`,
    "x-request-id": requestId,
    "content-type": "application/json",
  });

  return { body, headers, url: `http://localhost/api/webhooks/payments/mercadopago?data.id=${dataId}` };
}

const validBody = JSON.stringify({
  id: 12345,
  type: "order",
  action: "payment.updated",
  data: { id: "ordtst123" },
});

describe("Mercado Pago webhook timestamp validation", () => {
  it("aceita timestamp dentro de 5 minutos (300s) no passado", async () => {
    const now = new Date("2030-01-01T12:00:00Z");
    const timestampSeconds = Math.floor(now.getTime() / 1000) - 299; // 299s atrás
    const request = buildSignedRequest(timestampSeconds, validBody);
    
    // verifyWebhook vai falhar porque não temos o order no DB, mas o timestamp deve passar
    await expect(
      provider.verifyWebhook(request.body, request.headers, now, request.url)
    ).rejects.toThrow(); // Falha por outro motivo (order não existe)
    
    // Verifica que não é erro de timestamp
    await expect(
      provider.verifyWebhook(request.body, request.headers, now, request.url)
    ).rejects.not.toMatchObject({ code: "invalid_signature" });
  });

  it("aceita timestamp dentro de 5 minutos (300s) no futuro", async () => {
    const now = new Date("2030-01-01T12:00:00Z");
    const timestampSeconds = Math.floor(now.getTime() / 1000) + 299; // 299s à frente
    const request = buildSignedRequest(timestampSeconds, validBody);
    
    await expect(
      provider.verifyWebhook(request.body, request.headers, now, request.url)
    ).rejects.toThrow(); // Falha por outro motivo (order não existe)
    
    await expect(
      provider.verifyWebhook(request.body, request.headers, now, request.url)
    ).rejects.not.toMatchObject({ code: "invalid_signature" });
  });

  it("rejeita timestamp mais de 5 minutos (301s) no passado", async () => {
    const now = new Date("2030-01-01T12:00:00Z");
    const timestampSeconds = Math.floor(now.getTime() / 1000) - 301; // 301s atrás
    const request = buildSignedRequest(timestampSeconds, validBody);
    
    await expect(
      provider.verifyWebhook(request.body, request.headers, now, request.url)
    ).rejects.toMatchObject({
      status: 401,
      code: "invalid_signature",
      message: expect.stringContaining("inválida ou vencida"),
    });
  });

  it("rejeita timestamp mais de 5 minutos (301s) no futuro", async () => {
    const now = new Date("2030-01-01T12:00:00Z");
    const timestampSeconds = Math.floor(now.getTime() / 1000) + 301; // 301s à frente
    const request = buildSignedRequest(timestampSeconds, validBody);
    
    await expect(
      provider.verifyWebhook(request.body, request.headers, now, request.url)
    ).rejects.toMatchObject({
      status: 401,
      code: "invalid_signature",
      message: expect.stringContaining("inválida ou vencida"),
    });
  });

  it("rejeita timestamp não numérico", async () => {
    const now = new Date("2030-01-01T12:00:00Z");
    const body = validBody;
    const ts = "invalid-timestamp";
    const dataId = "ordtst123";
    const requestId = "req-abc";
    const manifest = buildMercadoPagoManifest({ dataId, requestId, ts });
    const signature = signMercadoPagoWebhook(manifest, webhookSecret);
    
    const headers = new Headers({
      "x-signature": `ts=${ts},v1=${signature}`,
      "x-request-id": requestId,
      "content-type": "application/json",
    });

    await expect(
      provider.verifyWebhook(body, headers, now, `http://localhost/api/webhooks/payments/mercadopago?data.id=${dataId}`)
    ).rejects.toMatchObject({
      status: 401,
      code: "invalid_signature",
    });
  });

  it("aceita exatamente no limite de 300s (5 minutos)", async () => {
    const now = new Date("2030-01-01T12:00:00Z");
    const timestampSeconds = Math.floor(now.getTime() / 1000) - 300; // exatos 300s
    const request = buildSignedRequest(timestampSeconds, validBody);
    
    // Deve passar a validação de timestamp
    await expect(
      provider.verifyWebhook(request.body, request.headers, now, request.url)
    ).rejects.toThrow(); // Falha por outro motivo, não timestamp
    
    await expect(
      provider.verifyWebhook(request.body, request.headers, now, request.url)
    ).rejects.not.toMatchObject({ code: "invalid_signature" });
  });
});
