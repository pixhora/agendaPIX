"use client";

import { useId, useRef } from "react";
import { Check, Clock, Pause, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHECKOUT_AVAILABLE,
  COMPLETE_PLAN,
  formatPlanReais,
  formatTrialEnd,
  trialCopy,
  trialTone,
  type BillingView,
} from "@/lib/dashboard/trial-notice";

const KEEPS = [
  "Reservas já feitas continuam valendo",
  "Você edita serviços, horários e a política do sinal",
] as const;

export function TrialBanner({ billing, timeZone, publicHref }: { billing: BillingView; timeZone: string; publicHref?: string }) {
  const tone = trialTone(billing);
  const copy = trialCopy(billing, formatTrialEnd(billing.trialEndsAt, timeZone));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  if (!copy || tone === "none") return null;
  const price = formatPlanReais(billing.plan.priceCents);
  const open = () => dialogRef.current?.showModal();

  return (
    <>
      {tone === "discreet" && (
        <div role="region" aria-label="Aviso da assinatura" className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-full border border-line bg-surface px-4 py-2">
          <p className="min-w-0 text-sm"><span className="font-semibold">{copy.title}</span> <span className="text-muted">· {copy.body}</span></p>
          <button type="button" onClick={open} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">O que muda?</button>
        </div>
      )}
      {tone === "strong" && (
        <section role="region" aria-label="Aviso da assinatura" className="rounded-card border border-warning/30 bg-warning-soft p-4">
          <div className="flex items-start gap-3">
            <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-ink">{copy.title}</h2>
              <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-ink">{copy.body}</p>
            </div>
          </div>
          <div className="mt-3">
            <Button type="button" variant="outline" onClick={open} className="w-full sm:w-auto">O que muda?</Button>
          </div>
        </section>
      )}
      {tone === "paused" && (
        <section role="region" aria-label="Aviso da assinatura" className="rounded-card bg-slab p-4 text-slab-foreground sm:p-5">
          <div className="flex items-start gap-3">
            <Pause aria-hidden="true" className="mt-1 size-5 shrink-0 text-pix-bright" />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold">{copy.title}</h2>
              <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-slab-muted">{copy.body}</p>
            </div>
          </div>
          <ul className="mt-4 grid gap-2 text-sm">
            {KEEPS.map((item) => <li key={item} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix-bright" />{item}</li>)}
            <li className="flex items-start gap-2"><X aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix-bright" />Clientes não marcam horários novos</li>
          </ul>
          <p className="mt-4 text-sm text-slab-muted">
            Sua página mostra que o agendamento online está pausado.
            {publicHref && <> <a href={publicHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-pix-bright underline underline-offset-4">Ver como fica<span className="sr-only"> (abre em nova aba)</span></a></>}
          </p>
          <Button type="button" onClick={open} className="mt-3 w-full bg-pix-bright text-[#0b0b0c] hover:bg-pix-bright sm:w-auto">O que muda?</Button>
        </section>
      )}
      <dialog ref={dialogRef} aria-labelledby={titleId} className="m-auto w-[min(calc(100%-2rem),28rem)] max-h-[85vh] overflow-auto rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-ink/50">
        <div className="p-5 sm:p-6">
          <h2 id={titleId} className="font-display text-xl font-bold">O que muda</h2>
          <p className="mt-1 text-sm text-muted">Plano à venda agora. O outro fica para depois.</p>
          <div className="mt-4 rounded-card bg-slab p-4 text-slab-foreground">
            <p className="text-sm text-slab-muted">{billing.plan.name}</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{price}<span className="text-base font-semibold text-slab-muted">/mês</span></p>
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
          {!CHECKOUT_AVAILABLE && <p className="mt-4 text-sm text-ink">Ainda não dá para contratar a assinatura por aqui. O plano {billing.plan.name} é {price}/mês quando a contratação entrar no painel.</p>}
          <form method="dialog" className="mt-5">
            <Button type="submit" className="w-full">Entendi</Button>
          </form>
        </div>
      </dialog>
    </>
  );
}
