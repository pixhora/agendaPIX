import { expect, it } from "vitest";
import { bookingPaymentUnavailableErrorSchema } from "../../lib/contracts/booking-payment-error";

const message = "Não foi possível criar a cobrança. Tente novamente com a mesma chave.";

it("aceita só retry_same_key no 503 de cobrança", () => {
  for (const retrySameKey of [true, false]) {
    expect(bookingPaymentUnavailableErrorSchema.parse({
      error: { code: "payment_unavailable", message, details: { retry_same_key: retrySameKey } },
    })).toEqual({
      error: { code: "payment_unavailable", message, details: { retry_same_key: retrySameKey } },
    });
  }
});

it("rejeita reason e qualquer outro detalhe", () => {
  expect(bookingPaymentUnavailableErrorSchema.safeParse({
    error: {
      code: "payment_unavailable",
      message,
      reason: "mp_unknown",
      details: { retry_same_key: false },
    },
  }).success).toBe(false);
  expect(bookingPaymentUnavailableErrorSchema.safeParse({
    error: {
      code: "payment_unavailable",
      message,
      details: { retry_same_key: true, reason: "mp_unknown" },
    },
  }).success).toBe(false);
  expect(bookingPaymentUnavailableErrorSchema.safeParse({
    error: { code: "payment_unavailable", message },
  }).success).toBe(false);
});
