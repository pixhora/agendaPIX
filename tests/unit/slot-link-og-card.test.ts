import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SLOT_LINK_OG_LINK_FIELDS } from "../../lib/bookings/slot-link";

describe("cartão OG do link", () => {
  it("não seleciona lembrete, token nem dados de quem reservou", () => {
    expect(SLOT_LINK_OG_LINK_FIELDS).toEqual([
      "id",
      "businessId",
      "serviceId",
      "startsAt",
      "endsAt",
      "expiresAt",
      "status",
      "bookingId",
      "payStartedAt",
      "payIdempotencyHash",
      "replacedByLinkId",
      "createdAt",
      "updatedAt",
    ]);
    expect(SLOT_LINK_OG_LINK_FIELDS).not.toContain("customerLabel");
    expect(SLOT_LINK_OG_LINK_FIELDS).not.toContain("tokenHash");
    expect(SLOT_LINK_OG_LINK_FIELDS).not.toContain("previewId");
  });

  it("o hold usado no status não traz valor, cliente nem telefone", () => {
    const source = readFileSync("lib/bookings/slot-link.ts", "utf8");
    const start = source.indexOf("async function linkedBooking");
    const end = source.indexOf("async function confirmedSlotLinkBooking");
    const fn = source.slice(start, end);
    expect(fn).toContain("id: schema.bookings.id");
    expect(fn).toContain("status: schema.bookings.status");
    expect(fn).toContain("expiresAt: schema.bookings.expiresAt");
    expect(fn).not.toContain("priceCents");
    expect(fn).not.toContain("depositCents");
    expect(fn).not.toContain("customerId");
    const og = source.slice(source.indexOf("export async function readSlotLinkOgCard"), source.indexOf("export async function purgeExpiredSlotLinkLabels"));
    expect(og).toContain("customerLabel: null");
    expect(og).not.toContain("schema.slotLinks.customerLabel");
    expect(og).not.toContain("schema.slotLinks.tokenHash");
    expect(og).not.toContain("schema.customers");
    expect(og).not.toContain("amountCents");
    expect(og).toContain("name: schema.businesses.name");
    expect(og).toContain("logoUrl: schema.businesses.logoUrl");
    expect(og).toContain("name: schema.services.name");
  });
});
