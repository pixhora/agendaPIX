import { describe, expect, it } from "vitest";
import { INVALID_EMAIL_MESSAGE } from "@/lib/onboarding/email-hint";
import { CONFIRM_CODE_MESSAGE, confirmIdleTarget, confirmSubmitReady } from "@/lib/onboarding/confirm-ready";
import { onboardingSaveStatus } from "@/lib/onboarding/save-status";
import { serviceDurationLabel } from "@/lib/onboarding/service-preview";

describe("confirm link without a usable email", () => {
  it("stays idle when the fragment has the code and the email field is empty", () => {
    const input = { code: "481927", email: "", emailRequired: true };
    expect(confirmSubmitReady(input)).toBe(false);
    expect(confirmIdleTarget(input)).toEqual({ id: "confirm-email", message: INVALID_EMAIL_MESSAGE });
  });

  it("rejects a masked draft address because the verify post needs the real email", () => {
    const input = { code: "481927", email: "a•••@studiobella.com.br", emailRequired: true };
    expect(confirmSubmitReady(input)).toBe(false);
    expect(confirmIdleTarget(input)?.id).toBe("confirm-email");
  });

  it("enables submit when a usable email and a 6-digit code are both present", () => {
    const input = { code: "481927", email: "ana@studiobella.com.br", emailRequired: true };
    expect(confirmSubmitReady(input)).toBe(true);
    expect(confirmIdleTarget(input)).toBeNull();
  });

  it("focuses the code when the email is already on file and the code is short", () => {
    const input = { code: "48", email: "ana@studiobella.com.br", emailRequired: false };
    expect(confirmSubmitReady(input)).toBe(false);
    expect(confirmIdleTarget(input)).toEqual({ id: "otp-code", message: CONFIRM_CODE_MESSAGE });
  });
});

describe("onboarding save status", () => {
  it("leaves Salvando… after the save succeeds", () => {
    expect(onboardingSaveStatus(true, false)).toBe("Salvando…");
    expect(onboardingSaveStatus(false, false)).toBe("Salvo neste aparelho");
    expect(onboardingSaveStatus(false, true)).toBe("Cadastro guardado");
  });
});

describe("duration chip labels", () => {
  it("uses the same words for one hour and one hour and a half", () => {
    expect(serviceDurationLabel(30)).toBe("30 min");
    expect(serviceDurationLabel(45)).toBe("45 min");
    expect(serviceDurationLabel(60)).toBe("1 h");
    expect(serviceDurationLabel(90)).toBe("1 h 30");
  });
});
