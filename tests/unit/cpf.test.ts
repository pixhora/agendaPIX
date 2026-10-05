import { describe, expect, it } from "vitest";
import { cpfDigits, isValidCpf, normalizeCpf } from "../../lib/validation/cpf";

describe("validação de CPF", () => {
  it("aceita CPF matematicamente válido e rejeita inválidos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(cpfDigits("529.982.247-25")).toBe("52998224725");
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("12345678900")).toBe(false);
    expect(() => normalizeCpf("00000000000")).toThrow("CPF inválido");
  });
});
