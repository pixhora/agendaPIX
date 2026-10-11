"use client";

import type { AvailabilitySlot, BookingPolicyView, PublicService } from "./types";
import { formatCurrency, formatDateFull, formatTimeSlot, formatDuration } from "./formatters";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CONFIRMATION_ICONS } from "@/lib/icons/registry";
import { CalendarPlus, TriangleAlert } from "lucide-react";
import { ReservedTimeBand } from "./ReservedTimeBand";
import { confirmationCardTone, confirmationPolicyText, isFutureInstant, policyReceiptRefund } from "./policy-copy";
import { REMAINDER_LABEL } from "@/lib/copy/booking-summary";
import { buildAppointmentIcs } from "@/lib/calendar/appointment-ics";

interface BookingConfirmationProps {
  businessName: string;
  service: PublicService;
  slot: AvailabilitySlot;
  timezone: string;
  customerName: string;
  customerPhone: string;
  /** Snapshot gravado na reserva. `policy.text` entra como o servidor mandou. */
  policy?: BookingPolicyView | null;
  /** Mesmo valor de `policy.text`. O #29 passa os dois no comprovante. */
  policyText?: string | null;
  /** `policy.refundWindowClosedAtBooking`. Liga o tom de aviso. */
  refundWindowClosedAtBooking?: boolean;
  contactWhatsapp?: string | null;
  /** Endereço da loja. Se existir, entra no arquivo como LOCATION. */
  address?: string | null;
  onNewBooking: () => void;
}

function downloadAppointmentFile(content: string) {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`);
  anchor.setAttribute("download", "agenda.ics");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function BookingConfirmation({
  businessName,
  service,
  slot,
  timezone,
  customerName,
  customerPhone,
  policy,
  policyText: policyTextProp,
  refundWindowClosedAtBooking,
  contactWhatsapp,
  address,
  onNewBooking,
}: BookingConfirmationProps) {
  const remainingCents = Math.max(0, service.priceCents - service.depositCents);
  const windowClosed = Boolean(refundWindowClosedAtBooking ?? policy?.refundWindowClosedAtBooking);
  const refundDeadlineAt = policy?.refundDeadlineAt;
  const datedRefund = !windowClosed && refundDeadlineAt && isFutureInstant(refundDeadlineAt)
    ? policyReceiptRefund(
        businessName,
        formatDateFull(refundDeadlineAt, timezone).replace(/^./, (letter) => letter.toLowerCase()),
        formatTimeSlot(refundDeadlineAt, timezone),
      )
    : null;
  const policyText = confirmationPolicyText(policyTextProp ?? policy?.text, datedRefund);
  const policyTone = confirmationCardTone(windowClosed);
  const rescheduleOpen = !windowClosed && isFutureInstant(policy?.rescheduleDeadlineAt);

  function handleAddToCalendar() {
    downloadAppointmentFile(buildAppointmentIcs({
      serviceId: service.id,
      serviceName: service.name,
      businessName,
      startsAt: slot.startsAt,
      durationMinutes: service.durationMinutes,
      address,
    }));
  }

  const whatsappNumber = contactWhatsapp?.replace(/^\+/, "") ?? "";
  const guestName = customerName.trim();
  const guestPhone = customerPhone.trim();
  const whatsappMessage = encodeURIComponent(
    `Olá ${businessName}! Acabei de agendar ${service.name} para ${formatDateFull(
      slot.startsAt,
      timezone
    )} às ${formatTimeSlot(slot.startsAt, timezone)}${guestName ? ` no nome de ${guestName}` : ""}.`
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
              <dd className="text-ink">
                {guestName || guestPhone ? (
                  <>
                    {guestName ? <span className="font-semibold">{guestName}</span> : null}
                    {guestPhone ? <span className="text-muted">{guestName ? " · " : ""}{guestPhone}</span> : null}
                  </>
                ) : (
                  <span className="font-semibold">Horário confirmado</span>
                )}
              </dd>
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
            <div className="flex justify-between border-t border-line pt-2 font-bold text-ink"><dt>{REMAINDER_LABEL}</dt><dd className="tabular-nums">{formatCurrency(remainingCents)}</dd></div>
          </dl>
        </div>
        {policyText || (rescheduleOpen && policy?.rescheduleDeadlineAt) ? (
          <div className="border-t border-line p-5" data-testid="policy-snapshot" data-tone={policyTone}>
            <p className="text-sm font-semibold text-ink">Política do sinal</p>
            {policyText ? (
              <p className={policyTone === "warn" ? "mt-2 flex items-start gap-2 text-sm font-medium text-warning" : "mt-2 text-sm text-muted"}>
                {policyTone === "warn" ? <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
                <span>{policyText}</span>
              </p>
            ) : null}
            {rescheduleOpen && policy?.rescheduleDeadlineAt ? (
              <p className="mt-1 text-sm text-muted">Remarcação até {formatDateFull(policy.rescheduleDeadlineAt, timezone).replace(/^./, (letter) => letter.toLowerCase())}, às {formatTimeSlot(policy.rescheduleDeadlineAt, timezone)}.</p>
            ) : null}
          </div>
        ) : null}
      </article>

      <Button type="button" variant="outline" size="lg" className="h-12 w-full sm:w-auto" onClick={handleAddToCalendar}>
        <CalendarPlus aria-hidden="true" />
        Adicionar à agenda
      </Button>

      {whatsappNumber ? (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
          <strong className="font-semibold text-ink">Vai se atrasar ou precisa remarcar?</strong> Avise o estabelecimento pelo WhatsApp o quanto antes.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {whatsappNumber ? (
          <Button asChild size="lg" className="sm:col-span-2">
            <a href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
              <Icon icon={CONFIRMATION_ICONS.whatsapp} size="md" /> Enviar no WhatsApp
            </a>
          </Button>
        ) : null}
        <Button onClick={onNewBooking} variant="ghost" size="lg" className="sm:col-span-2">
          <Icon icon={CONFIRMATION_ICONS.restart} size="md" /> Fazer outro agendamento
        </Button>
      </div>
    </div>
  );
}
