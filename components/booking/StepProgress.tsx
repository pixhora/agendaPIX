import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: 1 | 2 | 3 | 4;
  /** Rótulos das 4 etapas (padrão: fluxo de agendamento). */
  steps?: readonly { step: number; label: string }[];
  label?: string;
}

const BOOKING_STEPS = [
  { step: 1, label: "Serviço" },
  { step: 2, label: "Data e hora" },
  { step: 3, label: "Seus dados" },
  { step: 4, label: "Pix" },
] as const;

/** Stepper serviço → data/hora → dados → Pix. */
export function StepProgress({ currentStep, steps = BOOKING_STEPS, label = "Etapas do agendamento" }: StepProgressProps) {
  const STEPS = steps;
  const current = STEPS[currentStep - 1];
  return (
    <nav aria-label={label} className="w-full">
      <p className="mb-2 flex items-baseline justify-between text-sm sm:hidden">
        <span className="font-semibold text-ink">{current.label}</span>
        <span className="text-muted">Passo {currentStep} de {STEPS.length}</span>
      </p>
      <ol className="grid grid-cols-4 gap-1.5 sm:gap-3" role="list">
        {STEPS.map((s) => {
          const isDone = currentStep > s.step;
          const isCurrent = currentStep === s.step;
          return (
            <li key={s.step} aria-current={isCurrent ? "step" : undefined} className="min-w-0">
              <span className={cn("block h-1.5 rounded-full transition-step", isDone ? "bg-pix" : isCurrent ? "bg-ink" : "bg-line")} aria-hidden="true" />
              <span className={cn("mt-2 hidden items-center gap-1.5 text-sm sm:flex", isCurrent ? "font-semibold text-ink" : isDone ? "text-ink" : "text-muted")}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    isDone ? "bg-pix text-pix-foreground" : isCurrent ? "bg-ink text-paper" : "border border-line-strong/60 text-muted",
                  )}
                >
                  {isDone ? <Check className="size-3" strokeWidth={3} /> : s.step}
                </span>
                <span className="truncate">{s.label}</span>
              </span>
              <span className="sr-only">
                {s.label}: {isDone ? "concluído" : isCurrent ? "etapa atual" : "pendente"}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
