import { describe, expect, it } from "vitest";
import { PAYMENT_GATEWAY_POLL_GRACE_MS, shouldPollGateway } from "../../lib/payments/status-poll";

const pending = { status: "pending", externalId: "fake_1", expiresAt: new Date("2030-01-01T12:10:00Z") };

describe("shouldPollGateway", () => {
  it("consulta pending com hold vigente ou recém-vencido", () => {
    expect(shouldPollGateway(pending, new Date("2030-01-01T12:09:00Z"))).toBe(true);
    expect(shouldPollGateway(pending, new Date(pending.expiresAt.getTime() + PAYMENT_GATEWAY_POLL_GRACE_MS))).toBe(true);
  });

  it("não consulta fora da folga, nem cobrança que não está pending", () => {
    expect(shouldPollGateway(pending, new Date(pending.expiresAt.getTime() + PAYMENT_GATEWAY_POLL_GRACE_MS + 1))).toBe(false);
    expect(shouldPollGateway({ ...pending, status: "paid" }, pending.expiresAt)).toBe(false);
    expect(shouldPollGateway({ ...pending, status: "creating", externalId: null }, pending.expiresAt)).toBe(false);
    expect(shouldPollGateway(null, pending.expiresAt)).toBe(false);
  });
});