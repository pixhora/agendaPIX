"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchRefundPreview, postRefund } from "@/lib/dashboard/refund-client";
import {
  BALANCE_WARNING,
  blockReasonMessage,
  confirmLabel,
  CONNECT_LABEL,
  connectMercadoPagoHref,
  customerLine,
  DATE_HINT,
  DATE_LABEL,
  dialogDeadline,
  DISCONNECTED_COPY,
  formatRefundAmount,
  IN_PROCESS_BODY,
  IN_PROCESS_TITLE,
  paidOnLabel,
  policyLine,
  REFUND_BUTTON_LABEL,
  REFUNDED_TITLE,
  refundRequestBody,
  refundTitle,
  refundWindowLine,
  requestedDateField,
  RETRY_LABEL,
  type RefundPreview,
  type RefundResult,
} from "@/lib/dashboard/refund-ui";
import { formatBusinessDate } from "@/lib/payments/manual-refund-calendar";
import { cn } from "@/lib/utils";

export function RefundDialog({
  open,
  onClose,
  businessId,
  bookingId,
  serviceLine,
  timeZone,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  bookingId: string;
  serviceLine: string;
  timeZone: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) dialog.focus();
  }, [open]);

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-labelledby="refund-dialog-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className={cn(
        "fixed m-0 flex h-fit max-h-[88dvh] w-full max-w-none flex-col overflow-hidden border-0 bg-surface p-0 text-ink shadow-[var(--shadow-raised)] outline-none backdrop:bg-black/45",
        "inset-x-0 bottom-0 top-auto rounded-t-frame",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "lg:inset-0 lg:m-auto lg:max-h-[min(40rem,calc(100dvh-2rem))] lg:w-[min(32rem,calc(100vw-2rem))] lg:rounded-frame",
      )}
    >
      {open && (
        <RefundDialogBody
          key={`${businessId}:${bookingId}`}
          onClose={onClose}
          businessId={businessId}
          bookingId={bookingId}
          serviceLine={serviceLine}
          timeZone={timeZone}
        />
      )}
    </dialog>
  );
}

