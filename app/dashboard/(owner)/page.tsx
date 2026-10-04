import Link from "next/link";
import { BookingStatus } from "@/components/dashboard/booking-status";
import { DashboardShell, Empty } from "@/components/dashboard/shell";
import { buttonVariants } from "@/components/ui/button";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardBookings } from "@/lib/dashboard/data";
import { dateSchema, shiftDate, weekDates } from "@/lib/dashboard/validation";
import { localDate } from "@/lib/bookings/availability";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ businessId?: string; date?: string; view?: string }> }) {
  const query = await searchParams;
  const { businesses, business, owner } = await ownerContext(query.businessId);
  const parsedDate = dateSchema.safeParse(query.date);
  const date = parsedDate.success ? parsedDate.data : localDate(new Date(), business?.timezone ?? "America/Sao_Paulo");
  const weekly = query.view === "week";
  const dates = weekly ? weekDates(date) : [date];
  const bookings = business ? await dashboardBookings(owner.id, business.id, dates) : [];
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: business?.timezone ?? "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const dayLabel = (day: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(`${day}T12:00:00Z`));
  const href = (day: string, view = weekly ? "week" : "day") => `/dashboard?businessId=${business?.id}&date=${day}&view=${view}`;
  return <DashboardShell title={business ? `Agenda de ${business.name}` : "Sua agenda"} description="Veja seus atendimentos e saiba quais horários já estão confirmados." path="/dashboard" businesses={businesses} businessId={business?.id}>
    {business && <>
      <div className="grid gap-4 rounded-xl border border-border bg-background p-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:p-5">
        <form action="/dashboard" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="businessId" value={business.id} /><input type="hidden" name="view" value={weekly ? "week" : "day"} />
          <label htmlFor="agenda-date" className="grid gap-2 text-sm font-medium">Data<input key={date} id="agenda-date" type="date" name="date" defaultValue={date} required className="min-h-11 rounded-md border border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring" /></label>
          <button type="submit" className={buttonVariants({ variant: "outline", className: "w-full justify-center sm:w-auto" })}>Ver horários</button>
        </form>
        <nav aria-label="Visualização da agenda" className="grid grid-cols-2 gap-2 sm:flex">
          <Link className={buttonVariants({ variant: weekly ? "outline" : "default", className: "justify-center" })} aria-current={!weekly ? "page" : undefined} href={href(date, "day")}>Dia</Link>
          <Link className={buttonVariants({ variant: weekly ? "default" : "outline", className: "justify-center" })} aria-current={weekly ? "page" : undefined} href={href(date, "week")}>Semana</Link>
        </nav>
      </div>
      {query.date && !parsedDate.success && <p role="alert">Data inválida. Mostrando a agenda de hoje; escolha uma data válida.</p>}
      <nav aria-label="Navegar por datas" className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Link className={buttonVariants({ variant: "outline", className: "justify-center px-2 text-center text-xs sm:px-4 sm:text-sm" })} href={href(shiftDate(date, weekly ? -7 : -1))}>{weekly ? "Semana anterior" : "Dia anterior"}</Link>
        <Link className={buttonVariants({ variant: "default", className: "justify-center px-3 sm:px-4" })} href={href(localDate(new Date(), business.timezone))}>Hoje</Link>
        <Link className={buttonVariants({ variant: "outline", className: "justify-center px-2 text-center text-xs sm:px-4 sm:text-sm" })} href={href(shiftDate(date, weekly ? 7 : 1))}>{weekly ? "Próxima semana" : "Próximo dia"}</Link>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-sm text-muted-foreground"><p>Horários em {business.timezone}</p><p aria-live="polite">{bookings.length} {bookings.length === 1 ? "agendamento" : "agendamentos"}</p></div>
      {!bookings.length && <Empty title="Nenhum atendimento neste período"><p>Confira o funcionamento para disponibilizar horários aos clientes.</p><Link className="inline-flex min-h-11 items-center text-primary underline" href={`/dashboard/settings?businessId=${business.id}`}>Conferir funcionamento</Link></Empty>}
      <div className={weekly ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3" : "grid gap-5"}>{dates.map((day) => <section key={day} aria-label={dayLabel(day)} className="min-w-0 border-t border-border pt-4"><h2 className="mb-3 text-lg font-semibold capitalize">{dayLabel(day)}</h2><ol className="space-y-2">{bookings.filter((booking) => localDate(booking.startsAt, business.timezone) === day).map((booking) => <li key={booking.id} className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 rounded-md border border-l-2 border-l-primary bg-background p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-4 sm:p-4"><div className="border-r border-border pr-3 tabular-nums sm:pr-4"><p className="text-lg font-semibold">{time.format(booking.startsAt)}</p><p className="mt-1 text-sm text-muted-foreground">{time.format(booking.endsAt)}</p></div><div className="min-w-0 self-center"><h3 className="break-words font-semibold">{booking.customerName}</h3><p className="break-words text-sm text-muted-foreground">{booking.serviceName}</p><p className="mt-2 text-sm font-medium"><BookingStatus status={booking.status} /></p></div></li>)}</ol>{weekly && !bookings.some((booking) => localDate(booking.startsAt, business.timezone) === day) && <p className="py-4 text-sm text-muted-foreground">Sem atendimentos.</p>}</section>)}</div>
    </>}
  </DashboardShell>;
}
