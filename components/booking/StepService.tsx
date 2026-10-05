"use client";

import React from "react";
import { ArrowRight, Check } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { SUMMARY_ICONS } from "@/lib/icons/registry";
import type { PublicService } from "./types";
import { formatCurrency, formatDuration } from "./formatters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StepServiceProps {
  services: PublicService[];
  selectedServiceId: string | null;
  onSelectService: (service: PublicService) => void;
  onNext: () => void;
}

export function StepService({ services, selectedServiceId, onSelectService, onNext }: StepServiceProps) {
  const groupRef = React.useRef<HTMLDivElement>(null);

  if (services.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong/60 p-8 text-center" role="status">
        <h2 className="font-display text-lg font-bold text-ink">Nenhum serviço disponível</h2>
        <p className="mt-2 text-sm text-muted">Este estabelecimento não tem serviços ativos no momento. Volte mais tarde.</p>
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const focusIndex = selectedService ? services.indexOf(selectedService) : 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = e.key === "ArrowDown" || e.key === "ArrowRight";
    const backward = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (!forward && !backward) return;
    e.preventDefault();
    const nextIndex = (index + (forward ? 1 : -1) + services.length) % services.length;
    onSelectService(services[nextIndex]);
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Escolha o serviço</h2>
        <p className="mt-1 text-sm text-muted">O sinal é pago por Pix e garante o seu horário. O restante você paga no local.</p>
      </div>

      <div ref={groupRef} className="grid gap-3" role="radiogroup" aria-label="Serviços disponíveis">
        {services.map((service, index) => {
          const isSelected = service.id === selectedServiceId;
          return (
            <button
              key={service.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => onSelectService(service)}
              onKeyDown={(e) => handleKeyDown(e, index)}
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
                {isSelected && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{service.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1"><Icon icon={SUMMARY_ICONS.duration} className="size-3.5" />{formatDuration(service.durationMinutes)}</span>
                  {service.depositCents > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-pix-soft px-2 py-0.5 text-xs font-semibold text-pix">Sinal {formatCurrency(service.depositCents)} no Pix</span>
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
            </button>
          );
        })}
      </div>

      <div className="border-t border-line pt-5 sm:flex sm:justify-end">
        <Button type="button" size="lg" onClick={onNext} disabled={!selectedService} className="w-full sm:w-auto">
          {selectedService ? "Escolher horário" : "Selecione um serviço"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
