import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS, KPI_ICONS } from "@/lib/icons/registry";
import { DashboardShell, Empty } from "@/components/dashboard/shell";
import { AgendaBoard, type AgendaDay, type AgendaItem } from "@/components/dashboard/agenda-board";
import { AgendaDatePicker } from "@/components/dashboard/agenda-date-picker";
import { PublicLink } from "@/components/dashboard/public-link";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusChip, ValueSlab } from "@/components/ui/value-slab";
import { buttonVariants } from "@/components/ui/button";
import { getBusinessBilling } from "@/lib/billing/status";
import { getDb } from "@/db";
import { dashboardBookings, dashboardServices, type DashboardBooking } from "@/lib/dashboard/data";
import { dashboardAgendaKpis, dashboardAgendaSummary, formatBrlCents } from "@/lib/dashboard/summary";
import { OwnerBillingNotice } from "@/components/dashboard/owner-billing-notice";
import { ownerContext } from "@/lib/dashboard/session";
import { dateSchema, shiftDate, weekDates } from "@/lib/dashboard/validation";
import { localDate } from "@/lib/bookings/availability";
import { cn } from "@/lib/utils";
import { SlotLinkPanel } from "@/components/slot-link/slot-link-panel";
import { getServiceBlockedReason, readMpDepositGate } from "@/lib/mercadopago-oauth/bookability";
import { createDrizzleMpStore } from "@/lib/mercadopago-oauth/repository";

const utcDay = (day: string) => new Date(`${day}T12:00:00Z`);
const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...options });

