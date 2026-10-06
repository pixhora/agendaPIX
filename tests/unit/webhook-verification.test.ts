import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import type * as schema from "../../db/schema";
import { FakePaymentProvider, signFakeWebhook } from "../../lib/payments/fake";
import { processWebhook, verifyWebhookDelivery } from "../../lib/payments/webhook";

const secret = "test-only-fake-webhook-secret-32-characters";
const provider = new FakePaymentProvider(secret);
const now = new Date("2030-01-01T12:00:00Z");
const timestamp = String(now.getTime() / 1000);
const event = () => ({ eventId: randomUUID(), type: "payment.paid", externalId: "fake_x", amountCents: 1000, paidAt: now.toISOString() });

// Qualquer acesso ao banco falha o teste: prova que entregas rejeitadas não escrevem nada.
const untouchable = new Proxy({}, { get(_target, property) { throw new Error(`banco acessado: ${String(property)}`); } }) as NodePgDatabase<typeof schema>;

function signed(body: string, extra: Record<string, string> = {}) {
  return new Request("http://localhost/api/webhooks/payments/fake", { method: "POST", body, headers: {
    "content-type": "application/json", "x-fake-timestamp": timestamp, "x-fake-signature": signFakeWebhook(body, timestamp, secret), ...extra,
  } });
}

describe("webhook valida antes de persistir", () => {
  it.each([
    ["sem assinatura", () => new Request("http://localhost/x", { method: "POST", body: JSON.stringify(event()) }), 401, "invalid_signature"],
    ["assinatura de outro corpo", () => { const body = JSON.stringify(event()); return new Request("http://localhost/x", { method: "POST", body: body.replace("1000", "9999"), headers: { "x-fake-timestamp": timestamp, "x-fake-signature": signFakeWebhook(body, timestamp, secret) } }); }, 401, "invalid_signature"],
    ["timestamp vencido", () => { const body = JSON.stringify(event()); const old = String(Number(timestamp) - 301); return new Request("http://localhost/x", { method: "POST", body, headers: { "x-fake-timestamp": old, "x-fake-signature": signFakeWebhook(body, old, secret) } }); }, 401, "invalid_signature"],
    ["JSON inválido assinado", () => signed("{not json"), 400, "invalid_event"],
    ["formato inválido assinado", () => signed(JSON.stringify({ ...event(), amountCents: 1.5 })), 400, "invalid_event"],
    ["campo extra assinado", () => signed(JSON.stringify({ ...event(), ownerId: "other" })), 400, "invalid_event"],
    ["corpo acima de 16 KiB", () => signed("x".repeat(16385)), 413, "body_too_large"],
    ["Content-Length declarado acima do limite", () => signed("{}", { "content-length": "999999" }), 413, "body_too_large"],
  ])("%s → %i sem tocar no banco", async (_name, build, status, code) => {
    await expect(processWebhook(build(), "fake", untouchable, provider, now)).rejects.toMatchObject({ status, code });
  });
  it("provedor desconhecido → 404 sem ler corpo nem tocar no banco", async () => {
    const request = signed(JSON.stringify(event()));
    await expect(processWebhook(request, "asaas", untouchable, provider, now)).rejects.toMatchObject({ status: 404 });
    expect(request.bodyUsed).toBe(false);
  });
  it("entrega válida devolve evento e hashes, sem guardar assinatura ou corpo bruto", async () => {
    const body = JSON.stringify(event());
    const verified = await verifyWebhookDelivery(signed(body), "fake", provider, undefined, now);
    expect(verified.provider).toBe("fake");
    expect(verified.bodyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(verified.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(verified)).not.toContain(signFakeWebhook(body, timestamp, secret));
  });
});
