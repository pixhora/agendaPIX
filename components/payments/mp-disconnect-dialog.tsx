"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, Info, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openPixDisconnectNote } from "@/lib/mercadopago/contract";

const MP_APPS_HELP_URL = "https://www.mercadopago.com.br/ajuda/26873";

export function MpDisconnectDialog({
  open,
  pending,
  pendingPixCount = 0,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  pendingPixCount?: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const note = openPixDisconnectNote(pendingPixCount);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const focusCancel = () => cancelRef.current?.focus();
      focusCancel();
      const frame = window.requestAnimationFrame(focusCancel);
      return () => window.cancelAnimationFrame(frame);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="mp-disconnect-title"
      aria-describedby="mp-disconnect-body"
      className={cn(
        "fixed m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto border border-line bg-surface p-5 text-ink shadow-[var(--shadow-raised)] backdrop:bg-ink/40",
        "inset-x-0 bottom-0 top-auto rounded-t-frame rounded-b-none",
        "md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[min(100%-2rem,40rem)] md:w-[min(28rem,calc(100%-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-frame",
      )}
      onClose={onCancel}
    >
      <h2 id="mp-disconnect-title" className="font-display text-xl font-extrabold tracking-tight">Desconectar sua conta Mercado Pago?</h2>
      <p id="mp-disconnect-body" className="mt-3 text-sm leading-relaxed text-ink">
        O AgendaPix vai apagar o acesso à sua conta. Novos agendamentos com sinal ficam pausados até você conectar de novo. Agendamentos e sinais já pagos não mudam. Devoluções, a partir de agora, inclusive as de Pix pago fora do prazo, você faz direto no Mercado Pago. No Mercado Pago, em{" "}
        <a href={MP_APPS_HELP_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold underline underline-offset-4 outline-none focus-visible:shadow-[var(--shadow-focus)]">
          Segurança › Aplicativos conectados
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        , você também pode remover a permissão do AgendaPix.
      </p>
      {note ? (
        <p className="mt-3 flex items-start gap-2 rounded-card bg-subtle px-3 py-3 text-sm leading-relaxed text-ink">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
          <span>{note}</span>
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button ref={cancelRef} type="button" onClick={onCancel} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          aria-busy={pending || undefined}
          className={cn(buttonVariants({ size: "lg" }), "w-full bg-danger text-white hover:bg-danger dark:text-ink")}
        >
          {pending ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
          {pending ? "Desconectando…" : "Desconectar"}
        </button>
      </div>
    </dialog>
  );
}
