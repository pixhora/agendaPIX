"use client";

import { ArrowLeft, CircleCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingSaveStatus } from "@/lib/onboarding/save-status";
import { cn } from "@/lib/utils";

export function OnboardingTopBar({
  onBack,
  saving,
  savedOnServer,
  savedOnDevice = false,
}: {
  onBack?: () => void;
  saving: boolean;
  savedOnServer: boolean;
  savedOnDevice?: boolean;
}) {
  const label = onboardingSaveStatus(saving, savedOnServer, savedOnDevice);
  return (
    <div className="flex h-14 items-center justify-between pr-4 pl-1">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Voltar" className="inline-flex size-11 items-center justify-center rounded-full text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
      ) : (
        <span className="size-11" />
      )}
      <span className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted">
        {label ? (
          <>
            {saving ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> : <CircleCheck aria-hidden="true" className="size-3.5 text-success" />}
            {label}
          </>
        ) : null}
      </span>
    </div>
  );
}

export function OnboardingStepper({
  steps,
  current,
}: {
  steps: { id: string; label: string }[];
  current: number;
}) {
  const total = steps.length;
  const label = steps[current - 1]?.label ?? "";
  return (
    <nav aria-label={`Passo ${current} de ${total}: ${label}`} aria-current="step" className="px-5 pt-1">
      <p className="mb-2 text-xs text-muted">
        Passo {current} de {total} · <span className="font-semibold text-ink">{label}</span>
      </p>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden="true">
        {steps.map((step, index) => {
          const position = index + 1;
          const tone = position < current ? "bg-pix" : position === current ? "bg-ink" : "bg-line";
          return <span key={step.id} className={cn("h-1 rounded-full transition-step motion-reduce:transition-none", tone)} />;
        })}
      </div>
      <ol className="sr-only">
        {steps.map((step, index) => (
          <li key={step.id} aria-current={index + 1 === current ? "step" : undefined}>{step.label}</li>
        ))}
      </ol>
    </nav>
  );
}

/** Botão parado: o mesmo cinza claro do passo 1, sem o cinza médio com texto claro. */
export const quietCtaClass = "bg-subtle! text-muted! shadow-none opacity-100! hover:bg-subtle!";

export function StepActions({
  onBack,
  submitLabel,
  disabled,
  pending,
  onInvalid,
}: {
  onBack?: () => void;
  submitLabel: string;
  disabled?: boolean;
  pending?: boolean;
  onInvalid?: () => void;
}) {
  const quiet = Boolean(disabled) && !pending;
  return (
    <div className="z-10 border-t border-line bg-paper/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md max-md:sticky max-md:bottom-0 max-md:mt-auto md:static md:bg-surface md:backdrop-blur-none">
      <div className="flex items-center gap-3">
        {onBack ? (
          <Button type="button" variant="ghost" className="hidden min-h-12 md:inline-flex" onClick={onBack}>
            Voltar
          </Button>
        ) : null}
        <Button
          type="submit"
          size="lg"
          aria-disabled={quiet || undefined}
          aria-busy={pending || undefined}
          onClick={(event) => {
            if (pending) {
              event.preventDefault();
              return;
            }
            if (disabled) {
              event.preventDefault();
              onInvalid?.();
            }
          }}
          className={cn("w-full", quiet && quietCtaClass)}
        >
          {pending ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
