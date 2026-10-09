import { describe, expect, it } from "vitest";
import { centsFromTypedField, depositFromPercent, formatCents, parsePastedMoney } from "../../lib/money";

describe("money input", () => {
  it("treats typed digits as cents", () => {
    expect(centsFromTypedField("6590")).toEqual({ cents: 6590, overflow: false });
    expect(formatCents(6590)).toBe("65,90");
    expect(centsFromTypedField("")).toEqual({ cents: null, overflow: false });
  });

  it("parses pasted reais without float math", () => {
    expect(parsePastedMoney("R$ 1.234,56")).toBe(123456);
    expect(parsePastedMoney("65,90")).toBe(6590);
    expect(parsePastedMoney("65.9")).toBe(6590);
    expect(parsePastedMoney("R$ 65,90")).toBe(6590);
    expect(parsePastedMoney("não")).toBeNull();
  });

  it("rounds the deposit from the price in cents", () => {
    expect(depositFromPercent(6590, 30)).toBe(1977);
    expect(depositFromPercent(6590, 0)).toBe(0);
    expect(depositFromPercent(0, 30)).toBe(0);
  });
});
