"use client";

import React from "react";
import type { PublicService, AvailabilitySlot } from "./types";
import { formatCurrency, formatDateFull, formatTimeSlot, formatDuration } from "./formatters";
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
    <div className="space-y-6 text-center">
      {/* Ícone de Sucesso */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-3xl font-bold ring-8 ring-emerald-500/5">
        ✓
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">Horário confirmado!</h2>
        <p className="text-sm text-muted-foreground">
          Seu agendamento na <span className="font-semibold text-foreground">{businessName}</span> foi garantido.
        </p>
      </div>

      {/* Cartão de Resumo da Reserva */}
      <div className="rounded-2xl border border-border bg-surface p-5 text-left space-y-4 shadow-sm">
        <div className="border-b border-border pb-3">
          <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">
            Serviço reservado
          </p>
          <p className="text-lg font-bold text-foreground mt-0.5">{service.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">⏱ Duração: {formatDuration(service.durationMinutes)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs border-b border-border pb-3">
          <div>
            <p className="text-muted-foreground">Data</p>
            <p className="font-semibold text-foreground capitalize mt-0.5">
              {formatDateFull(slot.startsAt, timezone)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Horário</p>
            <p className="font-semibold text-foreground text-sm mt-0.5">
              {formatTimeSlot(slot.startsAt, timezone)}
            </p>
          </div>
        </div>

        <div className="text-xs border-b border-border pb-3 space-y-1">
          <p className="text-muted-foreground">Cliente</p>
          <p className="font-semibold text-foreground">{customerName}</p>
          <p className="text-muted-foreground">{customerPhone}</p>
        </div>

        <div className="text-xs space-y-1.5 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Valor total:</span>
            <span className="font-medium text-foreground">{formatCurrency(service.priceCents)}</span>
          </div>
          {service.depositCents > 0 && (
            <div className="flex justify-between items-center text-emerald-600 font-semibold">
              <span>Sinal pago no Pix:</span>
              <span>{formatCurrency(service.depositCents)}</span>
            </div>
          )}
          {remainingCents > 0 && (
            <div className="flex justify-between items-center font-bold text-foreground text-sm pt-1">
              <span>Restante no local:</span>
              <span>{formatCurrency(remainingCents)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-3 pt-3 border-t border-border/60">
        <Button
          asChild
          className="w-full min-h-12 rounded-full font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-xs transition-all active:scale-[0.99]"
        >
          <a
            href={`https://wa.me/?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            💬 Enviar Confirmação no WhatsApp
          </a>
        </Button>

        <Button
          onClick={onNewBooking}
          variant="outline"
          className="w-full min-h-12 rounded-full font-semibold"
        >
          Fazer outro agendamento
        </Button>
      </div>
    </div>
  );
}
