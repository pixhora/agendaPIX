import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDuration,
  formatPhoneMask,
  formatCpfMask,
  isValidBrazilianPhone,
  isValidCpf,
  normalizePhoneToE164,
  formatTimeSlot,
  formatDateFull,
} from "../../components/booking/formatters";

describe("Booking UI formatters and helpers", () => {
  it("formats cents to BRL currency string correctly", () => {
    expect(formatCurrency(0)).toMatch(/R\$\s*0,00/);
    expect(formatCurrency(1500)).toMatch(/R\$\s*15,00/);
    expect(formatCurrency(4550)).toMatch(/R\$\s*45,50/);
    expect(formatCurrency(10000)).toMatch(/R\$\s*100,00/);
  });

  it("formats durations in minutes and hours", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30min");
    expect(formatDuration(125)).toBe("2h 5min");
  });

  it("applies Brazilian phone mask correctly", () => {
    expect(formatPhoneMask("11")).toBe("(11");
    expect(formatPhoneMask("119")).toBe("(11) 9");
    expect(formatPhoneMask("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhoneMask("+5511987654321")).toBe("(11) 98765-4321");
    expect(formatPhoneMask("5511987654321")).toBe("(11) 98765-4321");
    expect(formatPhoneMask("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhoneMask("abc11def987654321xyz")).toBe("(11) 98765-4321");
  });

  it("validates Brazilian phone numbers", () => {
    expect(isValidBrazilianPhone("(11) 98765-4321")).toBe(true);
    expect(isValidBrazilianPhone("+5511987654321")).toBe(true);
    expect(isValidBrazilianPhone("5511987654321")).toBe(true);
    expect(isValidBrazilianPhone("(21) 3333-4444")).toBe(true);
    expect(isValidBrazilianPhone("11987654321")).toBe(true);
    expect(isValidBrazilianPhone("123")).toBe(false);
    expect(isValidBrazilianPhone("")).toBe(false);
  });

  it("normalizes phone numbers to E.164 standard", () => {
    expect(normalizePhoneToE164("(11) 98765-4321")).toBe("+5511987654321");
    expect(normalizePhoneToE164("11987654321")).toBe("+5511987654321");
    expect(normalizePhoneToE164("+5511987654321")).toBe("+5511987654321");
    expect(normalizePhoneToE164("5511987654321")).toBe("+5511987654321");
  });

  it("applies CPF mask and validates check digits", () => {
    expect(formatCpfMask("52998224725")).toBe("529.982.247-25");
    expect(formatCpfMask("529982247")).toBe("529.982.247");
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("formats time slots and full dates with given timezone", () => {
    const iso = "2026-10-02T18:30:00.000Z";
    const timezone = "America/Sao_Paulo";
    const timeFormatted = formatTimeSlot(iso, timezone);
    expect(timeFormatted).toBe("15:30");

    const dateFormatted = formatDateFull(iso, timezone);
    expect(dateFormatted).toContain("outubro");
    expect(formatDateFull("2026-10-09T14:30:00.000Z", timezone)).toBe("sexta-feira, 9 de outubro");
    expect(formatDateFull("2026-10-09T14:30:00.000Z", timezone)).not.toContain("09");
  });
});

import { pixUiPhase, isPixQrUsable } from "../../components/booking/pix-status";

describe("Pix UI status helpers (contrato PixCharge)", () => {
  it("maps booking/payment statuses to pending|paid|expired|cancelled", () => {
    expect(pixUiPhase({ status: "pending_payment", payment: { status: "pending" } as never })).toBe("pending");
    expect(pixUiPhase({ status: "confirmed", payment: { status: "paid" } as never })).toBe("paid");
    expect(pixUiPhase({ status: "pending_payment", payment: { status: "paid" } as never })).toBe("paid");
    expect(pixUiPhase({ status: "expired", payment: { status: "expired" } as never })).toBe("expired");
    expect(pixUiPhase({ status: "pending_payment", payment: { status: "expired" } as never })).toBe("expired");
    expect(pixUiPhase({ status: "cancelled", payment: { status: "cancelled" } as never })).toBe("cancelled");
    expect(pixUiPhase({ status: "pending_payment", payment: { status: "failed" } as never })).toBe("cancelled");
  });

  it("accepts only PNG data URLs with copyPaste while pending", () => {
    expect(
      isPixQrUsable({
        status: "pending",
        qrCodeDataUrl: "data:image/png;base64,abc",
        copyPaste: "FAKE-PIX-NOT-PAYABLE:x",
      }),
    ).toBe(true);
    expect(
      isPixQrUsable({
        status: "pending",
        qrCodeDataUrl: "data:image/svg+xml;utf8,<svg/>",
        copyPaste: "FAKE-PIX-NOT-PAYABLE:x",
      }),
    ).toBe(false);
    expect(
      isPixQrUsable({
        status: "expired",
        qrCodeDataUrl: "data:image/png;base64,abc",
        copyPaste: "FAKE-PIX-NOT-PAYABLE:x",
      }),
    ).toBe(false);
  });
});
