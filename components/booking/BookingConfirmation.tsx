"use client";

import React, { useMemo } from "react";
import type { AvailabilitySlot, BookingPolicyView, PublicService } from "./types";
import { formatCurrency, formatDateFull, formatTimeSlot, formatDuration } from "./formatters";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CONFIRMATION_ICONS } from "@/lib/icons/registry";
import { ReservedTimeBand } from "./ReservedTimeBand";

interface BookingConfirmationProps {
  businessName: string;
  service: PublicService;
  slot: AvailabilitySlot;
  timezone: string;
  customerName: string;
  customerPhone: string;
  /** Snapshot gravado na reserva. A tela só mostra o que o servidor mandou. */
  policy?: BookingPolicyView | null;
  onNewBooking: () => void;
}

function buildIcs({
  businessName,
  service,
  slot,
  customerName,
}: {
  businessName: string;
  service: PublicService;
  slot: AvailabilitySlot;
  customerName: string;
}) {
  const stamp = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `agendapix-${stamp(slot.startsAt)}@agendapix`;
  const summary = `${service.name} · ${businessName}`;
  const description = `Agendamento de ${customerName} em ${businessName}. Sinal pago via Pix.`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//agendaPIX//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(slot.startsAt)}`,
    `DTEND:${stamp(slot.endsAt)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export function BookingConfirmation({
  businessName,
  service,
  slot,
  timezone,
  customerName,
  customerPhone,
  policy,
  onNewBooking,
}: BookingConfirmationProps) {
  const remainingCents = Math.max(0, service.priceCents - service.depositCents);
  const icsHref = useMemo(
    () => buildIcs({ businessName, service, slot, customerName }),
    [businessName, service, slot, customerName],
  );

  const whatsappMessage = encodeURIComponent(
    `Olá ${businessName}! Acabei de agendar ${service.name} para ${formatDateFull(
      slot.startsAt,
      timezone
    )} às ${formatTimeSlot(slot.startsAt, timezone)} no nome de ${customerName}.`
  );

  return (
    <div className="space-y-6">
      <div className="text-center" role="status" aria-live="polite">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success ring-8 ring-success-soft/50 animate-confirm-pop">
          <Icon icon={CONFIRMATION_ICONS.success} size="xl" className="size-8" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Horário confirmado!</h2>
        <p className="mt-2 text-sm text-muted">
          Sinal recebido. Seu horário em <span className="font-semibold text-ink">{businessName}</span> está garantido.
        </p>
      </div>

      <ReservedTimeBand startsAt={slot.startsAt} timezone={timezone} paid={service.depositCents > 0} />

      <article aria-label="Comprovante do agendamento" className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Serviço</p>
          <p className="mt-1 font-display text-xl font-bold text-ink">{service.name}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Icon icon={CONFIRMATION_ICONS.date} className="mt-0.5 size-4 text-muted" />
              <dt className="sr-only">Data</dt>
              <dd className="font-semibold text-ink first-letter:uppercase">{formatDateFull(slot.startsAt, timezone)}</dd>
            </div>
            <div className="flex items-start gap-2">
              <Icon icon={CONFIRMATION_ICONS.time} className="mt-0.5 size-4 text-muted" />
              <dt className="sr-only">Horário</dt>
              <dd className="font-semibold tabular-nums text-ink">{formatTimeSlot(slot.startsAt, timezone)} · {formatDuration(service.durationMinutes)}</dd>
            </div>
            <div className="flex items-start gap-2 sm:col-span-2">
              <Icon icon={CONFIRMATION_ICONS.customer} className="mt-0.5 size-4 text-muted" />
              <dt className="sr-only">Cliente</dt>
              <dd className="text-ink"><span className="font-semibold">{customerName}</span> <span className="text-muted">· {customerPhone}</span></dd>
            </div>
          </dl>
        </div>
        <div className="relative border-t border-dashed border-line-strong/50 bg-subtle/60 p-5">
          <span aria-hidden="true" className="absolute -left-3 -top-3 size-6 rounded-full border border-line bg-paper" />
          <span aria-hidden="true" className="absolute -right-3 -top-3 size-6 rounded-full border border-line bg-paper" />
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Valor do serviço</dt><dd className="tabular-nums text-ink">{formatCurrency(service.priceCents)}</dd></div>
            {service.depositCents > 0 && (
              <div className="flex justify-between font-semibold text-success"><dt className="inline-flex items-center gap-1.5"><Icon icon={CONFIRMATION_ICONS.success} className="size-3.5" />Sinal pago no Pix</dt><dd className="tabular-nums">{formatCurrency(service.depositCents)}</dd></div>
            )}
            <div className="flex justify-between border-t border-line pt-2 font-bold text-ink"><dt>Restante no local</dt><dd className="tabular-nums">{formatCurrency(remainingCents)}</dd></div>
          </dl>
        </div>
        {policy?.text || policy?.refundDeadlineAt || policy?.rescheduleDeadlineAt ? (
          <div className="border-t border-line p-5" data-testid="policy-snapshot">
            <p className="text-sm font-semibold text-ink">Política do sinal</p>
            {policy.text?.trim() ? <p className="mt-1 text-sm leading-relaxed text-ink">{policy.text.trim()}</p> : null}
            {policy.refundDeadlineAt ? (
              <p className="mt-2 text-sm text-muted">O estabelecimento pode devolver o sinal até {formatDateFull(policy.refundDeadlineAt, timezone)} às {formatTimeSlot(policy.refundDeadlineAt, timezone)}.</p>
            ) : null}
            {policy.rescheduleDeadlineAt ? (
              <p className="mt-1 text-sm text-muted">Remarcação até {formatDateFull(policy.rescheduleDeadlineAt, timezone)} às {formatTimeSlot(policy.rescheduleDeadlineAt, timezone)}.</p>
            ) : null}
          </div>
        ) : null}
      </article>

      <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
        <strong className="font-semibold text-ink">Vai se atrasar ou precisa remarcar?</strong> Avise o estabelecimento pelo WhatsApp o quanto antes.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg">
          <a href={`https://wa.me/?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
            <Icon icon={CONFIRMATION_ICONS.whatsapp} size="md" /> Enviar no WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href={icsHref} download={`${service.name.replace(/\s+/g, "-").toLowerCase()}.ics`}>
            <Icon icon={CONFIRMATION_ICONS.addToCalendar} size="md" /> Adicionar ao calendário
          </a>
        </Button>
        <Button onClick={onNewBooking} variant="ghost" size="lg" className="sm:col-span-2">
          <Icon icon={CONFIRMATION_ICONS.restart} size="md" /> Fazer outro agendamento
        </Button>
      </div>
    </div>
  );
}
