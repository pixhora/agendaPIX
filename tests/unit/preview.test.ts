import { describe, it, expect } from "vitest";
import {
  MOCK_BUSINESS_INFO,
  MOCK_SERVICES,
  MOCK_BOOKINGS,
  getMockAvailabilitySlots,
} from "../../lib/preview/mock-data";

describe("Preview mode deterministic mock data", () => {
  it("defines the exact Studio Bella business profile", () => {
    expect(MOCK_BUSINESS_INFO.name).toBe("Studio Bella");
    expect(MOCK_BUSINESS_INFO.slug).toBe("studio-bella");
    expect(MOCK_BUSINESS_INFO.timezone).toBe("America/Sao_Paulo");
    expect(MOCK_BUSINESS_INFO.city).toContain("São Paulo");
  });

  it("defines the 3 exact deterministic services with cents and duration", () => {
    expect(MOCK_SERVICES).toHaveLength(3);

    const corteFem = MOCK_SERVICES.find((s) => s.name === "Corte feminino");
    expect(corteFem).toBeDefined();
    expect(corteFem?.priceCents).toBe(8000);
    expect(corteFem?.durationMinutes).toBe(60);

    const corteEscova = MOCK_SERVICES.find((s) => s.name === "Corte + escova");
    expect(corteEscova).toBeDefined();
    expect(corteEscova?.priceCents).toBe(12000);
    expect(corteEscova?.durationMinutes).toBe(90);

    const manicure = MOCK_SERVICES.find((s) => s.name === "Manicure");
    expect(manicure).toBeDefined();
    expect(manicure?.priceCents).toBe(4500);
    expect(manicure?.durationMinutes).toBe(45);
  });

  it("calculates realistic financial metrics in cents", () => {
    const totalCents = MOCK_BOOKINGS.reduce((acc, b) => acc + b.priceCents, 0);
    expect(totalCents).toBe(37000); // R$ 370,00

    const confirmedDeposits = MOCK_BOOKINGS.filter((b) => b.status === "confirmed").reduce(
      (acc, b) => acc + b.depositCents,
      0
    );
    expect(confirmedDeposits).toBe(10500); // R$ 105,00
  });

  it("generates deterministic availability slots for date string", () => {
    const slots = getMockAvailabilitySlots("2026-10-03");
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((s) => {
      expect(s.startsAt).toMatch(/^2026-10-03T\d{2}:\d{2}:00\.000Z$/);
      expect(s.endsAt).toMatch(/^2026-10-03T\d{2}:\d{2}:00\.000Z$/);
    });
  });
});
