"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MP_CONNECT_CONSENT_TEXT, MP_CONNECT_CONSENT_VERSION } from "@/lib/mercadopago/consent";
import { MP_AUTO_REFUND_ACK_HINT } from "@/lib/mercadopago/connect-copy";
import { AUTO_REFUND_ACK_ERROR, gateConnectSubmit, mpConnectAction, type MpReturnTo } from "@/lib/mercadopago/contract";

const fieldReset = "outline-none focus:outline-none focus-visible:outline-none";

function revealAck(node: HTMLInputElement | null) {
  if (!node) return;
  const scroller = node.closest("[data-mp-scroll]");
  if (scroller instanceof HTMLElement) {
    const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTop = Math.max(0, top - (scroller.clientHeight - node.offsetHeight) / 2);
  } else {
    node.scrollIntoView({ block: "center", behavior: "auto" });
  }
  node.focus({ preventScroll: true });
}

function AckCopy() {
  const colon = MP_CONNECT_CONSENT_TEXT.indexOf(":");
  if (colon < 1) {
    return <span className="text-sm leading-snug text-ink">{MP_CONNECT_CONSENT_TEXT}</span>;
  }
  const lead = MP_CONNECT_CONSENT_TEXT.slice(0, colon + 1);
  const rest = MP_CONNECT_CONSENT_TEXT.slice(colon + 1);
  return (
    <span className="text-sm leading-snug text-ink"><strong className="font-semibold">{lead}</strong>{rest}</span>
  );
}

export function AutoRefundAck({
  checked,
  onChange,
  invalid,
  inputRef,
  onInvalid,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  invalid: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onInvalid?: () => void;
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
          value="on"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          onInvalid={(event) => {
            event.preventDefault();
            onInvalid?.();
          }}
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
        <AckCopy />
      </label>
      <p id={hintId} className="mt-2 pl-[34px] text-[12px] leading-relaxed text-muted">
        {MP_AUTO_REFUND_ACK_HINT}
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
  lead,
  pinActions = false,
  footer,
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
  buttonVariant?: "pix" | "default" | "outline" | "link";
  beside?: ReactNode;
  children?: ReactNode;
  /** Conteúdo rolável acima da caixa, quando só o botão fica grudado. */
  lead?: ReactNode;
  /** No celular, só o botão fica grudado. A caixa e o texto ficam no fluxo. */
  pinActions?: boolean;
  footer?: ReactNode;
}) {
  const ackRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!ackInvalid || !requireAck) return;
    const timer = window.setTimeout(() => revealAck(ackRef.current), 0);
    return () => window.clearTimeout(timer);
  }, [ackInvalid, requireAck]);

  const ack = requireAck ? (
    <div className={pinActions ? "mt-4" : undefined}>
      <AutoRefundAck
        checked={acknowledged}
        onChange={onAcknowledgedChange}
        invalid={ackInvalid}
        inputRef={ackRef}
        onInvalid={() => {
          onBlocked();
          revealAck(ackRef.current);
        }}
      />
    </div>
  ) : null;

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
          revealAck(ackRef.current);
        }
      }}
      className={pinActions ? "flex min-h-0 flex-1 flex-col md:block" : undefined}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="consentVersion" value={MP_CONNECT_CONSENT_VERSION} />
      {requireAck ? null : <input type="hidden" name="autoRefundAck" value="on" />}
      {pinActions ? (
        <div data-mp-scroll="" className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 max-md:pb-4 md:overflow-visible">
          {lead}
          {ack}
          {children}
        </div>
      ) : (
        <>
          {ack}
          {children}
        </>
      )}
      <div
        className={cn(
          "mt-3 flex flex-col items-stretch gap-2",
          pinActions &&
            "shrink-0 max-md:sticky max-md:bottom-0 max-md:z-20 max-md:mt-0 max-md:border-t max-md:border-line max-md:bg-paper/95 max-md:px-5 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:pt-3 max-md:backdrop-blur-md md:static md:px-5 md:pb-6",
        )}
        data-mp-sticky={pinActions ? "" : undefined}
      >
        <button
          type="submit"
          aria-busy={pending || undefined}
          className={
            buttonVariant === "link"
              ? "inline-flex min-h-11 w-fit items-center text-sm font-semibold text-ink underline underline-offset-4 outline-none focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
              : cn(buttonVariants({ variant: buttonVariant, size: "lg" }), "w-full")
          }
        >
          {pending ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
          {pending ? "Abrindo o Mercado Pago…" : submitLabel}
          {pending || buttonVariant === "outline" || buttonVariant === "link" ? null : <ExternalLink aria-hidden="true" />}
        </button>
        {beside}
        {footer}
      </div>
    </form>
  );
}
