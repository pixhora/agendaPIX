import { describe, expect, it, vi } from "vitest";
import { handleHttp, HttpError, parseJsonBody } from "../../lib/http";
import { aliasHoldActive } from "../../lib/business-profile/slug-policy";

vi.mock("@/lib/auth", () => ({
  getAuth: () => ({
    api: {
      getSession: async () => ({ user: { id: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b" } }),
    },
  }),
}));

vi.mock("@/lib/business-profile/update", () => ({
  updateBusinessProfile: vi.fn(),
}));

describe("profile JSON", () => {
  it("turns malformed JSON into 400 invalid_input", async () => {
    expect(() => parseJsonBody("{")).toThrow(HttpError);
    try {
      parseJsonBody("{");
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: "invalid_input" });
    }
    expect(parseJsonBody("{\"name\":\"Ana\"}")).toEqual({ name: "Ana" });

    const { PATCH } = await import("../../app/api/businesses/[businessId]/profile/route");
    const response = await PATCH(new Request("http://localhost:3000/api/businesses/6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{",
    }), {
      params: Promise.resolve({ businessId: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_input" } });
  });

  it("sets Retry-After when a profile save is rate limited", async () => {
    const response = await handleHttp(async () => {
      throw new HttpError(429, "rate_limited", "Muitas tentativas. Espere um pouco e tente de novo.", 3600, { retryAfter: 3600 });
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect(await response.json()).toMatchObject({ error: { code: "rate_limited" } });
  });
});

describe("alias hold", () => {
  const now = new Date("2026-10-10T00:00:00.000Z");

  it("holds an active alias and a release younger than 90 days", () => {
    expect(aliasHoldActive(null, now)).toBe(true);
    expect(aliasHoldActive(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000), now)).toBe(true);
    expect(aliasHoldActive(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), now)).toBe(false);
  });
});
