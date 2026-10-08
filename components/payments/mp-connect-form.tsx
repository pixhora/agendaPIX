"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MP_CONNECT_CONSENT_VERSION } from "@/lib/mercadopago/consent";
import { AUTO_REFUND_ACK_ERROR, gateConnectSubmit, mpConnectAction, type MpReturnTo } from "@/lib/mercadopago/contract";

const fieldReset = "outline-none focus:outline-none focus-visible:outline-none";

export function AutoRefundAck({
  checked,
  onChange,
  invalid,
  inputRef,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  invalid: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const hintId = "mp-auto-refund-hint";
  const errorId = "mp-auto-refund-error";
  return (
    <div className={cn("rounded-card border-[1.5px] border-ink bg-surface px-3.5 py-3 focus-within:border-ring focus-within:shadow-[var(--shadow-focus)]", invalid && "border-danger")}>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          ref={inputRef}
          type="checkbox"
          name="autoRefundAck"
          value="true"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          required
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}
          className={cn("peer sr-only", fieldReset)}
        />
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-[6px] border-2 border-ink bg-surface peer-checked:bg-ink",
            invalid && "border-danger",
          )}
        >
          {checked ? (
            <svg viewBox="0 0 24 24" className="size-3.5 text-paper" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M5 12.5 10 17.5 19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
        <span className="text-sm leading-snug text-ink">
          <strong className="font-semibold">Entendi e autorizo:</strong> quando um Pix chegar depois do prazo e o horário já estiver ocupado, o AgendaPix devolve sozinho o valor inteiro, do saldo da minha conta Mercado Pago, e me avisa por e-mail.
        </span>
      </label>
      <p id={hintId} className="mt-2 pl-[34px] text-xs leading-relaxed text-muted">
        Obrigatório para conectar. Essa devolução é regra do AgendaPix para proteger seus clientes e não pode ser desligada.
      </p>
      {invalid ? (
        <p id={errorId} role="alert" className="mt-2 pl-[34px] text-[13px] font-medium text-danger">
          {AUTO_REFUND_ACK_ERROR}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Único lugar que envia o connect. Formulário nativo (urlencoded), sem fetch.
 * A caixa desmarcada impede o envio no cliente; o servidor continua exigindo autoRefundAck e consentVersion.
 */
export function MpConnectForm({
  businessId,
  returnTo,
  requireAck,
  acknowledged,
  onAcknowledgedChange,
  ackInvalid,
  pending,
  submitLabel,
  onBlocked,
  buttonVariant = "pix",
  beside,
  children,
}: {
  businessId: string;
  returnTo: MpReturnTo;
  requireAck: boolean;
  acknowledged: boolean;
  onAcknowledgedChange: (checked: boolean) => void;
  ackInvalid: boolean;
  pending?: boolean;
  submitLabel: string;
  onBlocked: () => void;
  buttonVariant?: "pix" | "default" | "outline";
  beside?: ReactNode;
  children?: ReactNode;
}) {
  const ackRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!ackInvalid || !requireAck) return;
    const timer = window.setTimeout(() => ackRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [ackInvalid, requireAck]);
  return (
    <form
      method="post"
      action={mpConnectAction(businessId)}
      onSubmit={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        if (requireAck && !gateConnectSubmit(acknowledged).ok) {
          event.preventDefault();
          onBlocked();
          ackRef.current?.focus();
        }
      }}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="consentVersion" value={MP_CONNECT_CONSENT_VERSION} />
      {requireAck ? null : <input type="hidden" name="autoRefundAck" value="true" />}
      {requireAck ? (
        <AutoRefundAck checked={acknowledged} onChange={onAcknowledgedChange} invalid={ackInvalid} inputRef={ackRef} />
      ) : null}
      {children}
      <div className={cn("mt-3", beside && "grid gap-2 min-[360px]:grid-cols-2")}>
        <button
          type="submit"
          aria-busy={pending || undefined}
          className={cn(buttonVariants({ variant: buttonVariant, size: "lg" }), "w-full")}
        >
          {pending ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
          {pending ? "Abrindo o Mercado Pago…" : submitLabel}
          {pending || buttonVariant === "outline" ? null : <ExternalLink aria-hidden="true" />}
        </button>
        {beside}
      </div>
    </form>
  );
}
