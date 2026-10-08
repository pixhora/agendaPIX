"use client";

import { useEffect, useRef } from "react";
import { Info, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openPixDisconnectNote } from "@/lib/mercadopago/contract";

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
  const note = openPixDisconnectNote(pendingPixCount);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="mp-disconnect-title"
      aria-describedby="mp-disconnect-body"
      className="w-[min(100%-1.5rem,28rem)] rounded-frame border border-line bg-surface p-5 text-ink shadow-[var(--shadow-raised)] backdrop:bg-ink/40 open:flex open:flex-col open:gap-4"
      onClose={onCancel}
    >
      <h2 id="mp-disconnect-title" className="font-display text-xl font-extrabold tracking-tight">Desconectar sua conta Mercado Pago?</h2>
      <p id="mp-disconnect-body" className="text-sm leading-relaxed text-ink">
        O AgendaPix vai apagar o acesso à sua conta. Novos agendamentos com sinal ficam pausados até você conectar de novo. Agendamentos e sinais já pagos não mudam. Devoluções, a partir de agora, inclusive as de Pix pago fora do prazo, você faz direto no Mercado Pago. Para remover também do lado do Mercado Pago, desvincule o AgendaPix nas aplicações conectadas da sua conta.
      </p>
      {note ? (
        <p className="flex items-start gap-2 rounded-card bg-subtle px-3 py-3 text-sm leading-relaxed text-ink">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
          <span>{note}</span>
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onCancel} className={cn(buttonVariants({ size: "lg" }), "w-full")} autoFocus>
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
