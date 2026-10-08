export type PublicBookingFacts = {
  holdMinutes: number;
  pixRecipientDisplayName: string | null;
  requiresPayerCpf: boolean;
};

const HOLD_DEFAULT_MINUTES = 30;
const HOLD_MIN_MINUTES = 28;

function holdMinutesFromEnv(env: Readonly<Record<string, string | undefined>>): number {
  const raw = env.BOOKING_HOLD_MINUTES;
  if (raw === undefined || raw.trim() === "") return HOLD_DEFAULT_MINUTES;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < HOLD_MIN_MINUTES) return HOLD_DEFAULT_MINUTES;
  return parsed;
}

// Stub. The payments PR replaces this file on rebase.
export async function getPublicBookingFacts(businessId?: string): Promise<PublicBookingFacts> {
  void businessId;
  return {
    holdMinutes: holdMinutesFromEnv(process.env),
    pixRecipientDisplayName: null,
    requiresPayerCpf: process.env.MP_REQUIRES_PAYER_CPF === "true",
  };
}

/** "1 minuto" ou "30 minutos". O número nunca fica escrito no componente. */
export function formatMinutes(count: number): string {
  return count === 1 ? "1 minuto" : `${count} minutos`;
}
