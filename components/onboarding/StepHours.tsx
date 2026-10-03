import React from "react";
import { Button } from "@/components/ui/button";

interface StepHoursProps {
  openDays: number[];
  opensAt: string;
  closesAt: string;
  onChangeOpenDays: (days: number[]) => void;
  onChangeOpensAt: (time: string) => void;
  onChangeClosesAt: (time: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const WEEKDAYS = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];

export function StepHours({
  openDays,
  opensAt,
  closesAt,
  onChangeOpenDays,
  onChangeOpensAt,
  onChangeClosesAt,
  onBack,
  onNext,
}: StepHoursProps) {
  const toggleDay = (dayId: number) => {
    if (openDays.includes(dayId)) {
      if (openDays.length > 1) {
        onChangeOpenDays(openDays.filter((d) => d !== dayId));
      }
    } else {
      onChangeOpenDays([...openDays, dayId]);
    }
  };

  const isTimeOrderValid = opensAt < closesAt;
  const isDaysValid = openDays.length > 0;
  const isValid = isDaysValid && isTimeOrderValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">
          Quais são seus dias e horários de atendimento?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O sistema só liberará horários de agendamento dentro do seu expediente.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Dias de funcionamento
          </label>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Dias de atendimento">
            {WEEKDAYS.map((w) => {
              const isSelected = openDays.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleDay(w.id)}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-lg border text-xs font-semibold min-h-11 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-surface text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Toque nos dias para ativar ou desativar.
          </p>
          {!isDaysValid && (
            <div
              id="days-error"
              role="alert"
              className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive font-medium"
            >
              Selecione pelo menos um dia de atendimento na semana.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label htmlFor="hours-opens" className="block text-xs font-semibold text-foreground mb-1.5">
              Horário de abertura
            </label>
            <input
              id="hours-opens"
              type="time"
              required
              aria-invalid={!isTimeOrderValid ? "true" : undefined}
              aria-describedby={!isTimeOrderValid ? "hours-error" : undefined}
              value={opensAt}
              onChange={(e) => onChangeOpensAt(e.target.value)}
              className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm font-medium text-foreground min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                !isTimeOrderValid
                  ? "border-destructive focus-visible:outline-destructive"
                  : "border-border focus-visible:outline-primary"
              }`}
            />
          </div>

          <div>
            <label htmlFor="hours-closes" className="block text-xs font-semibold text-foreground mb-1.5">
              Horário de fechamento
            </label>
            <input
              id="hours-closes"
              type="time"
              required
              aria-invalid={!isTimeOrderValid ? "true" : undefined}
              aria-describedby={!isTimeOrderValid ? "hours-error" : undefined}
              value={closesAt}
              onChange={(e) => onChangeClosesAt(e.target.value)}
              className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm font-medium text-foreground min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                !isTimeOrderValid
                  ? "border-destructive focus-visible:outline-destructive"
                  : "border-border focus-visible:outline-primary"
              }`}
            />
          </div>
        </div>

        {!isTimeOrderValid && (
          <div
            id="hours-error"
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive font-medium"
          >
            O horário de fechamento deve ser posterior ao horário de abertura.
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1 min-h-11 font-medium">
          Voltar
        </Button>
        <Button type="submit" disabled={!isValid} className="flex-[2] min-h-11 font-semibold">
          Continuar
        </Button>
      </div>
    </form>
  );
}
