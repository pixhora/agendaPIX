"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { REISSUE_ACTION, REISSUE_BODY, REISSUE_TITLE } from "@/lib/slot-link/copy";

/** Folha no celular e diálogo no desktop, antes de invalidar o link já enviado. */
export function ReissueDialog({
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-reissue-cancel]")?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="reissue-title"
      aria-describedby="reissue-body"
      data-testid="reissue-dialog"
      className="fixed m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto border border-line bg-surface p-5 text-ink shadow-[var(--shadow-raised)] backdrop:bg-ink/40 inset-x-0 bottom-0 top-auto rounded-t-frame rounded-b-none md:inset-auto md:left-1/2 md:top-1/2 md:w-[min(28rem,calc(100%-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-frame"
      onCancel={(event) => { if (pending) event.preventDefault(); }}
      onClose={onCancel}
      onClick={(event) => { if (!pending && event.target === event.currentTarget) onCancel(); }}
    >
      <h2 id="reissue-title" className="font-display text-xl font-extrabold tracking-tight">{REISSUE_TITLE}</h2>
      <p id="reissue-body" className="mt-3 text-sm leading-relaxed text-ink">{REISSUE_BODY}</p>
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="default" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined} onClick={onConfirm}>
          {pending ? "Gerando…" : REISSUE_ACTION}
        </Button>
        <Button type="button" variant="outline" size="lg" className="w-full" data-reissue-cancel disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </dialog>
  );
}
