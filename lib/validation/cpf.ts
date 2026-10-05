/** Dígitos somente; remove máscara. */
export function cpfDigits(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Valida CPF pelo algoritmo oficial (dígitos verificadores).
 * Rejeita sequências repetidas (000... / 111...).
 */
export function isValidCpf(value: string) {
  const cpf = cpfDigits(value);
  if (!/^\d{11}$/.test(cpf) || /^([0-9])\1+$/.test(cpf)) return false;
  const calc = (length: number) => {
    const sum = cpf.slice(0, length).split("").reduce((total, char, index) => total + Number(char) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/** CPF com 11 dígitos e dígitos verificadores válidos (sem máscara). */
export function normalizeCpf(value: string) {
  const cpf = cpfDigits(value);
  if (!isValidCpf(cpf)) throw new Error("CPF inválido.");
  return cpf;
}
