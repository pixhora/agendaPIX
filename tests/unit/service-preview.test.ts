import { describe, expect, it } from "vitest";
import { EMPTY_SERVICE_PREVIEW_HOLD, projectServicePreview, type ServicePreviewHold, type ServicePreviewInput } from "@/lib/onboarding/service-preview";

const ready: ServicePreviewInput = {
  durationMinutes: 45,
  customDuration: false,
  priceCents: 6590,
  depositCents: 1977,
  depositMode: "30",
};

function step(hold: ServicePreviewHold, input: ServicePreviewInput) {
  return projectServicePreview(hold, input);
}

describe("customer preview while a field is invalid", () => {
  it("keeps the last valid deposit when the custom amount is above the price", () => {
    const valid = step(EMPTY_SERVICE_PREVIEW_HOLD, ready);
    const over = step(valid.hold, { ...ready, depositCents: 10000, depositMode: "custom" });

    expect(over.view.depositCents).toBe(1977);
    expect(over.view.depositLabel).toBe("R$ 19,77");
    expect(over.view.remainderCents).toBe(4613);
    expect(over.view.remainderLabel).toBe("R$ 46,13");
    expect(over.view.priceLabel).toBe("R$ 65,90");
    expect(over.view.depositLabel).not.toBe("R$ 100,00");
    expect(over.view.remainderLabel).not.toBe("R$ —");
  });

  it("keeps the last valid duration when the custom minutes are out of range", () => {
    const valid = step(EMPTY_SERVICE_PREVIEW_HOLD, ready);
    const tooShort = step(valid.hold, { ...ready, durationMinutes: 3, customDuration: true });

    expect(tooShort.view.durationMinutes).toBe(45);
    expect(tooShort.view.durationMinutes).not.toBe(3);
    expect(tooShort.view.depositLabel).toBe("R$ 19,77");
    expect(tooShort.view.remainderLabel).toBe("R$ 46,13");
  });

  it("accepts the next valid duration and deposit after an invalid edit", () => {
    const valid = step(EMPTY_SERVICE_PREVIEW_HOLD, ready);
    const invalid = step(valid.hold, { ...ready, durationMinutes: 3, customDuration: true, depositCents: 10000, depositMode: "custom" });
    const next = step(invalid.hold, { ...ready, durationMinutes: 20, customDuration: true, depositCents: 5000, depositMode: "custom" });

    expect(next.view.durationMinutes).toBe(20);
    expect(next.view.depositCents).toBe(5000);
    expect(next.view.remainderCents).toBe(1590);
  });
});
