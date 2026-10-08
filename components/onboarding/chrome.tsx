"use client";

import { ArrowLeft, CircleCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OnboardingTopBar({
  onBack,
  saving,
  savedOnServer,
}: {
  onBack?: () => void;
  saving: boolean;
  savedOnServer: boolean;
}) {
  const label = saving ? "Salvando…" : savedOnServer ? "Cadastro guardado" : "Salvo neste aparelho";
  return (
    <div className="flex h-14 items-center justify-between pr-4 pl-1">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Voltar" className="inline-flex size-11 items-center justify-center rounded-full text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
      ) : (
        <span className="size-11" />
      )}
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        {saving ? null : <CircleCheck aria-hidden="true" className="size-3.5 text-success" />}
        {label}
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
          return <span key={step.id} className={cn("h-1 rounded-full transition-step", tone)} />;
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
  const blocked = Boolean(disabled || pending);
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-paper/95 px-5 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        {onBack ? (
          <Button type="button" variant="ghost" className="hidden min-h-12 md:inline-flex" onClick={onBack}>
            Voltar
          </Button>
        ) : null}
        <Button
          type="submit"
          size="lg"
          aria-disabled={blocked || undefined}
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
          className={cn("w-full", blocked && "bg-subtle text-muted shadow-none hover:bg-subtle")}
        >
          {pending ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
