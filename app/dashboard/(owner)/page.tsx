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
      <div className="flex flex-wrap items-end justify-between gap-4"><form action="/dashboard" className="flex flex-wrap items-end gap-2"><input type="hidden" name="businessId" value={business.id} /><input type="hidden" name="view" value={weekly ? "week" : "day"} /><label htmlFor="agenda-date" className="grid gap-2">Data<input id="agenda-date" type="date" name="date" defaultValue={date} required className="min-h-11 rounded-md border border-border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring" /></label><button type="submit" className={buttonVariants({ variant: "outline" })}>Ver horários</button></form><nav aria-label="Visualização da agenda" className="flex gap-2"><Link className={buttonVariants({ variant: weekly ? "outline" : "default" })} aria-current={!weekly ? "page" : undefined} href={href(date, "day")}>Dia</Link><Link className={buttonVariants({ variant: weekly ? "default" : "outline" })} aria-current={weekly ? "page" : undefined} href={href(date, "week")}>Semana</Link></nav></div>
      {query.date && !parsedDate.success && <p role="alert">Data inválida. Mostrando a agenda de hoje; escolha uma data válida.</p>}
      <nav aria-label="Navegar por datas" className="flex flex-wrap gap-2"><Link className={buttonVariants({ variant: "outline" })} href={href(shiftDate(date, weekly ? -7 : -1))}>{weekly ? "Semana anterior" : "Dia anterior"}</Link><Link className={buttonVariants({ variant: "outline" })} href={href(localDate(new Date(), business.timezone))}>Hoje</Link><Link className={buttonVariants({ variant: "outline" })} href={href(shiftDate(date, weekly ? 7 : 1))}>{weekly ? "Próxima semana" : "Próximo dia"}</Link></nav>
      <p className="text-sm text-muted-foreground">Horários em {business.timezone} · {bookings.length} {bookings.length === 1 ? "agendamento" : "agendamentos"}</p>
      {!bookings.length && <Empty title="Nenhum atendimento neste período"><p>Confira o funcionamento para disponibilizar horários aos clientes.</p><Link className="inline-flex min-h-11 items-center text-primary underline" href={`/dashboard/settings?businessId=${business.id}`}>Conferir funcionamento</Link></Empty>}
      <div className={weekly ? "grid gap-6 md:grid-cols-2 xl:grid-cols-3" : "grid gap-6"}>{dates.map((day) => <section key={day} className="min-w-0"><h2 className="mb-3 border-b-2 border-primary pb-3 text-xl font-semibold">{dayLabel(day)}</h2><ol className="space-y-3">{bookings.filter((booking) => localDate(booking.startsAt, business.timezone) === day).map((booking) => <li key={booking.id} className="flex gap-4 rounded-lg bg-muted p-4"><div className="shrink-0 border-r border-border pr-4 tabular-nums"><p className="text-xl font-semibold">{time.format(booking.startsAt)}</p><p className="mt-1 text-sm text-muted-foreground">{time.format(booking.endsAt)}</p></div><div className="min-w-0"><h3 className="break-words font-semibold">{booking.customerName}</h3><p className="break-words text-muted-foreground">{booking.serviceName}</p><p className="mt-2 text-sm font-medium"><BookingStatus status={booking.status} /></p></div></li>)}</ol>{!bookings.some((booking) => localDate(booking.startsAt, business.timezone) === day) && <p className="py-4 text-muted-foreground">Sem atendimentos.</p>}</section>)}</div>
    </>}
  </DashboardShell>;
}
