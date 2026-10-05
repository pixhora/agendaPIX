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

export function formatPhoneMask(value: string): string {
  let cleanDigits = value.replace(/\D/g, "");
  if (cleanDigits.startsWith("55") && cleanDigits.length >= 12) {
    cleanDigits = cleanDigits.slice(2);
  }
  const digits = cleanDigits.slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function normalizePhoneToE164(formattedOrRaw: string): string {
  let digits = formattedOrRaw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return `+55${digits}`;
}

export function isValidBrazilianPhone(value: string): boolean {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
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

export function formatDateFull(isoStringOrDate: string | Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone: timezone,
    }).format(typeof isoStringOrDate === "string" ? new Date(isoStringOrDate) : isoStringOrDate);
  } catch {
    return new Date(isoStringOrDate).toLocaleDateString("pt-BR");
  }
}
