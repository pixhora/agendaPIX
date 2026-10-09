"use client";

import { useId, useRef } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPLETE_PLAN } from "@/lib/dashboard/trial-notice";

export function TrialChangesDialog({
  planName,
  priceLabel,
  checkoutAvailable,
  variant,
  className,
}: {
  planName: string;
  priceLabel: string;
  checkoutAvailable: boolean;
  variant: "outline" | "text";
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = () => dialogRef.current?.showModal();

  return (
    <>
      {variant === "outline" ? (
        <Button type="button" variant="outline" onClick={open} className={className}>O que muda?</Button>
      ) : (
        <button type="button" onClick={open} className="inline-flex min-h-11 items-center text-sm font-semibold text-pix-bright underline decoration-1 underline-offset-2">O que muda?</button>
      )}
      <dialog ref={dialogRef} aria-labelledby={titleId} className="m-auto w-[min(calc(100%-2rem),28rem)] max-h-[85vh] overflow-auto rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-ink/50">
        <div className="p-5 sm:p-6">
          <h2 id={titleId} className="font-display text-xl font-bold">O que muda</h2>
          <p className="mt-1 text-sm text-muted">Plano à venda agora. O outro fica para depois.</p>
          <div className="mt-4 rounded-card bg-slab p-4 text-slab-foreground">
            <p className="text-sm text-slab-muted">{planName}</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{priceLabel}<span className="text-base font-semibold text-slab-muted">/mês</span></p>
          </div>
          <ul className="mt-4 grid gap-2 text-sm">
            <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />Página com link para os clientes</li>
            <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />Agenda do dia e da semana</li>
            <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />Sinal por Pix na conta Mercado Pago do negócio</li>
            <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />Política do sinal por serviço</li>
          </ul>
          <div className="mt-4 rounded-card border border-dashed border-line-strong/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-lg font-bold text-muted">{COMPLETE_PLAN.name}</p>
              <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold text-muted">{COMPLETE_PLAN.label}</span>
            </div>
            <p className="mt-1 text-sm text-muted">Este plano ainda não está à venda.</p>
          </div>
          {!checkoutAvailable && <p className="mt-4 text-sm text-ink">Ainda não dá para contratar a assinatura por aqui. O plano {planName} é {priceLabel}/mês quando a contratação entrar no painel.</p>}
          <form method="dialog" className="mt-5">
            <Button type="submit" className="w-full">Entendi</Button>
          </form>
        </div>
      </dialog>
    </>
  );
}
