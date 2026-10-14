"use client";

import { useEffect, useRef, useState } from "react";
import { Wallet, X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS, SUMMARY_ICONS } from "@/lib/icons/registry";
import { bookingWhatsapp } from "@/lib/dashboard/whatsapp-reminder";
import { StatusBadge, type BookingStatusValue } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AgendaItem = {
  id: string;
  day: string;
  start: string;
  end: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  status: BookingStatusValue;
  price: string;
  deposit: string;
  remaining: string;
  remainingCents: number;
  hasDeposit: boolean;
  /** Começa depois de agora. Só reserva confirmada e futura vira lembrete no WhatsApp. */
  upcoming: boolean;
};

export type AgendaDay = { date: string; label: string; weekday: string; dayNumber: string; isToday: boolean };

const inactive = (status: BookingStatusValue) => status === "cancelled" || status === "expired";

function BookingDetail({ booking, day, businessName, onClose }: { booking: AgendaItem | null; day?: AgendaDay; businessName: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (booking && !dialog.open) dialog.showModal();
    if (!booking && dialog.open) dialog.close();
  }, [booking]);
  const whatsapp = booking ? bookingWhatsapp({ ...booking, businessName, dayLabel: day?.label ?? "" }) : null;
  // "Lembrar no WhatsApp" não cabe em meia largura a 375px: no lembrete os dois botões ocupam a linha toda.
  const reminder = whatsapp?.kind === "reminder";
  return (
    <dialog
      ref={ref}
      aria-labelledby="booking-detail-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
      className={cn(
        "fixed m-0 max-h-none max-w-none border-0 bg-surface p-0 text-ink shadow-[var(--shadow-raised)] backdrop:bg-black/45",
        "inset-x-0 bottom-0 top-auto max-h-[88dvh] w-full rounded-t-frame",
        "lg:inset-y-0 lg:left-auto lg:right-0 lg:h-dvh lg:max-h-dvh lg:w-[28rem] lg:rounded-none lg:rounded-l-frame",
      )}
    >
      {booking && <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0">
            <StatusBadge status={booking.status} />
            <h2 id="booking-detail-title" className="mt-3 break-words font-display text-2xl font-extrabold tracking-tight">{booking.customerName}</h2>
            <p className="mt-0.5 text-sm text-muted">{booking.customerPhone}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => ref.current?.close()} aria-label="Fechar detalhes"><X aria-hidden="true" /></Button>
        </div>
        <dl className="grid gap-4 overflow-y-auto px-5 py-5 text-sm sm:px-6">
          <div className="grid grid-cols-[1rem_1fr] gap-x-3 gap-y-0.5"><dt className="col-span-2 grid grid-cols-subgrid items-center text-muted"><Icon icon={SUMMARY_ICONS.date} className="text-muted" />Data</dt><dd className="col-start-2 font-semibold capitalize">{day?.label}</dd></div>
          <div className="grid grid-cols-[1rem_1fr] gap-x-3 gap-y-0.5"><dt className="col-span-2 grid grid-cols-subgrid items-center text-muted"><Icon icon={SUMMARY_ICONS.time} className="text-muted" />Horário</dt><dd className="col-start-2 font-semibold tabular-nums">{booking.start} – {booking.end}</dd></div>
          <div className="grid grid-cols-[1rem_1fr] gap-x-3 gap-y-0.5"><dt className="col-span-2 grid grid-cols-subgrid items-center text-muted"><Icon icon={SUMMARY_ICONS.service} className="text-muted" />Serviço</dt><dd className="col-start-2 font-semibold">{booking.serviceName}</dd></div>
          <div className="grid grid-cols-[1rem_1fr] gap-x-3 gap-y-0.5">
            <dt className="col-span-2 grid grid-cols-subgrid items-center text-muted"><Wallet aria-hidden="true" className="size-4" />Valores</dt>
            <dd className="col-start-2 mt-1 grid gap-1.5 rounded-field bg-subtle p-3 tabular-nums">
              <span className="flex justify-between gap-3"><span>Total do serviço</span><span className="font-semibold">{booking.price}</span></span>
              <span className="flex justify-between gap-3"><span>Sinal via Pix</span><span className="font-semibold">{booking.hasDeposit ? booking.deposit : "Sem sinal"}</span></span>
              <span className="flex justify-between gap-3 border-t border-line pt-1.5"><span>A receber no atendimento</span><span className="font-bold">{booking.remaining}</span></span>
            </dd>
          </div>
        </dl>
        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-line px-5 py-4 sm:px-6">
          <a className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", reminder && "col-span-2")} href={whatsapp?.url} target="_blank" rel="noopener noreferrer"><Icon icon={ACTION_ICONS.whatsapp} size="md" />{reminder ? "Lembrar no WhatsApp" : "WhatsApp"}<span className="sr-only"> (abre em nova aba)</span></a>
          <a className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", reminder && "col-span-2")} href={`tel:${booking.customerPhone}`}><Icon icon={ACTION_ICONS.phone} size="md" />Ligar</a>
        </div>
      </div>}
    </dialog>
  );
}

