// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MP_CALLBACK_STORAGE_KEY } from "@/lib/mercadopago/contract";
import { DRAFT_KEY } from "@/components/onboarding/storage";
import { onboardingBoundaryLog, restartOnboardingConnection } from "@/lib/onboarding/mp-return-error";
import { mpCallbackSessionValue, redactOAuthReturnLog, stripOAuthReturnParams } from "@/lib/onboarding/oauth-return";
import { resumeTargetFromUrl } from "@/lib/onboarding/resume-contract";

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

  it("não grava code nem state e tira os dois do log", () => {
    const code = "oauth-code-sentinel";
    const state = "oauth-state-sentinel";
    const stored = mpCallbackSessionValue("connected", code);
    expect(stored).toBe(JSON.stringify({ mp: "connected", reason: null }));
    expect(stored).not.toContain(code);
    expect(stored).not.toContain("state");
    const params = new URLSearchParams(`mp=connected&code=${code}&state=${state}&reason=expired_code`);
    stripOAuthReturnParams(params);
    expect(params.get("code")).toBeNull();
    expect(params.get("state")).toBeNull();
    expect(params.get("mp")).toBe("connected");
    expect(params.get("reason")).toBe("expired_code");
    const line = onboardingBoundaryLog({ message: `volta ?code=${code}&state=${state}` });
    expect(line).not.toContain(code);
    expect(line).not.toContain(state);
    expect(redactOAuthReturnLog(`?code=${code}&state=${state}`)).toBe("?code=[omitido]&state=[omitido]");
    const target = resumeTargetFromUrl(`http://127.0.0.1/api/onboarding/resume?code=${code}&state=${state}`);
    expect(target).toEqual({});
    expect(JSON.stringify(target)).not.toContain(code);
    expect(JSON.stringify(target)).not.toContain(state);
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
