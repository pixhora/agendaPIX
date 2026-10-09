/**
 * Cenário D+6 da véspera. O pedido fica entre o dia do pagamento e hoje.
 * Serviço em sex, 2 out, 15:00 (America/Sao_Paulo). Prazo 2026-10-09, hoje 2026-10-08.
 */
export const refundEveScenario = {
  timeZone: "America/Sao_Paulo",
  paidOnLocal: "2026-09-29",
  paidAt: "2026-09-29T17:02:00.000Z",
  requestedOn: "2026-10-02",
  todayLocal: "2026-10-08",
  manualRefundDueAt: "2026-10-09",
  serviceStartsAt: "2026-10-02T18:00:00.000Z",
  serviceEndsAt: "2026-10-02T18:30:00.000Z",
  bookingStatus: "cancelled",
} as const;

export function refundRequestOrderHolds(input: { paidOnLocal: string; requestedOn: string; todayLocal: string }) {
  return input.paidOnLocal <= input.requestedOn && input.requestedOn <= input.todayLocal;
}
