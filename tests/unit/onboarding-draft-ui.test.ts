import { describe, expect, it, vi } from "vitest";
import { readOtpFailure } from "../../lib/onboarding/auth-otp";
import { readApiError } from "../../lib/onboarding/api-error";
import { followUpFromFailure } from "../../lib/onboarding/commit-follow-up";
import { buildOnboardingDraftBody } from "../../lib/onboarding/draft";
import { suggestEmailDomain } from "../../lib/onboarding/email-hint";
import { saveDraftThenSendOtp } from "../../lib/onboarding/flow";
import { mapOtpError, wrongCodeMessage } from "../../lib/onboarding/otp";

const body = buildOnboardingDraftBody({
  email: "Ana@StudioBella.com.br",
  plan: "base",
  businessName: "Studio Bella",
  slug: "studio-bella-",
  serviceName: "Design",
  durationMinutes: 45,
  priceCents: 6590,
  depositCents: 1977,
  openDays: [1],
  opensAt: "09:00",
  closesAt: "18:00",
});

describe("onboarding draft body", () => {
  it("sends integers, a segment and one hours row, without policy or WhatsApp", () => {
    expect(body.email).toBe("ana@studiobella.com.br");
    expect(body.segment).toBe("outro");
    expect(body.data.business.slug).toBe("studio-bella");
    expect(body.data.service).toEqual({ name: "Design", durationMinutes: 45, priceCents: 6590, depositCents: 1977 });
    expect(body.data.hours).toEqual([{ weekday: 1, opensAt: "09:00", closesAt: "18:00" }]);
    const json = JSON.stringify(body);
    expect(json).not.toContain("depositPolicy");
    expect(json).not.toContain("contactWhatsapp");
  });
});

describe("draft and commit follow-up", () => {
  it("does not send the code when the draft fails", async () => {
    const sendOtp = vi.fn();
    const outcome = await saveDraftThenSendOtp(
      { draftId: null, body, online: true },
      {
        create: async () => ({ ok: false, status: 409, error: { code: "slug_unavailable", suggestions: ["studio-bella-2"] } }),
        patch: async () => ({ ok: true, draftId: "x" }),
        sendOtp,
      },
    );
    expect(outcome).toEqual({ type: "slug_taken", suggestions: ["studio-bella-2"], draftId: null });
    expect(sendOtp).not.toHaveBeenCalled();
  });

  it("maps consumed, expired and a different e-mail", () => {
    expect(followUpFromFailure(409, { code: "draft_consumed" }).type).toBe("consumed");
    expect(followUpFromFailure(409, { code: "already_has_business", publicPath: "/studio" })).toEqual({
      type: "has_business",
      publicPath: "/studio",
    });
    expect(followUpFromFailure(404, { code: "not_found" }).type).toBe("wrong_email");
    expect(followUpFromFailure(410, { code: "draft_expired" }).type).toBe("expired");
  });
});

describe("otp errors", () => {
  it("reads RATE_LIMITED from the top-level Better Auth body", () => {
    expect(readOtpFailure({ code: "RATE_LIMITED", message: "Muitas tentativas." }, 429, "120")).toEqual({
      code: "RATE_LIMITED",
      retryAfter: 120,
    });
    expect(mapOtpError("RATE_LIMITED", 0).kind).toBe("rate_limited");
    expect(mapOtpError("INVALID_OTP", 2).kind).toBe("locked");
    expect(wrongCodeMessage(1)).toBe("Código incorreto. Você tem mais 1 tentativa.");
  });

  it("suggests a mistyped domain", () => {
    expect(suggestEmailDomain("ana@gmial.com")).toBe("gmail.com");
  });
});

describe("api errors", () => {
  it("reads extras from error and the Retry-After header", async () => {
    const response = new Response(JSON.stringify({
      error: { code: "slug_unavailable", message: "tomado", suggestions: ["ana-2"] },
      publicPath: "/ana",
    }), { status: 409, headers: { "Retry-After": "60" } });
    const error = await readApiError(response);
    expect(error.code).toBe("slug_unavailable");
    expect(error.suggestions).toEqual(["ana-2"]);
    expect(error.retryAfter).toBe(60);
    expect(error.publicPath).toBe("/ana");
  });
});
