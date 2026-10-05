"use client";

import React from "react";
import type { PublicService, AvailabilitySlot } from "./types";
import { formatCurrency, formatDateFull, formatTimeSlot, formatDuration } from "./formatters";
import { CalendarDays, Check, Clock3, MessageCircle, RotateCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingConfirmationProps {
  businessName: string;
  service: PublicService;
  slot: AvailabilitySlot;
  timezone: string;
  customerName: string;
  customerPhone: string;
  onNewBooking: () => void;
}

export function BookingConfirmation({
  businessName,
  service,
  slot,
  timezone,
  customerName,
  customerPhone,
  onNewBooking,
}: BookingConfirmationProps) {
  const remainingCents = Math.max(0, service.priceCents - service.depositCents);

  // Link do WhatsApp com mensagem pré-formatada para facilitar a vida do cliente
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
          <Check aria-hidden="true" className="size-8" strokeWidth={3} />
        </div>
        <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Horário confirmado!</h2>
        <p className="mt-2 text-sm text-muted">
          Sinal recebido. Seu horário em <span className="font-semibold text-ink">{businessName}</span> está garantido.
        </p>
      </div>

      {/* Comprovante em formato de ticket */}
      <article aria-label="Comprovante do agendamento" className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Serviço</p>
          <p className="mt-1 font-display text-xl font-bold text-ink">{service.name}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <CalendarDays aria-hidden="true" className="mt-0.5 size-4 text-muted" />
              <dt className="sr-only">Data</dt>
              <dd className="font-semibold text-ink first-letter:uppercase">{formatDateFull(slot.startsAt, timezone)}</dd>
            </div>
            <div className="flex items-start gap-2">
              <Clock3 aria-hidden="true" className="mt-0.5 size-4 text-muted" />
              <dt className="sr-only">Horário</dt>
              <dd className="font-semibold tabular-nums text-ink">{formatTimeSlot(slot.startsAt, timezone)} · {formatDuration(service.durationMinutes)}</dd>
            </div>
            <div className="flex items-start gap-2 sm:col-span-2">
              <User aria-hidden="true" className="mt-0.5 size-4 text-muted" />
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
              <div className="flex justify-between font-semibold text-success"><dt className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="size-3.5" />Sinal pago no Pix</dt><dd className="tabular-nums">{formatCurrency(service.depositCents)}</dd></div>
            )}
            <div className="flex justify-between border-t border-line pt-2 font-bold text-ink"><dt>Restante no local</dt><dd className="tabular-nums">{formatCurrency(remainingCents)}</dd></div>
          </dl>
        </div>
      </article>

      <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
        <strong className="font-semibold text-ink">Vai se atrasar ou precisa remarcar?</strong> Avise o estabelecimento pelo WhatsApp o quanto antes.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg">
          <a href={`https://wa.me/?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" /> Enviar no WhatsApp
          </a>
        </Button>
        <Button onClick={onNewBooking} variant="outline" size="lg">
          <RotateCcw aria-hidden="true" /> Fazer outro agendamento
        </Button>
      </div>
    </div>
  );
}
