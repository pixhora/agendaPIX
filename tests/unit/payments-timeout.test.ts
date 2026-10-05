import { describe, expect, it } from "vitest";
import { callProvider, ProviderTimeoutError } from "../../lib/payments/timeout";
import { paymentsConfig } from "../../lib/payments/config";
import { FakePaymentProvider } from "../../lib/payments/fake";
import { randomUUID } from "node:crypto";

describe("timeout do gateway", () => {
  it("aborta a chamada ao vencer o prazo", async () => {
    await expect(callProvider(30, (signal) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve("late"), 200);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); });
    }))).rejects.toBeInstanceOf(ProviderTimeoutError);
  });
  it("resolve antes do prazo", async () => {
    expect(await callProvider(200, async () => "ok")).toBe("ok");
  });
  it("propaga o AbortSignal ao FakePaymentProvider", async () => {
    const provider = new FakePaymentProvider("test-only-fake-webhook-secret-32-characters", { latencyMs: 500 });
    const started = Date.now();
    await expect(callProvider(40, (signal) => provider.createPixCharge({
      idempotencyKey: randomUUID(), reference: randomUUID(), amountCents: 1000, expiresAt: new Date(Date.now() + 60000),
    }, { signal }))).rejects.toBeInstanceOf(ProviderTimeoutError);
    expect(Date.now() - started).toBeLessThan(300);
  });
});

describe("config de pagamentos", () => {
  it("usa padrões e rejeita inválidos", () => {
    expect(paymentsConfig({})).toMatchObject({ PAYMENT_PROVIDER_TIMEOUT_MS: 8000, RECONCILE_STUCK_SECONDS: 60 });
    expect(() => paymentsConfig({ PAYMENT_PROVIDER_TIMEOUT_MS: "5" })).toThrow();
  });
});
