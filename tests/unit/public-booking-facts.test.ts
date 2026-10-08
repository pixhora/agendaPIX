import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/public/config/route";
import { depositSlotAllowed } from "../../lib/bookings/hold";
import { serializePublicBooking } from "../../lib/bookings/public-payload";
import { getPublicBookingFacts, payerCpfRequired, resolvePixRecipientDisplayName } from "../../lib/marketing/facts";

afterEach(() => vi.unstubAllEnvs());

describe("fatos públicos do agendamento", () => {
  it("sem negócio o recebedor é null e o prazo sai de BOOKING_HOLD_MINUTES", async () => {
    vi.stubEnv("BOOKING_HOLD_MINUTES", "45");
    vi.stubEnv("MP_REQUIRES_PAYER_CPF", "true");
    vi.stubEnv("PIX_RECIPIENT_DISPLAY_NAME", "Plataforma");
    await expect(getPublicBookingFacts()).resolves.toEqual({
      holdMinutes: 45,
      pixRecipientDisplayName: null,
      requiresPayerCpf: true,
    });
    expect(payerCpfRequired({})).toBe(false);
  });

  it("com negócio usa o nome do dono e cai no nome do negócio", () => {
    expect(resolvePixRecipientDisplayName("  Teteu  ", "Studio Bella")).toBe("Teteu");
    expect(resolvePixRecipientDisplayName("  ", " Studio Bella ")).toBe("Studio Bella");
    expect(resolvePixRecipientDisplayName(null, "  ")).toBeNull();
  });

  it("GET /api/public/config devolve o mesmo objeto com cache curto", async () => {
    vi.stubEnv("BOOKING_HOLD_MINUTES", "30");
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await response.json()).toEqual({
      holdMinutes: 30,
      pixRecipientDisplayName: null,
      requiresPayerCpf: false,
    });
  });

  it("a resposta pública mantém expiresAt igual na reserva e no Pix", () => {
    const expiresAt = new Date("2030-01-01T12:30:00.000Z");
    const payload = serializePublicBooking({
      bookingId: "b1",
      status: "pending_payment",
      startsAt: new Date("2030-01-01T15:00:00.000Z"),
      endsAt: new Date("2030-01-01T15:30:00.000Z"),
      expiresAt,
      payment: { id: "p1", provider: "mercadopago", externalId: "1001", amountCents: 1000, status: "pending", expiresAt, qrCodeDataUrl: null, copyPaste: null },
    });
    expect(payload.expiresAt).toBe("2030-01-01T12:30:00.000Z");
    expect(payload.payment?.expiresAt).toBe(payload.expiresAt);
  });

  it("serviço com sinal não oferece horário dentro do hold", () => {
    const now = new Date("2030-01-01T12:00:00.000Z");
    expect(depositSlotAllowed(new Date("2030-01-01T12:29:00.000Z"), now, 30)).toBe(false);
    expect(depositSlotAllowed(new Date("2030-01-01T12:30:00.000Z"), now, 30)).toBe(true);
  });
});
