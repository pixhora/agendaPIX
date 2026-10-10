"use client";

import { Button } from "@/components/ui/button";
import { StepHeader, stepBodyClass } from "./parts";

export function DraftResume({
  title,
  detail,
  onContinue,
  onReset,
}: {
  title: string;
  detail: string;
  onContinue: () => void;
  onReset: () => void;
}) {
  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <div className={stepBodyClass}>
        <StepHeader
          title="Continuar o cadastro deste aparelho?"
          description="Achamos um rascunho salvo neste navegador. Ele só entra na sua página se você continuar."
        />
        <div className="rounded-card border border-line bg-subtle/70 p-4">
          <p className="text-xs font-semibold text-muted">Rascunho neste aparelho</p>
          <p className="mt-1 font-display text-xl font-bold leading-tight">{title}</p>
          <p className="mt-1 text-sm text-muted">{detail}</p>
        </div>
      </div>
      <div className="z-10 grid gap-2 border-t border-line bg-paper/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md max-md:sticky max-md:bottom-0 max-md:mt-auto md:static md:bg-surface md:backdrop-blur-none">
        <Button type="submit" size="lg" className="w-full">Continuar rascunho</Button>
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={onReset}>Começar do zero</Button>
      </div>
    </form>
  );
}