function KpiCard({ label, value, hint, icon, tone = "default" }: { label: string; value: string; hint: string; icon: React.ReactNode; tone?: "default" | "warning" }) {
  return <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-xl sm:size-10", tone === "warning" ? "bg-warning-soft text-warning" : "bg-pix-soft text-pix")}>{icon}</span>
    </div>
    <p className="mt-2 font-display text-3xl font-extrabold tabular-nums tracking-tight">{value}</p>
    <p className="mt-1 text-xs text-muted sm:text-sm">{hint}</p>
  </div>;
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ businessId?: string; date?: string; view?: string }> }) {
  const query = await searchParams;
  const { businesses, business, owner } = await ownerContext(query.businessId);
  const now = new Date();
  const timezone = business?.timezone ?? "America/Sao_Paulo";
  const parsedDate = dateSchema.safeParse(query.date);
  const today = localDate(now, timezone);
  const date = parsedDate.success ? parsedDate.data : today;
  const weekly = query.view === "week";
  const dates = weekly ? weekDates(date) : [date];
  const [agenda, billing, listedServices, mpGate] = business
    ? await Promise.all([
      dashboardBookings(owner.id, business.id, dates, getDb(), business),
      getBusinessBilling(business.id, owner.id),
      dashboardServices(owner.id, business.id, getDb(), business),
      readMpDepositGate(business.id, { store: createDrizzleMpStore(getDb()) }),
    ])
    : [{ bookings: [] as DashboardBooking[], reversedDepositsPendingCount: 0 }, null, [], null];
  const bookings = agenda.bookings;
  const depositServices = listedServices
    .filter((service) => service.active && service.depositCents > 0)
    .map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      depositCents: service.depositCents,
    }));
  const mpReady = mpGate ? getServiceBlockedReason({ depositCents: 1 }, mpGate) === null : false;
  const summary = business ? dashboardAgendaSummary(bookings, date, timezone, now) : null;
  const kpis = dashboardAgendaKpis(bookings, now);

  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  const longLabel = (day: string) => format({ weekday: "long", day: "numeric", month: "long" }).format(utcDay(day));
  const pickerLabel = (day: string) => format({ weekday: "short", day: "numeric", month: "short" }).format(utcDay(day)).replace(/^./, (letter) => letter.toUpperCase());
  const view = weekly ? "week" : "day";
  const hrefBase = `/dashboard?businessId=${business?.id}&view=${view}`;
  const href = (day: string, nextView = view) => `/dashboard?businessId=${business?.id}&date=${day}&view=${nextView}`;
  const money = (cents: number) => formatBrlCents(BigInt(cents));

  const days: AgendaDay[] = dates.map((day) => ({
    date: day,
    label: longLabel(day),
    weekday: format({ weekday: "short" }).format(utcDay(day)).replace(".", ""),
    dayNumber: format({ day: "numeric" }).format(utcDay(day)),
    isToday: day === today,
  }));
  const items: AgendaItem[] = bookings.map((booking) => ({
    id: booking.id,
    day: localDate(booking.startsAt, timezone),
    start: time.format(booking.startsAt),
    end: time.format(booking.endsAt),
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    serviceName: booking.serviceName,
    status: booking.status,
    price: money(booking.priceCents),
    deposit: money(booking.depositCents),
    remaining: money(Math.max(0, booking.priceCents - booking.depositCents)),
    hasDeposit: booking.depositCents > 0,
  }));

  const periodWord = weekly ? "na semana" : date === today ? "hoje" : "no dia";
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const description = weekly
    ? `Semana de ${format({ day: "numeric", month: "short" }).format(utcDay(firstDay.date))} a ${format({ day: "numeric", month: "short" }).format(utcDay(lastDay.date))}`
    : `${longLabel(date).replace(/^./, (letter) => letter.toUpperCase())}${date === today ? " · hoje" : ""}`;
  const nextBooking = summary?.nextReservation;

  return <DashboardShell title={business ? `Agenda de ${business.name}` : "Sua agenda"} description={description} path="/dashboard" businesses={businesses} businessId={business?.id} notice={business && billing ? <OwnerBillingNotice ownerId={owner.id} businessId={business.id} timeZone={business.timezone} publicSlug={business.slug} billing={billing} /> : undefined}>
    {business && summary && <>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Navegar por datas" className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <Link prefetch className={buttonVariants({ variant: "outline", size: "icon" })} href={href(shiftDate(date, weekly ? -7 : -1))} aria-label={weekly ? "Semana anterior" : "Dia anterior"}><ChevronLeft aria-hidden="true" /></Link>
          <Link prefetch className={buttonVariants({ variant: date === today ? "default" : "outline", className: "px-4" })} href={href(today)} aria-current={date === today ? "date" : undefined}>Hoje</Link>
          <Link prefetch className={buttonVariants({ variant: "outline", size: "icon" })} href={href(shiftDate(date, weekly ? 7 : 1))} aria-label={weekly ? "Próxima semana" : "Próximo dia"}><ChevronRight aria-hidden="true" /></Link>
          <AgendaDatePicker key={date} date={date} label={pickerLabel(date)} hrefBase={hrefBase} />
        </nav>
        <nav aria-label="Visualização da agenda" className="grid w-full grid-cols-2 rounded-full border border-line bg-surface p-1 sm:ml-auto sm:inline-flex sm:w-auto">
          {(["day", "week"] as const).map((option) => <Link prefetch key={option} href={href(date, option)} aria-current={view === option ? "page" : undefined} className={cn("inline-flex min-h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition-feedback focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", view === option ? "bg-ink text-paper" : "text-muted hover:text-ink")}>{option === "day" ? "Dia" : "Semana"}</Link>)}
        </nav>
      </div>
      {query.date && !parsedDate.success && <p role="alert" className="rounded-card border border-warning/30 bg-warning-soft p-4 text-sm text-warning">Data inválida. Mostrando a agenda de hoje; escolha uma data válida.</p>}

      <section aria-label="Resumo da agenda" className="grid grid-cols-2 gap-3 lg:grid-cols-[1.35fr_1fr_1fr] lg:gap-4">
        <ValueSlab
          size="compact"
          className="col-span-2 lg:col-span-1"
          label={`Receita via Pix ${periodWord}`}
          value={formatBrlCents(kpis.pixRevenueCents)}
          badge={<StatusChip tone="slab" active={kpis.pixRevenueCount > 0}>{kpis.pixRevenueCount === 1 ? "1 sinal pago" : `${kpis.pixRevenueCount} sinais pagos`}</StatusChip>}
          sublabel="Sinais confirmados pelo Pix. O restante você recebe no atendimento."
        />
        <KpiCard label={`Agendamentos ${periodWord}`} value={String(kpis.bookingCount)} hint={`${kpis.confirmedCount} confirmados`} icon={<Icon icon={KPI_ICONS.bookings} size="md" />} />
        <KpiCard label="Aguardando sinal" value={String(kpis.pendingCount)} hint={kpis.pendingCount ? `${formatBrlCents(kpis.pendingSignalCents)} a confirmar` : "Nenhum Pix pendente"} icon={<Icon icon={KPI_ICONS.pending} size="md" />} tone={kpis.pendingCount ? "warning" : "default"} />
      </section>

      {nextBooking && <section aria-label="Próximo atendimento" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-pix/25 bg-pix-soft px-4 py-3 text-sm sm:px-5">
        <CalendarClock aria-hidden="true" className="size-5 shrink-0 text-pix" />
        <p className="min-w-0 flex-1 basis-[calc(100%-2.25rem)] sm:basis-0"><span className="font-semibold">Próximo atendimento: </span><span className="tabular-nums">{date === localDate(nextBooking.startsAt, timezone) ? "" : `${pickerLabel(localDate(nextBooking.startsAt, timezone))}, `}{time.format(nextBooking.startsAt)}</span> · {nextBooking.customerName} · {nextBooking.serviceName}</p>
        <StatusBadge status={nextBooking.status} />
      </section>}

      <SlotLinkPanel businessId={business.id} slug={business.slug} timezone={timezone} date={date} today={today} services={depositServices} mpReady={mpReady} />
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{weekly ? "Semana" : "Atendimentos"}</h2>
        <p aria-live="polite" className="text-sm text-muted">{bookings.length} {bookings.length === 1 ? "agendamento" : "agendamentos"}</p>
      </div>
      {!bookings.length && !weekly ? <Empty title="Nenhum atendimento neste dia" icon={<Icon icon={ACTION_ICONS.emptyAgenda} size="md" />}>
        <p>Compartilhe o link da sua página para receber reservas com sinal via Pix.</p>
        <div className="mx-auto mt-4 max-w-sm text-left"><PublicLink slug={business.slug} /></div>
        <Link className="mt-3 inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4" href={`/dashboard/settings?businessId=${business.id}`}>Conferir horários de funcionamento</Link>
      </Empty> : <AgendaBoard days={days} bookings={items} weekly={weekly} businessName={business.name} />}
    </>}
  </DashboardShell>;
}
