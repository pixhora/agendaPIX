import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { FakePaymentProvider, signFakeWebhook } from "../../lib/payments/fake";
import { getPaymentProvider } from "../../lib/payments";
import { decidePaidEvent } from "../../lib/payments/rules";
import { paidEventSchema } from "../../lib/payments/provider";

const secret = "test-only-fake-webhook-secret-32-characters";
const now = new Date("2030-01-01T12:00:00Z");
const provider = new FakePaymentProvider(secret);
const event = { eventId: "event-1", type: "payment.paid" as const, externalId: "fake-1", amountCents: 1000, paidAt: now.toISOString() };
const payment = { amountCents: 1000, status: "pending", expiresAt: new Date("2030-01-01T12:15:00Z") };
const booking = { depositCents: 1000, status: "pending_payment", expiresAt: payment.expiresAt, startsAt: new Date("2030-01-01T13:00:00Z") };
function headers(body: string, timestamp = String(now.getTime() / 1000)) {
  return new Headers({ "x-fake-timestamp": timestamp, "x-fake-signature": signFakeWebhook(body, timestamp, secret) });
}

describe("provider fake e assinatura", () => {
  it("gera QR Code e copia-e-cola determinísticos e explicitamente fictícios", async () => {
    const input = { idempotencyKey: randomUUID(), amountCents: 1000, expiresAt: payment.expiresAt };
    const first = await provider.createPixCharge(input);
    expect(first).toEqual(await provider.createPixCharge(input));
    expect(first.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(first.copyPaste).toContain("FAKE-PIX-NOT-PAYABLE");
    expect(first.amountCents).toBe(1000);
  });
  it.each([0, -1, 0.1, 2147483648])("não cobra %s centavos", async (amountCents) => {
    await expect(provider.createPixCharge({ idempotencyKey: randomUUID(), amountCents, expiresAt: payment.expiresAt })).rejects.toThrow();
  });
  it("aceita somente corpo original assinado", () => {
    const body = JSON.stringify(event);
    expect(provider.verifyWebhook(body, headers(body), now)).toEqual(event);
    expect(() => provider.verifyWebhook(body.replace("1000", "1001"), headers(body), now)).toThrow("Assinatura inválida");
  });
  it.each([new Headers(), new Headers({ "x-fake-timestamp": String(now.getTime() / 1000), "x-fake-signature": "a" })])("rejeita assinatura ausente ou malformada", (value) => {
    expect(() => provider.verifyWebhook(JSON.stringify(event), value, now)).toThrow("Assinatura inválida");
  });
  it.each([-301, 301])("rejeita timestamp distante %s segundos", (seconds) => {
    const body = JSON.stringify(event);
    expect(() => provider.verifyWebhook(body, headers(body, String(now.getTime() / 1000 + seconds)), now)).toThrow("Assinatura inválida");
  });
  it("valida o evento após autenticar", () => {
    const body = JSON.stringify({ ...event, amountCents: 1.5 });
    expect(() => provider.verifyWebhook(body, headers(body), now)).toThrow();
    expect(paidEventSchema.safeParse({ ...event, ownerId: "outro" }).success).toBe(false);
  });
  it("bloqueia provider fake em produção e sem habilitação explícita", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("PAYMENT_PROVIDER", "fake"); vi.stubEnv("FAKE_WEBHOOK_SECRET", secret);
    expect(() => getPaymentProvider()).toThrow("Cobrança indisponível");
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("PAYMENT_PROVIDER", "");
    expect(() => getPaymentProvider()).toThrow("Cobrança indisponível");
    vi.unstubAllEnvs();
  });
});

describe("regras do evento pago", () => {
  it("confirma somente pagamento integral do sinal em reserva válida", () => {
    expect(decidePaidEvent(payment, booking, event, now)).toMatchObject({ outcome: "processed", recordPaid: true, confirm: true });
  });
  it.each([999, 1001])("não confirma sinal divergente %s", (amountCents) => {
    expect(decidePaidEvent(payment, booking, { ...event, amountCents }, now)).toMatchObject({ outcome: "rejected", reason: "amount_mismatch", recordPaid: false, confirm: false });
  });
  it("confere também o valor contratado na reserva", () => {
    expect(decidePaidEvent(payment, { ...booking, depositCents: 2000 }, event, now).confirm).toBe(false);
  });
  it("pagamento já pago não tem segundo efeito", () => {
    expect(decidePaidEvent({ ...payment, status: "paid" }, booking, event, now)).toMatchObject({ outcome: "duplicate", recordPaid: false, confirm: false });
  });
  it.each(["cancelled", "expired", "completed", "confirmed"])("não reabre reserva %s", (status) => {
    expect(decidePaidEvent(payment, { ...booking, status }, event, now)).toMatchObject({ outcome: "ignored", recordPaid: true, confirm: false });
  });
  it("vencimento exato registra dinheiro sem reservar novamente", () => {
    expect(decidePaidEvent(payment, booking, { ...event, paidAt: payment.expiresAt.toISOString() }, payment.expiresAt)).toMatchObject({ outcome: "ignored", reason: "late_payment", recordPaid: true, confirm: false });
  });
  it.each(["failed", "refunded"])("não sobrescreve pagamento %s", (status) => {
    expect(decidePaidEvent({ ...payment, status }, booking, event, now)).toMatchObject({ outcome: "rejected", recordPaid: false, confirm: false });
  });
  it("rejeita data de pagamento no futuro além da tolerância", () => {
    expect(decidePaidEvent(payment, booking, { ...event, paidAt: "2030-01-01T12:06:00Z" }, now)).toMatchObject({ outcome: "rejected", reason: "future_payment" });
  });
});
