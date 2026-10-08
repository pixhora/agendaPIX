import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";
import { RefundDeepLink } from "@/components/dashboard/refund-deep-link";
import { StatusBadge } from "@/components/ui/status-badge";
import { dashboardOwnedBooking, ownedBusinesses } from "@/lib/dashboard/data";
import { agendaHref, asRefundStatus } from "@/lib/dashboard/refund-ui";
import { requireOwner } from "@/lib/dashboard/session";
import { localDate } from "@/lib/bookings/availability";
import { formatBusinessDateTime, formatBusinessDay } from "@/lib/payments/manual-refund-calendar";

export default async function AgendaBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ devolver?: string }>;
}) {
  const { bookingId } = await params;
  const query = await searchParams;
  const owner = await requireOwner();
  const located = await dashboardOwnedBooking(owner.id, bookingId);
  if (!located) notFound();
  const { business, booking } = located;
  const businesses = await ownedBusinesses(owner.id);
  const day = localDate(booking.startsAt, business.timezone);
  const when = formatBusinessDateTime(booking.startsAt, business.timezone);
  const dueLabel = booking.manualRefundDueAt
    ? formatBusinessDay(new Date(booking.manualRefundDueAt), business.timezone, true)
    : null;

  return (
    <DashboardShell
      title={booking.customerName}
      description={`${booking.serviceName} · ${when}`}
      path="/dashboard"
      businesses={businesses}
      businessId={business.id}
    >
      <Link className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4" href={agendaHref(business.id, day)}>Agenda</Link>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={booking.status} />
      </div>
      <RefundDeepLink
        businessId={business.id}
        bookingId={booking.id}
        devolver={query.devolver === "1"}
        serviceLine={`${booking.serviceName} · ${when}`}
        timeZone={business.timezone}
        dueTomorrow={booking.manualRefundDueTomorrow}
        dueLabel={dueLabel}
        refundStatus={asRefundStatus(booking.refundStatus)}
        depositCents={booking.depositCents}
        status={booking.status}
        day={day}
      />
    </DashboardShell>
  );
}
