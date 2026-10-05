import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../lib/http";
import { assertDevFakeSimulationAllowed } from "../../lib/payments/simulate-dev";

describe("assertDevFakeSimulationAllowed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bloqueia em production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_PROVIDER", "fake");
    expect(() => assertDevFakeSimulationAllowed()).toThrow(HttpError);
    try {
      assertDevFakeSimulationAllowed();
    } catch (error) {
      expect(error).toMatchObject({ status: 404, code: "not_found" });
    }
  });

  it("bloqueia quando o provedor não é fake", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PAYMENT_PROVIDER", "asaas");
    expect(() => assertDevFakeSimulationAllowed()).toThrow(HttpError);
  });

  it("permite em development com fake", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PAYMENT_PROVIDER", "fake");
    expect(() => assertDevFakeSimulationAllowed()).not.toThrow();
  });
});