function DayRow({ booking, onOpen }: { booking: AgendaItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className={cn(
          "group grid w-full grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-card border border-line bg-surface p-4 text-left transition-feedback hover:border-line-strong hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "md:grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1fr)_7rem_minmax(0,13rem)] md:rounded-none md:border-0 md:border-b md:px-5 md:py-3.5 md:last:border-b-0",
          // Sem opacity: muted@0.7 sobre surface cai ~3,3:1 (abaixo de AA). Inativo fica com riscado + text-muted.
          inactive(booking.status) && "bg-subtle",
        )}
      >
        <span className="row-span-2 self-start border-r border-line pr-3 tabular-nums md:row-span-1 md:self-center md:border-0 md:pr-0">
          <span className={cn("block font-display text-lg font-bold leading-tight", inactive(booking.status) && "text-muted")}>{booking.start}</span>
          <span className="block text-xs text-muted">até {booking.end}</span>
        </span>
        <span className="min-w-0">
          <span className={cn("block truncate font-semibold", inactive(booking.status) && "text-muted line-through decoration-muted")}>{booking.customerName}</span>
          <span className="block truncate text-sm text-muted md:hidden">{booking.serviceName}</span>
        </span>
        <span className="hidden truncate text-sm text-muted md:block">{booking.serviceName}</span>
        <span className="hidden text-sm font-semibold tabular-nums md:block">{booking.hasDeposit ? booking.deposit : "—"}</span>
        <span className="col-start-2 md:col-start-auto"><StatusBadge status={booking.status} /></span>
      </button>
    </li>
  );
}

function WeekCard({ booking, onOpen }: { booking: AgendaItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className={cn(
          "grid w-full gap-1.5 rounded-field border border-line bg-surface p-3 text-left transition-feedback hover:border-line-strong hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          booking.status === "confirmed" && "border-l-4 border-l-pix",
          booking.status === "pending_payment" && "border-l-4 border-l-warning",
          inactive(booking.status) && "bg-subtle",
        )}
      >
        <span className="text-xs font-bold tabular-nums text-muted">{booking.start}–{booking.end}</span>
        <span className={cn("truncate text-sm font-semibold", inactive(booking.status) && "text-muted line-through decoration-muted")}>{booking.customerName}</span>
        <span className="truncate text-xs text-muted">{booking.serviceName}</span>
        <StatusBadge status={booking.status} compact className="justify-self-start" />
      </button>
    </li>
  );
}

/** Lista do dia (tabela no desktop, cartões no celular) ou colunas por dia na semana; detalhe em painel lateral. */
export function AgendaBoard({ days, bookings, weekly, businessName }: { days: AgendaDay[]; bookings: AgendaItem[]; weekly: boolean; businessName: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;
  const selectedDay = selected ? days.find((day) => day.date === selected.day) : undefined;

  return (
    <>
      {weekly ? (
        <div className="grid gap-4 lg:grid-cols-7 lg:gap-2">
          {days.map((day) => {
            const items = bookings.filter((booking) => booking.day === day.date);
            return (
              <section key={day.date} aria-label={day.label} className="min-w-0 lg:rounded-card lg:border lg:border-line lg:bg-subtle/50 lg:p-2">
                <h2 className={cn("mb-2 flex items-baseline gap-2 px-1 lg:flex-col lg:items-center lg:gap-0 lg:py-1", day.isToday && "text-pix")}>
                  <span className="text-xs font-bold uppercase tracking-wide">{day.weekday}</span>
                  <span className={cn("font-display text-lg font-extrabold tabular-nums lg:flex lg:size-9 lg:items-center lg:justify-center lg:rounded-full", day.isToday && "lg:bg-pix lg:text-pix-foreground")}>{day.dayNumber}</span>
                  {day.isToday && <span className="text-xs font-semibold lg:sr-only">Hoje</span>}
                </h2>
                {items.length ? <ol className="grid gap-2">{items.map((booking) => <WeekCard key={booking.id} booking={booking} onOpen={() => setSelectedId(booking.id)} />)}</ol>
                  : <p className="rounded-field border border-dashed border-line px-3 py-3 text-xs text-muted lg:border-0 lg:text-center">Sem atendimentos</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="md:overflow-hidden md:rounded-card md:border md:border-line md:bg-surface">
          <div aria-hidden="true" className="hidden grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1fr)_7rem_minmax(0,13rem)] gap-x-4 border-b border-line bg-subtle/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
            <span>Horário</span><span>Cliente</span><span>Serviço</span><span>Sinal Pix</span><span>Status</span>
          </div>
          <ol className="grid gap-2 md:gap-0" aria-label={`Atendimentos de ${days[0]?.label ?? "hoje"}`}>
            {bookings.map((booking) => <DayRow key={booking.id} booking={booking} onOpen={() => setSelectedId(booking.id)} />)}
          </ol>
        </div>
      )}
      <BookingDetail booking={selected} day={selectedDay} businessName={businessName} onClose={() => setSelectedId(null)} />
    </>
  );
}
