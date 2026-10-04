"use client";

import React from "react";
import type { PublicService } from "./types";
import { formatCurrency, formatDuration } from "./formatters";
import { Button } from "@/components/ui/button";

interface StepServiceProps {
  services: PublicService[];
  selectedServiceId: string | null;
  onSelectService: (service: PublicService) => void;
  onNext: () => void;
}

export function StepService({
  services,
  selectedServiceId,
  onSelectService,
  onNext,
}: StepServiceProps) {
  if (services.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center" role="status">
        <h2 className="text-lg font-semibold text-foreground">Nenhum serviço disponível</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Este estabelecimento não possui serviços ativos no momento. Volte mais tarde.
        </p>
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === selectedServiceId);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (index + 1) % services.length;
      const nextService = services[nextIndex];
      onSelectService(nextService);
      const buttons = document.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]');
      buttons[nextIndex]?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + services.length) % services.length;
      const prevService = services[prevIndex];
      onSelectService(prevService);
      const buttons = document.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]');
      buttons[prevIndex]?.focus();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Escolha o serviço</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o procedimento que você deseja agendar.
        </p>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label="Serviços disponíveis">
        {services.map((service, index) => {
          const isSelected = service.id === selectedServiceId;

          return (
            <button
              key={service.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectService(service)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`w-full text-left p-4 rounded-2xl border transition-all min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                isSelected
                  ? "border-2 border-primary bg-primary/5 shadow-xs"
                  : "border-border bg-surface hover:border-muted-foreground/40 hover:bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/50 bg-surface"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">{service.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>⏱ {formatDuration(service.durationMinutes)}</span>
                      <span>•</span>
                      <span className="font-semibold text-foreground">
                        Total: {formatCurrency(service.priceCents)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {service.depositCents > 0 ? (
                    <span className="inline-block rounded-full bg-accent-forest text-accent-lime px-2.5 py-1 text-xs font-bold shadow-xs">
                      Sinal: {formatCurrency(service.depositCents)}
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      Sem sinal
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        <Button
          type="button"
          disabled={!selectedService}
          onClick={onNext}
          className="w-full text-base font-bold py-3.5 min-h-12 rounded-full"
        >
          {selectedService ? "Continuar para escolher horário" : "Selecione um serviço"}
        </Button>
      </div>
    </div>
  );
}
