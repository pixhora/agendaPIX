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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Escolha o serviço</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o procedimento que você deseja agendar.
        </p>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label="Serviços disponíveis">
        {services.map((service) => {
          const isSelected = service.id === selectedServiceId;

          return (
            <button
              key={service.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectService(service)}
              className={`w-full text-left p-4 rounded-xl border transition-all min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                  : "border-border bg-surface hover:border-muted-foreground/40 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">{service.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>⏱ {formatDuration(service.durationMinutes)}</span>
                    <span>•</span>
                    <span className="font-medium text-foreground">
                      Total: {formatCurrency(service.priceCents)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {service.depositCents > 0 ? (
                    <span className="inline-block rounded-full bg-[#0F3B2E] px-2.5 py-1 text-xs font-bold text-[#C0F739]">
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
          className="w-full text-base font-semibold py-3 min-h-11"
        >
          {selectedService ? "Continuar para escolher horário" : "Selecione um serviço"}
        </Button>
      </div>
    </div>
  );
}
