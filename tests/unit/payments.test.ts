import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { FakePaymentProvider, signFakeWebhook } from "../../lib/payments/fake";
import { getPaymentProvider } from "../../lib/payments";
import { decidePaidEvent, PIX_APPROVAL_TOLERANCE_MS } from "../../lib/payments/rules";
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
    const input = { idempotencyKey: randomUUID(), reference: randomUUID(), amountCents: 1000, expiresAt: payment.expiresAt };
    const first = await provider.createPixCharge(input);
    expect(first).toEqual(await provider.createPixCharge(input));
    expect(first.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(first.copyPaste).toContain("FAKE-PIX-NOT-PAYABLE");
    expect(first.amountCents).toBe(1000);
  });
  it.each([0, -1, 0.1, 2147483648])("não cobra %s centavos", async (amountCents) => {
    await expect(provider.createPixCharge({ idempotencyKey: randomUUID(), reference: randomUUID(), amountCents, expiresAt: payment.expiresAt })).rejects.toThrow();
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
  it("bloqueia provider fake em produção; fora de produção o padrão é fake", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("PAYMENT_PROVIDER", "fake"); vi.stubEnv("FAKE_WEBHOOK_SECRET", secret);
    expect(() => getPaymentProvider()).toThrow("Cobrança indisponível");
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("PAYMENT_PROVIDER", "fake"); vi.stubEnv("FAKE_WEBHOOK_SECRET", secret);
    expect(getPaymentProvider().name).toBe("fake");
    vi.stubEnv("PAYMENT_PROVIDER", ""); vi.stubEnv("FAKE_WEBHOOK_SECRET", "replace-this-not-configured-secret-value");
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
  it.each(["cancelled", "completed", "confirmed"])("não reabre reserva %s", (status) => {
    expect(decidePaidEvent(payment, { ...booking, status }, event, now)).toMatchObject({ outcome: "ignored", reason: "late_payment", recordPaid: true, confirm: false });
  });
  it("vencimento exato do hold ainda é no prazo", () => {
    expect(decidePaidEvent(payment, booking, { ...event, paidAt: payment.expiresAt.toISOString(), paidAtSource: "date_approved" }, payment.expiresAt)).toMatchObject({ outcome: "processed", reason: null, recordPaid: true, confirm: true });
  });
  it.each(["failed", "refunded"])("não sobrescreve pagamento %s", (status) => {
    expect(decidePaidEvent({ ...payment, status }, booking, event, now)).toMatchObject({ outcome: "rejected", recordPaid: false, confirm: false });
  });
  it("pago aos 29:59 do hold de 30 min confirma", () => {
    const expiresAt = new Date("2030-01-01T12:30:00.000Z");
    const paidAt = new Date(expiresAt.getTime() - 1000);
    expect(decidePaidEvent(
      { ...payment, expiresAt },
      { ...booking, expiresAt, startsAt: new Date("2030-01-01T14:00:00.000Z") },
      { ...event, paidAt: paidAt.toISOString() },
      paidAt,
    )).toMatchObject({ outcome: "processed", confirm: true, recordPaid: true });
  });
  it("pago dentro da margem de 2 min do Mercado Pago confirma", () => {
    const expiresAt = new Date("2030-01-01T12:30:00.000Z");
    const paidAt = new Date(expiresAt.getTime() + PIX_APPROVAL_TOLERANCE_MS);
    expect(decidePaidEvent(
      { ...payment, expiresAt },
      { ...booking, expiresAt, startsAt: new Date("2030-01-01T14:00:00.000Z") },
      { ...event, paidAt: paidAt.toISOString(), paidAtSource: "date_approved" },
      paidAt,
    )).toMatchObject({ outcome: "processed", confirm: true, recordPaid: true });
  });
  it("pago depois da margem de 2 min segue atraso", () => {
    const expiresAt = new Date("2030-01-01T12:30:00.000Z");
    const paidAt = new Date(expiresAt.getTime() + PIX_APPROVAL_TOLERANCE_MS + 1000);
    expect(decidePaidEvent(
      { ...payment, status: "expired", expiresAt },
      { ...booking, status: "expired", expiresAt, startsAt: new Date("2030-01-01T14:00:00.000Z") },
      { ...event, paidAt: paidAt.toISOString(), paidAtSource: "date_approved" },
      paidAt,
    )).toMatchObject({ outcome: "ignored", reason: "late_payment", confirm: false, recordPaid: true });
  });
  it("aprovação no prazo processada depois do hold pede retomada e não é atraso", () => {
    const expiresAt = new Date("2030-01-01T12:30:00.000Z");
    const paidAt = new Date(expiresAt.getTime() - 1000);
    const processingNow = new Date(expiresAt.getTime() + 10 * 60_000);
    expect(decidePaidEvent(
      { ...payment, status: "expired", expiresAt },
      { ...booking, status: "expired", expiresAt, startsAt: new Date("2030-01-01T14:00:00.000Z") },
      { ...event, paidAt: paidAt.toISOString(), paidAtSource: "date_approved" },
      processingNow,
    )).toMatchObject({ outcome: "ignored", reason: "on_time_hold_released", confirm: false, recordPaid: true });
  });
  it("sem paidAt válido confirma só com o hold ainda aberto", () => {
    expect(decidePaidEvent(payment, booking, { ...event, paidAtSource: "fallback" }, now)).toMatchObject({ outcome: "processed", confirm: true, recordPaid: true });
    expect(decidePaidEvent(payment, booking, { ...event, paidAt: "not-a-date" }, now)).toMatchObject({ outcome: "processed", confirm: true, recordPaid: true });
    const expiresAt = payment.expiresAt;
    const processingNow = new Date(expiresAt.getTime() + 60_000);
    expect(decidePaidEvent(
      { ...payment, status: "expired" },
      { ...booking, status: "expired" },
      { ...event, paidAt: new Date(expiresAt.getTime() - 1000).toISOString(), paidAtSource: "fallback" },
      processingNow,
    )).toMatchObject({ outcome: "ignored", reason: "late_payment", confirm: false, recordPaid: true });
    expect(decidePaidEvent(
      { ...payment, status: "expired" },
      { ...booking, status: "expired" },
      { ...event, paidAt: "not-a-date" },
      processingNow,
    )).toMatchObject({ outcome: "ignored", reason: "late_payment", confirm: false, recordPaid: true });
  });
  it("rejeita data de pagamento no futuro além da tolerância", () => {
    expect(decidePaidEvent(payment, booking, { ...event, paidAt: "2030-01-01T12:06:00Z", paidAtSource: "date_approved" }, now)).toMatchObject({ outcome: "rejected", reason: "future_payment" });
  });
});

describe("consulta e cancelamento fake", () => {
  it("é idempotente por chave e localiza por referência", async () => {
    const reference = randomUUID();
    const input = { idempotencyKey: randomUUID(), reference, amountCents: 1000, expiresAt: payment.expiresAt };
    const first = await provider.createPixCharge(input);
    expect(await provider.createPixCharge(input)).toEqual(first);
    expect(await provider.findChargeByReference(reference)).toMatchObject({ externalId: first.externalId, status: "pending" });
    expect(await provider.getCharge(first.externalId)).toMatchObject({ reference });
  });
  it("cancela pendente e preserva pago", async () => {
    const created = await provider.createPixCharge({ idempotencyKey: randomUUID(), reference: randomUUID(), amountCents: 1000, expiresAt: payment.expiresAt });
    expect(await provider.cancelCharge(created.externalId)).toMatchObject({ status: "cancelled" });
    const paid = await provider.createPixCharge({ idempotencyKey: randomUUID(), reference: randomUUID(), amountCents: 1000, expiresAt: payment.expiresAt });
    provider.markPaid(paid.externalId, now);
    expect(await provider.cancelCharge(paid.externalId)).toMatchObject({ status: "paid" });
  });
});
