// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MP_CALLBACK_STORAGE_KEY } from "@/lib/mercadopago/contract";
import { DRAFT_KEY } from "@/components/onboarding/storage";
import { onboardingBoundaryLog, restartOnboardingConnection } from "@/lib/onboarding/mp-return-error";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("onboarding Mercado Pago return error", () => {
  it("logs the digest and strips e-mail and phone from the message", () => {
    const line = onboardingBoundaryLog({
      digest: "abc123",
      message: "falha para ana.silva@gmail.com no 5514999887766",
    });
    expect(line).toBe("onboarding_mp_return digest=abc123 message=falha para [email] no [telefone]");
    expect(line).not.toContain("ana.silva");
    expect(line).not.toContain("5514999887766");
  });

  it("drops a digest that is not a short id", () => {
    expect(onboardingBoundaryLog({ digest: "ana@gmail.com", message: "x" })).toContain("digest=sem-digest");
  });

  it("clears the local draft and the callback, then opens recebimento", () => {
    localStorage.setItem(DRAFT_KEY, "{\"businessName\":\"Antiga\"}");
    localStorage.setItem("agenda_onboarding_step", "email");
    localStorage.setItem("agenda_onboarding_draft_id", "draft-1");
    sessionStorage.setItem(MP_CALLBACK_STORAGE_KEY, "{\"mp\":\"error\"}");
    const navigate = vi.fn();
    restartOnboardingConnection(navigate);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(localStorage.getItem("agenda_onboarding_step")).toBeNull();
    expect(localStorage.getItem("agenda_onboarding_draft_id")).toBeNull();
    expect(sessionStorage.getItem(MP_CALLBACK_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith("/onboarding/recebimento");
  });
});
