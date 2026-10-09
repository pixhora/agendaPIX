import { describe, expect, it } from "vitest";
import { isDue, withDerivedExpiry } from "../../lib/bookings/payment-status";

const now = new Date("2030-01-01T12:00:00.000Z");
const future = new Date("2030-01-01T12:30:00.000Z");
const past = new Date("2030-01-01T11:59:00.000Z");

function view(overrides: {
  status?: string;
  expiresAt?: Date | null;
  payment?: { status: string; expiresAt: Date; qrCodeDataUrl: string | null; copyPaste: string | null } | null;
} = {}) {
  return {
    bookingId: "booking-1",
    status: overrides.status ?? "pending_payment",
    expiresAt: overrides.expiresAt === undefined ? future : overrides.expiresAt,
    payment: overrides.payment === undefined
      ? { status: "pending", expiresAt: future, qrCodeDataUrl: "data:image/png;base64,abc", copyPaste: "000201" }
      : overrides.payment,
  };
}

describe("estado vencido derivado", () => {
  it("trata expiresAt igual a agora como vencido e o instante seguinte como vigente", () => {
    expect(isDue(now, now)).toBe(true);
    expect(isDue(new Date(now.getTime() + 1), now)).toBe(false);
    expect(isDue(null, now)).toBe(false);
  });

  it("mantém QR e copia-e-cola enquanto a cobrança está pendente e vigente", () => {
    const current = withDerivedExpiry(view(), now);
    expect(current.status).toBe("pending_payment");
    expect(current.payment).toMatchObject({ status: "pending", qrCodeDataUrl: "data:image/png;base64,abc", copyPaste: "000201" });
  });

  it("deriva reserva e cobrança vencidas e esconde o Pix sem mudar o objeto de origem", () => {
    const source = view({ expiresAt: past, payment: { status: "pending", expiresAt: past, qrCodeDataUrl: "data:image/png;base64,abc", copyPaste: "000201" } });
    const derived = withDerivedExpiry(source, now);
    expect(derived.status).toBe("expired");
    expect(derived.payment).toMatchObject({ status: "expired", qrCodeDataUrl: null, copyPaste: null });
    expect(source.status).toBe("pending_payment");
    expect(source.payment?.status).toBe("pending");
    expect(source.payment?.copyPaste).toBe("000201");
  });

  it("deriva creating vencido e não reabre pago, confirmado ou reembolsado", () => {
    const creating = withDerivedExpiry(view({
      expiresAt: past,
      payment: { status: "creating", expiresAt: past, qrCodeDataUrl: null, copyPaste: null },
    }), now);
    expect(creating.status).toBe("expired");
    expect(creating.payment?.status).toBe("expired");

    const paid = withDerivedExpiry(view({
      status: "confirmed",
      expiresAt: past,
      payment: { status: "paid", expiresAt: past, qrCodeDataUrl: "data:image/png;base64,abc", copyPaste: "000201" },
    }), now);
    expect(paid.status).toBe("confirmed");
    expect(paid.payment).toMatchObject({ status: "paid", qrCodeDataUrl: null, copyPaste: null });

    const refunded = withDerivedExpiry(view({
      status: "expired",
      expiresAt: past,
      payment: { status: "refunded", expiresAt: past, qrCodeDataUrl: null, copyPaste: null },
    }), now);
    expect(refunded.payment?.status).toBe("refunded");
  });
});
