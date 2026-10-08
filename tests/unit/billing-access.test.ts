import { describe, expect, it } from "vitest";
import { getBookingAccess, trialEndsAtFromCreation } from "../../lib/billing/access";

const timezone = "America/Sao_Paulo";
const trialEndsAt = new Date("2026-10-20T02:59:59.000Z");
const business = { trialEndsAt, timezone };

describe("acesso do teste grátis", () => {
  it("encerra no fim do 7º dia local", () => {
    expect(trialEndsAtFromCreation(new Date("2026-10-13T13:00:00.000Z"), timezone).toISOString()).toBe("2026-10-20T02:59:59.000Z");
  });

  it.each([
    ["2026-10-15T15:00:00.000Z", "trial", false, 4],
    ["2026-10-16T15:00:00.000Z", "trial_ending", false, 3],
    ["2026-10-18T15:00:00.000Z", "trial_ending", false, 1],
    ["2026-10-19T15:00:00.000Z", "trial_last_day", false, 0],
    ["2026-10-20T02:59:59.000Z", "trial_last_day", false, 0],
    ["2026-10-20T03:00:00.000Z", "paused", true, -1],
  ] as const)("em %s fica %s", (now, state, paused, daysLeft) => {
    expect(getBookingAccess(business, null, new Date(now))).toMatchObject({ state, bookingsPaused: paused, daysLeft });
  });

  it("assinatura ativa libera mesmo depois do teste", () => {
    const now = new Date("2026-10-21T15:00:00.000Z");
    expect(getBookingAccess(business, { status: "active", currentPeriodEnd: new Date("2026-11-21T00:00:00.000Z") }, now).bookingsPaused).toBe(false);
    expect(getBookingAccess(business, { status: "past_due", currentPeriodEnd: new Date("2026-11-21T00:00:00.000Z") }, now)).toMatchObject({ state: "paused", bookingsPaused: true });
    expect(getBookingAccess(business, { status: "active", currentPeriodEnd: now }, now).bookingsPaused).toBe(true);
  });
});
