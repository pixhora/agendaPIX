import { localDate } from "../bookings/availability";
import type { DashboardBooking } from "./data";

export function dashboardAgendaSummary(
  bookings: DashboardBooking[],
  date: string,
  timezone: string,
  now: Date,
) {
  const selectedDay = bookings.filter((booking) => localDate(booking.startsAt, timezone) === date);
  const confirmedSignals = selectedDay.filter(
    (booking) => booking.status === "confirmed" && booking.depositCents > 0,
  );
  const nextReservation = bookings
    .filter((booking) => booking.startsAt > now)
    .filter((booking) => {
      if (booking.status === "confirmed") return true;
      return booking.status === "pending_payment" && booking.expiresAt !== null && booking.expiresAt > now;
    })
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())[0] ?? null;

  return {
    confirmedSignalCents: confirmedSignals.reduce((total, booking) => total + BigInt(booking.depositCents), 0n),
    confirmedSignalCount: confirmedSignals.length,
    nextReservation,
  };
}

/**
 * Indicadores do período exibido (dia ou semana) para os cards do painel.
 * Receita via Pix = sinais de reservas confirmadas ou concluídas. Pendentes = aguardando sinal e ainda no prazo.
 */
export function dashboardAgendaKpis(bookings: DashboardBooking[], now: Date) {
  const active = bookings.filter((booking) => booking.status !== "cancelled" && booking.status !== "expired");
  const paid = active.filter((booking) => (booking.status === "confirmed" || booking.status === "completed") && booking.depositCents > 0);
  const pending = active.filter((booking) => booking.status === "pending_payment" && (booking.expiresAt === null || booking.expiresAt > now));
  return {
    bookingCount: active.length,
    confirmedCount: active.filter((booking) => booking.status === "confirmed" || booking.status === "completed").length,
    pendingCount: pending.length,
    pendingSignalCents: pending.reduce((total, booking) => total + BigInt(booking.depositCents), 0n),
    pixRevenueCents: paid.reduce((total, booking) => total + BigInt(booking.depositCents), 0n),
    pixRevenueCount: paid.length,
  };
}

export function formatBrlCents(cents: bigint) {
  const wholeReais = new Intl.NumberFormat("pt-BR").format(cents / 100n);
  const fractionalReais = (cents % 100n).toString().padStart(2, "0");
  return `R$\u00a0${wholeReais},${fractionalReais}`;
}
