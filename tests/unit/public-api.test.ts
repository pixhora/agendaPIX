import { describe, expect, it } from "vitest";
import {
  publicAvailabilityUrl,
  publicBookingPagePath,
  publicBookingPaymentUrl,
  publicBookingsUrl,
  publicServicesUrl,
  devSimulatePixUrl,
} from "../../lib/public-api";

describe("public API URLs", () => {
  it("targets the app's own /api/public routes", () => {
    expect(publicServicesUrl("studio-bella")).toBe("/api/public/studio-bella/services");
    expect(publicBookingsUrl("studio-bella")).toBe("/api/public/studio-bella/bookings");
    expect(publicAvailabilityUrl("studio-bella", "srv-1", "2026-10-05")).toBe(
      "/api/public/studio-bella/availability?serviceId=srv-1&date=2026-10-05",
    );
    expect(publicBookingPaymentUrl("studio-bella", "bk-1")).toBe("/api/public/studio-bella/bookings/bk-1/payment");
    expect(devSimulatePixUrl()).toBe("/api/dev/simulate-pix");
  });

  it("encodes user-controlled segments so they cannot change the path or query", () => {
    expect(publicServicesUrl("../admin")).toBe("/api/public/..%2Fadmin/services");
    expect(publicBookingPaymentUrl("a/b", "x?y#z")).toBe("/api/public/a%2Fb/bookings/x%3Fy%23z/payment");
    expect(publicAvailabilityUrl("s", "id&date=1", "2026-10-05")).toBe(
      "/api/public/s/availability?serviceId=id%26date%3D1&date=2026-10-05",
    );
    expect(publicBookingPagePath("a b", "id&x=1")).toBe("/a%20b?bookingId=id%26x%3D1");
    expect(publicBookingPagePath("studio-bella")).toBe("/studio-bella");
  });
});
