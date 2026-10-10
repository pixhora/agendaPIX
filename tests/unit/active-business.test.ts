import { describe, expect, it } from "vitest";
import { activeBusinessCookie, resolveBusiness } from "../../lib/dashboard/active-business";

const businesses = [{ id: "a" }, { id: "b" }];

describe("resolveBusiness", () => {
  it("prefers the business in the URL", () => {
    expect(resolveBusiness(businesses, "b", "a")).toEqual({ id: "b" });
  });

  it("uses the remembered business when the URL has no businessId", () => {
    expect(resolveBusiness(businesses, undefined, "b")).toEqual({ id: "b" });
  });

  it("falls back to the first business when nothing is remembered or the cookie is not theirs", () => {
    expect(resolveBusiness(businesses, undefined, undefined)).toEqual({ id: "a" });
    expect(resolveBusiness(businesses, undefined, "someone-else")).toEqual({ id: "a" });
  });

  it("does not swap a business that is not theirs for the remembered one", () => {
    expect(resolveBusiness(businesses, "someone-else", "b")).toBeUndefined();
  });

  it("returns nothing when the owner has no business", () => {
    expect(resolveBusiness([], undefined, "a")).toBeUndefined();
  });
});

describe("activeBusinessCookie", () => {
  it("is scoped to the dashboard and lasts a year", () => {
    expect(activeBusinessCookie("a b")).toBe("agendapix.business=a%20b; path=/dashboard; max-age=31536000; samesite=lax");
  });
});
