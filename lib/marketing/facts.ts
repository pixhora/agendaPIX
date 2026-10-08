import { bookingConfig } from "@/lib/bookings/config";

export type PublicBookingFacts = {
  holdMinutes: number;
  pixRecipientDisplayName: string | null;
  requiresPayerCpf: boolean;
};

// provisório: substituído pelo BE-04 no rebase
export async function getPublicBookingFacts(businessId?: string): Promise<PublicBookingFacts> {
  void businessId;
  const { BOOKING_HOLD_MINUTES } = bookingConfig();
  return {
    holdMinutes: BOOKING_HOLD_MINUTES,
    // Landing chama sem businessId: o sinal cai na conta Mercado Pago do dono.
    pixRecipientDisplayName: null,
    // O fluxo público ainda exige CPF até o BE-22 confirmar o contrário.
    requiresPayerCpf: true,
  };
}

/** "1 minuto" ou "30 minutos". O número nunca fica escrito no componente. */
export function formatMinutes(count: number): string {
  return count === 1 ? "1 minuto" : `${count} minutos`;
}

export function minutesUnit(count: number): string {
  return count === 1 ? "minuto" : "minutos";
}
