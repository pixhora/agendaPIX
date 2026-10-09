import React from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FieldError, FieldHint } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { StepActions, StepHeader, stepBodyClass } from "./parts";

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
  { id: 1, label: "Seg", name: "Segunda-feira" },
  { id: 2, label: "Ter", name: "Terça-feira" },
  { id: 3, label: "Qua", name: "Quarta-feira" },
  { id: 4, label: "Qui", name: "Quinta-feira" },
  { id: 5, label: "Sex", name: "Sexta-feira" },
  { id: 6, label: "Sáb", name: "Sábado" },
  { id: 0, label: "Dom", name: "Domingo" },
];

export function StepHours({ openDays, opensAt, closesAt, onChangeOpenDays, onChangeOpensAt, onChangeClosesAt, onBack, onNext }: StepHoursProps) {
  const toggleDay = (dayId: number) => {
    if (openDays.includes(dayId)) {
      if (openDays.length > 1) onChangeOpenDays(openDays.filter((d) => d !== dayId));
    } else {
      onChangeOpenDays([...openDays, dayId]);
    }
  };

  const isTimeOrderValid = opensAt < closesAt;
  const isDaysValid = openDays.length > 0;
  const isValid = isDaysValid && isTimeOrderValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <div className={cn(stepBodyClass, "space-y-6")}>
      <StepHeader title="Quando você atende?" description="Seus clientes só veem horários livres dentro do seu expediente." />

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">Dias de atendimento</legend>
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Dias de atendimento">
          {WEEKDAYS.map((w) => {
            const isSelected = openDays.includes(w.id);
            return (
              <button
                key={w.id}
                type="button"
                aria-pressed={isSelected}
                aria-label={w.name}
                onClick={() => toggleDay(w.id)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-field border text-xs font-bold transition-feedback focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isSelected ? "border-ink bg-ink text-paper" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                <span aria-hidden="true">{w.label}</span>
                <Check aria-hidden="true" className={cn("size-3.5", isSelected ? "opacity-100" : "opacity-0")} strokeWidth={3} />
              </button>
            );
          })}
        </div>
        <FieldHint>Toque para ligar ou desligar. Ajustes por dia ficam no painel.</FieldHint>
        <FieldError id="days-error">{!isDaysValid ? "Selecione pelo menos um dia de atendimento." : null}</FieldError>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="hours-opens" className="text-sm font-semibold">Abre às</label>
          <Input id="hours-opens" type="time" step={900} required className="onb-control tabular-nums" aria-invalid={!isTimeOrderValid ? "true" : undefined} aria-describedby={!isTimeOrderValid ? "hours-error" : undefined} value={opensAt} onChange={(e) => onChangeOpensAt(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="hours-closes" className="text-sm font-semibold">Fecha às</label>
          <Input id="hours-closes" type="time" step={900} required className="onb-control tabular-nums" aria-invalid={!isTimeOrderValid ? "true" : undefined} aria-describedby={!isTimeOrderValid ? "hours-error" : undefined} value={closesAt} onChange={(e) => onChangeClosesAt(e.target.value)} />
        </div>
      </div>
      <p className="text-sm text-muted">Fuso: Brasília (São Paulo).</p>
      <FieldError id="hours-error">{!isTimeOrderValid ? "O fim precisa ser depois do início." : null}</FieldError>
      </div>

      <StepActions
        onBack={onBack}
        submitLabel="Continuar"
        disabled={!isValid}
        onInvalid={() => {
          if (!isDaysValid) document.querySelector<HTMLElement>("[aria-label='Segunda-feira']")?.focus();
          else document.getElementById("hours-opens")?.focus();
        }}
      />
    </form>
  );
}