function RefundDialogBody({
  onClose,
  businessId,
  bookingId,
  serviceLine,
  timeZone,
}: {
  onClose: () => void;
  businessId: string;
  bookingId: string;
  serviceLine: string;
  timeZone: string;
}) {
  const lock = useRef(false);
  const alive = useRef(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [omitDate, setOmitDate] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RefundResult | null>(null);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void fetchRefundPreview(businessId, bookingId, controller.signal).then((result) => {
      if (!alive.current || controller.signal.aborted) return;
      setLoading(false);
      if (!result.ok) {
        setAlertMessage(result.failure.message);
        return;
      }
      setPreview(result.preview);
    }).catch(() => {
      if (!alive.current || controller.signal.aborted) return;
      setLoading(false);
      setAlertMessage("Sem conexão. Tente de novo.");
    });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [businessId, bookingId]);

  const field = preview ? requestedDateField(preview) : null;
  const dateValue = (() => {
    if (!field) return "";
    if (field.readOnly) return field.value;
    if (draftDate && draftDate >= field.min && draftDate <= field.max) return draftDate;
    return field.value;
  })();
  const amountLabel = preview ? formatRefundAmount(preview.amountCents) : null;
  const rule = preview ? policyLine(preview.policy) : null;
  const paidLabel = preview ? paidOnLabel(preview.paidAt, timeZone) : null;
  const windowLine = preview ? refundWindowLine(preview.paidAt, timeZone, preview.todayLocal) : null;
  const deadline = preview ? dialogDeadline({
    requestedOn: preview.requestedOn,
    pickedOn: dateValue,
    todayLocal: preview.todayLocal,
    manualRefundDueAt: preview.manualRefundDueAt,
    timeZone,
  }) : null;
  const storedDateLabel = field?.readOnly ? safeBusinessDate(field.value, timeZone) : null;
  const disconnected = preview?.reason === "mp_account_not_connected";
  const showForm = Boolean(preview?.eligible && !success);
  const busy = loading || submitting;

  useEffect(() => {
    const dialog = document.getElementById("refund-dialog-title")?.closest("dialog");
    dialog?.setAttribute("aria-busy", busy ? "true" : "false");
  }, [busy]);

  async function refreshPreview() {
    const again = await fetchRefundPreview(businessId, bookingId);
    if (!alive.current) return;
    if (again.ok) setPreview(again.preview);
  }

  async function submit() {
    if (lock.current || !preview?.eligible || !amountLabel || !field) return;
    lock.current = true;
    setSubmitting(true);
    setAlertMessage(null);
    setFieldError(null);
    const sendDate = !field.readOnly && !omitDate;
    try {
      const outcome = await postRefund(businessId, bookingId, refundRequestBody({
        expectedAmountCents: preview.amountCents,
        requestedOn: dateValue,
        sendDate,
      }));
      if (!alive.current) return;
      if (outcome.ok) {
        setSuccess(outcome.result);
        setSubmitting(false);
        return;
      }
      lock.current = false;
      setSubmitting(false);
      const failure = outcome.failure;
      if (failure.kind === "field") {
        setFieldError(failure.message);
        return;
      }
      setAlertMessage(failure.message);
      if (failure.kind === "retry") setOmitDate(true);
      if (failure.kind === "reload" || failure.kind === "retry") await refreshPreview();
    } catch {
      if (!alive.current) return;
      lock.current = false;
      setSubmitting(false);
      setAlertMessage("Sem conexão. Tente de novo.");
    }
  }

  const title = success
    ? success.status === "in_process" ? IN_PROCESS_TITLE : REFUNDED_TITLE
    : preview ? refundTitle(amountLabel, preview.customer.name) : REFUND_BUTTON_LABEL;

  return (
    <div className="flex max-h-[88dvh] min-h-0 flex-col lg:max-h-[min(40rem,calc(100dvh-2rem))]" aria-busy={busy}>
      <div className="shrink-0 border-b border-line px-5 pb-4 pt-8 sm:px-6">
        <div className="flex items-start justify-end">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></Button>
        </div>
        <h2 id="refund-dialog-title" className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
        {loading && !preview && (
          <div className="mt-4 grid gap-3" aria-live="polite">
            <p className="text-sm text-muted">Carregando a devolução…</p>
            <span className="h-4 w-2/3 rounded-full bg-subtle" />
            <span className="h-16 rounded-field bg-subtle" />
          </div>
        )}

        {alertMessage && <p role="alert" className="mt-4 rounded-field border border-danger/30 bg-danger-soft px-3 py-3 text-sm text-danger">{alertMessage}</p>}

        {success && (
          <p className="mt-4 text-sm text-muted">
            {success.status === "in_process" ? IN_PROCESS_BODY : amountLabel ? `O Pix de ${amountLabel} volta para a conta que pagou.` : "O Pix volta para a conta que pagou."}
          </p>
        )}

        {preview && !success && (
          <div className="mt-4 grid gap-4 text-sm">
            <p>{customerLine(preview.customer.name, preview.customer.emailMasked)}</p>
            {serviceLine && !showForm && <p className="text-muted">{serviceLine}</p>}
            {!preview.eligible && (
              <p role="alert">{disconnected ? DISCONNECTED_COPY : blockReasonMessage(preview.reason)}</p>
            )}
            {disconnected && (
              <Link className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4" href={connectMercadoPagoHref(businessId)}>{CONNECT_LABEL}</Link>
            )}
            {showForm && (
              <>
                <dl className="grid gap-3">
                  {serviceLine && <div><dt className="text-muted">Serviço</dt><dd className="font-semibold">{serviceLine}</dd></div>}
                  {amountLabel && paidLabel && <div><dt className="text-muted">Sinal pago</dt><dd className="font-semibold tabular-nums">{amountLabel} em {paidLabel}</dd></div>}
                  <div>
                    <dt className="text-muted">Regra da reserva</dt>
                    <dd className="font-semibold">{rule ?? "Sem regra gravada nesta reserva."}</dd>
                  </div>
                </dl>
                <div className="grid gap-1.5">
                  {field?.readOnly ? (
                    <>
                      <p id="refund-date-label" className="font-semibold">{DATE_LABEL}</p>
                      <p aria-labelledby="refund-date-label" className="rounded-field border border-line bg-subtle px-3 py-3 font-semibold">{storedDateLabel}</p>
                    </>
                  ) : (
                    <>
                      <label className="font-semibold" htmlFor="refund-requested-on">{DATE_LABEL}</label>
                      <input
                        id="refund-requested-on"
                        type="date"
                        min={field?.min}
                        max={field?.max}
                        value={dateValue}
                        aria-invalid={fieldError ? true : undefined}
                        aria-describedby={fieldError ? "refund-date-hint refund-return-by refund-date-error" : "refund-date-hint refund-return-by"}
                        onChange={(event) => { setDraftDate(event.target.value); setFieldError(null); }}
                        className="min-h-11 w-full rounded-field border border-line-strong/60 bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                      />
                    </>
                  )}
                  <p id="refund-date-hint" className="text-xs text-muted">{DATE_HINT}</p>
                  {deadline && <p id="refund-return-by" aria-live="polite" className={deadline.kind === "eve" ? "font-semibold text-warning" : "font-semibold"}>{deadline.text}</p>}
                  {fieldError && <p id="refund-date-error" role="alert" className="text-sm text-danger">{fieldError}</p>}
                </div>
                {amountLabel && (
                  <p className="tabular-nums"><span className="text-muted">Valor a devolver </span><span className="font-semibold">{amountLabel}</span></p>
                )}
                <p className="rounded-field bg-warning-soft px-3 py-3 text-sm text-warning">
                  <span className="font-semibold">{BALANCE_WARNING}</span>
                  {windowLine && <span className="mt-1 block">{windowLine}</span>}
                </p>
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              </>
            )}
          </div>
        )}
      </div>
      {showForm && (
        <div className="shrink-0 border-t border-line bg-surface px-5 py-4 sm:px-6">
          <Button type="button" variant="danger" className="w-full" disabled={!amountLabel || submitting} onClick={() => { void submit(); }}>
            {submitting ? "Devolvendo…" : omitDate ? RETRY_LABEL : confirmLabel(amountLabel)}
          </Button>
        </div>
      )}
    </div>
  );
}

function safeBusinessDate(isoDate: string, timeZone: string) {
  try {
    return formatBusinessDate(isoDate, timeZone);
  } catch {
    return isoDate;
  }
}
