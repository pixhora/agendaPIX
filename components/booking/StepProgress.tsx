import React from "react";

interface StepProgressProps {
  currentStep: 1 | 2 | 3 | 4;
}

const STEPS = [
  { step: 1, label: "Serviço" },
  { step: 2, label: "Horário" },
  { step: 3, label: "Dados" },
  { step: 4, label: "Pix" },
] as const;

export function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <nav aria-label="Etapas do agendamento" className="w-full mb-6">
      <ol className="flex items-center justify-between gap-1 w-full" role="list">
        {STEPS.map((s, idx) => {
          const isDone = currentStep > s.step;
          const isCurrent = currentStep === s.step;

          return (
            <li
              key={s.step}
              className="flex-1 flex flex-col items-center"
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="w-full flex items-center">
                {idx > 0 && (
                  <div
                    className={`h-1 flex-1 transition-step ${
                      isDone ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-step ${
                    isCurrent
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : isDone
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground border border-border"
                  }`}
                >
                  {isDone ? "✓" : s.step}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-1 flex-1 transition-step ${
                      isDone && currentStep > s.step + 1 ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
              <span
                className={`mt-1.5 text-xs transition-step ${
                  isCurrent
                    ? "text-accent-forest dark:text-primary font-bold"
                    : "text-muted-foreground font-medium"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
