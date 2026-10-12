export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}

/**
 * Dígitos nacionais (DDD + número).
 * Tira o que não é dígito, o +55/55 quando a sequência tem 12 ou 13 dígitos,
 * e um zero de operadora na frente (011…).
 */
export function nationalPhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function formatPhoneMask(value: string): string {
  const digits = nationalPhoneDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function normalizePhoneToE164(formattedOrRaw: string): string {
  return `+55${nationalPhoneDigits(formattedOrRaw)}`;
}

export function isValidBrazilianPhone(value: string): boolean {
  const digits = nationalPhoneDigits(value);
  return digits.length === 10 || digits.length === 11;
}

export function formatTimeSlot(isoString: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(isoString));
  } catch {
    const date = new Date(isoString);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
}

/** Metadado curto da reserva: "qui, 15 out · 15:30". */
export function formatAppointmentMeta(isoString: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).formatToParts(new Date(isoString));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value.replace(/\./g, "") ?? "";
  return `${value("weekday")}, ${value("day")} ${value("month")} · ${formatTimeSlot(isoString, timezone)}`;
}

export function formatDateFull(isoStringOrDate: string | Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: timezone,
    }).format(typeof isoStringOrDate === "string" ? new Date(isoStringOrDate) : isoStringOrDate);
  } catch {
    return new Date(isoStringOrDate).toLocaleDateString("pt-BR");
  }
}

/** Máscara de CPF: 000.000.000-00 */
export function formatCpfMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function cpfDigitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** Valida dígitos verificadores do CPF (algoritmo oficial BR). */
export function isValidCpf(value: string): boolean {
  const cpf = cpfDigitsOnly(value);
  if (!/^\d{11}$/.test(cpf) || /^([0-9])\1+$/.test(cpf)) return false;
  const calc = (length: number) => {
    const sum = cpf.slice(0, length).split("").reduce((total, char, index) => total + Number(char) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}
