"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RefundDialog } from "@/components/dashboard/refund-dialog";
import { RefundEveLine, RefundMarks } from "@/components/dashboard/refund-deadline";
import { fetchRefundPreview } from "@/lib/dashboard/refund-client";
import {
  agendaHref,
  blockReasonMessage,
  CONNECT_LABEL,
  connectMercadoPagoHref,
  deepLinkGate,
  DISCONNECTED_COPY,
  OPEN_BOOKING_LABEL,
  REFUND_BUTTON_LABEL,
  showRefundAction,
  type RefundUiStatus,
} from "@/lib/dashboard/refund-ui";
import type { BookingStatusValue } from "@/components/ui/status-badge";

type Gate =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "dialog" }
  | { type: "disconnected" }
  | { type: "blocked"; message: string }
  | { type: "error"; message: string };

/** Gatilho do e-mail: só abre o diálogo se a prévia disser que a reserva pode ser devolvida. */
export function RefundDeepLink({
  businessId,
  bookingId,
  devolver,
  serviceLine,
  timeZone,
  dueTomorrow,
  dueLabel,
  refundStatus,
  depositCents,
  status,
  day,
}: {
  businessId: string;
  bookingId: string;
  devolver: boolean;
  serviceLine: string;
  timeZone: string;
  dueTomorrow: boolean;
  dueLabel: string | null;
  refundStatus: RefundUiStatus;
  depositCents: number;
  status: BookingStatusValue;
  day: string;
}) {
  const [gate, setGate] = useState<Gate>(devolver ? { type: "loading" } : { type: "idle" });
  const [open, setOpen] = useState(false);
  const show = showRefundAction({ depositCents, status, refundStatus });
  const agenda = agendaHref(businessId, day);

  useEffect(() => {
    if (!devolver) return;
    const controller = new AbortController();
    void fetchRefundPreview(businessId, bookingId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (!result.ok) {
        setGate({ type: "error", message: result.failure.message });
        return;
      }
      const next = deepLinkGate(result.preview);
      if (next === "dialog") setOpen(true);
      if (next === "blocked") {
        setGate({ type: "blocked", message: blockReasonMessage(result.preview.reason) });
        return;
      }
      setGate({ type: next });
    }).catch(() => {
      if (controller.signal.aborted) return;
      setGate({ type: "error", message: "Sem conexão. Tente de novo." });
    });
    return () => controller.abort();
  }, [devolver, businessId, bookingId]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <RefundMarks refundStatus={refundStatus} dueTomorrow={dueTomorrow} />
      </div>
      {dueTomorrow && dueLabel && <RefundEveLine dueLabel={dueLabel} />}
      {gate.type === "loading" && <p className="text-sm text-muted" aria-live="polite">Carregando a devolução…</p>}
      {gate.type === "error" && <p role="alert" className="rounded-field border border-danger/30 bg-danger-soft px-3 py-3 text-sm text-danger">{gate.message}</p>}
      {gate.type === "blocked" && <p role="alert" className="rounded-field border border-danger/30 bg-danger-soft px-3 py-3 text-sm text-danger">{gate.message}</p>}
      {gate.type === "disconnected" && (
        <section className="grid gap-3 rounded-card border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-bold">{REFUND_BUTTON_LABEL}</h2>
          <p>{DISCONNECTED_COPY}</p>
          <Link className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4" href={connectMercadoPagoHref(businessId)}>{CONNECT_LABEL}</Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-4 text-sm font-semibold" href={agenda}>{OPEN_BOOKING_LABEL}</Link>
        </section>
      )}
      {(gate.type === "blocked" || gate.type === "error") && (
        <Link className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4" href={agenda}>{OPEN_BOOKING_LABEL}</Link>
      )}
      {show && gate.type !== "disconnected" && (
        <Button type="button" variant="outline" className="w-full whitespace-normal sm:w-auto" onClick={() => setOpen(true)}>{REFUND_BUTTON_LABEL}</Button>
      )}
      <RefundDialog
        open={open}
        onClose={() => setOpen(false)}
        businessId={businessId}
        bookingId={bookingId}
        serviceLine={serviceLine}
        timeZone={timeZone}
      />
    </div>
  );
}
