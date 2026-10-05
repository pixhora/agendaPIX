"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribeNoop = () => () => {};

/** Domínio exibido antes do slug: o host real no navegador; no servidor, um texto neutro. */
export function usePublicHost() {
  return useSyncExternalStore(subscribeNoop, () => window.location.host, () => "seu-site");
}

export function StepHeader({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-muted">{description}</p>
    </div>
  );
}

export function StepActions({ onBack, submitLabel, disabled, backDisabled }: { onBack?: () => void; submitLabel: string; disabled?: boolean; backDisabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {onBack && (
        <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={backDisabled} className="px-4" aria-label="Voltar para a etapa anterior">
          <ArrowLeft aria-hidden="true" /><span className="hidden sm:inline">Voltar</span>
        </Button>
      )}
      <Button type="submit" size="lg" disabled={disabled} className="flex-1">
        {submitLabel}
      </Button>
    </div>
  );
}
