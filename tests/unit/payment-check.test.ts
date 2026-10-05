import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAYMENT_CHECK_TIMEOUT_MS,
  PAYMENT_PENDING_CONFIRMATION_MESSAGE,
  canShowDevSimulatePix,
  interpretPaymentStatus,
  pendingMessageForAttempts,
  withPaymentCheckTimeout,
} from "../../components/booking/payment-check";
import type { PaymentStatusResponse } from "../../components/booking/types";

function status(partial: Partial<PaymentStatusResponse>): PaymentStatusResponse {
  return {
    bookingId: "11111111-1111-4111-8111-111111111111",
    status: "pending_payment",
    expiresAt: "2030-01-01T12:15:00.000Z",
    payment: {
      id: "22222222-2222-4222-8222-222222222222",
      provider: "fake",
      externalId: "fake_x",
      amountCents: 1000,
      status: "pending",
      expiresAt: "2030-01-01T12:15:00.000Z",
      qrCodeDataUrl: null,
      copyPaste: null,
    },
    ...partial,
  };
}

describe("interpretPaymentStatus", () => {
  it("trata null/undefined como pending", () => {
    expect(interpretPaymentStatus(null).kind).toBe("pending");
    expect(interpretPaymentStatus(undefined).kind).toBe("pending");
  });

  it("detecta confirmed e expired pelo status da reserva ou do pagamento", () => {
    expect(interpretPaymentStatus(status({ status: "confirmed" })).kind).toBe("confirmed");
    expect(interpretPaymentStatus(status({ status: "expired" })).kind).toBe("expired");
    expect(
      interpretPaymentStatus(
        status({
          payment: {
            id: "22222222-2222-4222-8222-222222222222",
            provider: "fake",
            externalId: "fake_x",
            amountCents: 1000,
            status: "expired",
            expiresAt: "2030-01-01T12:15:00.000Z",
            qrCodeDataUrl: null,
            copyPaste: null,
          },
        }),
      ).kind,
    ).toBe("expired");
    expect(interpretPaymentStatus(status({})).kind).toBe("pending");
  });
});

describe("mensagens e simulação de desenvolvimento", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("expõe a mensagem clara de confirmação pendente e reforça após o limite de tentativas", () => {
    expect(pendingMessageForAttempts(1)).toBe(PAYMENT_PENDING_CONFIRMATION_MESSAGE);
    expect(pendingMessageForAttempts(99)).toContain("Ainda não recebemos a confirmação do Pix");
    expect(pendingMessageForAttempts(99)).toContain("atualize a página");
  });

  it("só libera o botão de simular em development com provedor fake", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(canShowDevSimulatePix("fake")).toBe(true);
    expect(canShowDevSimulatePix("asaas")).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    expect(canShowDevSimulatePix("fake")).toBe(false);
  });

  it("define timeout finito para evitar spinner infinito", () => {
    expect(PAYMENT_CHECK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(PAYMENT_CHECK_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});

describe("withPaymentCheckTimeout", () => {
  it("rejeita quando o AbortSignal aborta", async () => {
    const controller = new AbortController();
    const pending = withPaymentCheckTimeout(new Promise(() => {}), controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("resolve o valor quando completa antes do abort", async () => {
    const controller = new AbortController();
    await expect(withPaymentCheckTimeout(Promise.resolve("ok"), controller.signal)).resolves.toBe("ok");
  });
});
