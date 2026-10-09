"use client";

import React from "react";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { SUMMARY_ICONS } from "@/lib/icons/registry";
import type { PublicService } from "./types";
import { formatCurrency, formatDuration } from "./formatters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { depositUnavailable, showDepositUnavailableCard, whatsAppHref } from "./deposit-availability";
import { DepositUnavailableCard, DepositUnavailableLine } from "./DepositUnavailable";

interface StepServiceProps {
  services: PublicService[];
  selectedServiceId: string | null;
  onSelectService: (service: PublicService) => void;
  onNext: () => void;
  businessName?: string;
  contactPhone?: string | null;
}

function ServiceBody({ service }: { service: PublicService }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{service.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <Icon icon={SUMMARY_ICONS.duration} className="size-3.5" />
            {formatDuration(service.durationMinutes)}
          </span>
          {service.depositCents > 0 ? (
            <span className="inline-flex items-center rounded-full bg-pix-soft px-2 py-0.5 text-xs font-semibold text-pix">
              Sinal {formatCurrency(service.depositCents)} no Pix
            </span>
          ) : (
            <span className="text-xs font-semibold">Sem sinal</span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="inline-flex items-center justify-end gap-1 font-display text-lg font-bold tabular-nums text-ink">
          <Icon icon={SUMMARY_ICONS.price} className="size-3.5 text-muted" />
          {formatCurrency(service.priceCents)}
        </span>
      </span>
    </>
  );
}

export function StepService({
  services,
  selectedServiceId,
  onSelectService,
  onNext,
  businessName,
  contactPhone,
}: StepServiceProps) {
  const groupRef = React.useRef<HTMLDivElement>(null);
  const bookable = services.filter((service) => !depositUnavailable(service));
  const unavailableServices = services.filter((service) => depositUnavailable(service));
  const mixed = unavailableServices.length > 0 && bookable.length > 0;
  const showCard = showDepositUnavailableCard(services);
  const whatsApp = whatsAppHref(contactPhone);
  const placeName = businessName?.trim() || "o estabelecimento";

  if (services.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong/60 p-8 text-center" role="status">
        <h2 className="font-display text-lg font-bold text-ink">Nenhum serviço disponível</h2>
        <p className="mt-2 text-sm text-muted">Este estabelecimento não tem serviços ativos no momento. Volte mais tarde.</p>
      </div>
    );
  }

  const selectedService = bookable.find((service) => service.id === selectedServiceId);
  const focusIndex = selectedService ? bookable.indexOf(selectedService) : 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !backward) return;
    event.preventDefault();
    const nextIndex = (index + (forward ? 1 : -1) + bookable.length) % bookable.length;
    onSelectService(bookable[nextIndex]);
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  };

  return (
    <div className="space-y-6">
      {showCard ? (
        <DepositUnavailableCard businessName={placeName} phone={contactPhone} />
      ) : (
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Escolha o serviço</h2>
          <p className="mt-1 text-sm text-muted">O sinal é pago por Pix e garante o seu horário. O restante você paga no local.</p>
        </div>
      )}

      {unavailableServices.length > 0 && !showCard ? (
        <div className="grid gap-3">
          {unavailableServices.map((service) => (
            <div key={service.id} aria-disabled="true" className="rounded-card border border-line bg-subtle p-4">
              <div className="flex items-center gap-4">
                <ServiceBody service={service} />
              </div>
              <DepositUnavailableLine />
            </div>
          ))}
        </div>
      ) : null}

      {bookable.length > 0 ? (
        <div ref={groupRef} className="grid gap-3" role="radiogroup" aria-label="Serviços disponíveis">
          {bookable.map((service, index) => {
            const isSelected = service.id === selectedServiceId;
            return (
              <button
                key={service.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={index === focusIndex ? 0 : -1}
                onClick={() => onSelectService(service)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  "group flex min-h-[76px] w-full items-center gap-4 rounded-card border bg-surface p-4 text-left transition-feedback active:scale-[0.995]",
                  isSelected ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-feedback",
                    isSelected ? "border-ink bg-ink text-paper" : "border-line-strong/70",
                  )}
                >
                  {isSelected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <ServiceBody service={service} />
              </button>
            );
          })}
        </div>
      ) : null}

      {mixed ? (
        <p className="text-sm leading-relaxed text-ink">
          Para os serviços indisponíveis, fale direto com {placeName}.
          {whatsApp ? (
            <>
              {" "}
              <a
                href={whatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 font-semibold underline-offset-4 outline-none hover:underline focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                Chamar no WhatsApp
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {bookable.length > 0 ? (
        <div className="border-t border-line pt-5 sm:flex sm:justify-end">
          <Button type="button" size="lg" onClick={onNext} disabled={!selectedService} className="w-full sm:w-auto">
            {selectedService ? "Escolher horário" : "Selecione um serviço"}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
