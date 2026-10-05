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

export function formatBrlCents(cents: bigint) {
  const wholeReais = new Intl.NumberFormat("pt-BR").format(cents / 100n);
  const fractionalReais = (cents % 100n).toString().padStart(2, "0");
  return `R$\u00a0${wholeReais},${fractionalReais}`;
}
