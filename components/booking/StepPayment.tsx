"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import type { BookingResponse, PaymentStatusResponse } from "./types";
import { formatCurrency, formatTimeSlot } from "./formatters";
import { pixUiPhase } from "./pix-status";
import { FlaskConical } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { PIX_ICONS, PIX_STATUS_ICONS } from "@/lib/icons/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ValueSlab, StatusChip } from "@/components/ui/value-slab";
import type { AvailabilitySlot, PublicService } from "./types";
import { devSimulatePixUrl, publicBookingPaymentUrl } from "@/lib/public-api";
import {
  PAYMENT_CHECK_ERROR_MESSAGE,
  PAYMENT_CHECK_TIMEOUT_MESSAGE,
  PAYMENT_CHECK_TIMEOUT_MS,
  canShowDevSimulatePix,
  pendingMessageForAttempts,
  withPaymentCheckTimeout,
} from "./payment-check";
import {
  formatCountdown,
  isDeadlineClose,
  nextDeadlineAnnouncement,
  paymentDeadlineIso,
  type PixDeadlineMilestone,
} from "./pix-deadline";
import { ReservedTimeBand } from "./ReservedTimeBand";
import { PixQr } from "./PixQr";
import { PolicySummaryLine } from "@/components/policy/PolicySummaryLine";
import { policyLineTone } from "./policy-gate";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

interface StepPaymentProps {
  slug: string;
  booking: BookingResponse;
  onPaymentConfirmed: (updatedBooking: PaymentStatusResponse) => void;
  onRestart: () => void;
  checkStatusFn?: () => Promise<PaymentStatusResponse | null>;
  /** Dados do pedido para o resumo acima do QR. */
  summary?: { service: PublicService; slot: AvailabilitySlot; timezone: string };
  /** Nome de quem recebe o Pix, vindo do servidor. */
  pixRecipientDisplayName?: string | null;
  onOpenPolicy?: (trigger: HTMLElement) => void;
}

export function StepPayment({
  slug,
  booking,
  onPaymentConfirmed,
  onRestart,
  checkStatusFn,
  summary,
  pixRecipientDisplayName,
  onOpenPolicy,
}: StepPaymentProps) {
  const payment = booking.payment;
  const timezone = summary?.timezone ?? "America/Sao_Paulo";
  const deadlineIso = paymentDeadlineIso(booking);
  const deadlineMs = deadlineIso ? new Date(deadlineIso).getTime() : null;
  const untilLabel = deadlineIso ? formatTimeSlot(deadlineIso, timezone) : null;
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [phase, setPhase] = useState(() => pixUiPhase(booking));
  /** Spinner do botão "Já paguei" — só em verificação manual. */
  const [isManualChecking, setIsManualChecking] = useState(false);
  /** Indicador suave no status (polling em segundo plano). */
  const [, setIsBackgroundChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const isCheckingRef = useRef(false);
  const hasCheckedOnExpireRef = useRef(false);
  const manualAttemptsRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const announcedRef = useRef<Set<PixDeadlineMilestone>>(new Set());
  const lastMinuteRef = useRef<number | null>(null);

  const showDevSimulate = canShowDevSimulatePix(payment?.provider);
  const isTerminal = phase === "expired" || phase === "cancelled";

  const applyStatus = useCallback(
    (data: PaymentStatusResponse | null | undefined, source: "manual" | "background") => {
      if (!data) {
        if (source === "manual") {
          manualAttemptsRef.current += 1;
          setCheckError(pendingMessageForAttempts(manualAttemptsRef.current));
        }
        return;
      }

      const next = pixUiPhase(data);
      setPhase(next);

      if (next === "paid" || data.status === "confirmed") {
        setCheckError(null);
        onPaymentConfirmed(data);
        return;
      }

      if (next === "expired" || next === "cancelled") {
        setCheckError(null);
        return;
      }

      if (source === "manual") {
        manualAttemptsRef.current += 1;
        setCheckError(pendingMessageForAttempts(manualAttemptsRef.current));
      }
    },
    [onPaymentConfirmed],
  );

  const checkStatus = useCallback(
    async (source: "manual" | "background" = "background") => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      if (source === "manual") {
        setIsManualChecking(true);
        setCheckError(null);
      } else {
        setIsBackgroundChecking(true);
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), PAYMENT_CHECK_TIMEOUT_MS);

      try {
        let data: PaymentStatusResponse | null | undefined;

        if (checkStatusFn) {
          data = await withPaymentCheckTimeout(checkStatusFn(), controller.signal);
        } else {
          if (!booking.accessToken) {
            if (source === "manual") {
              setCheckError(PAYMENT_CHECK_ERROR_MESSAGE);
            }
            return;
          }

          const res = await fetch(publicBookingPaymentUrl(slug, booking.bookingId), {
            headers: { Authorization: `Bearer ${booking.accessToken}` },
            signal: controller.signal,
          });

          if (!res.ok) {
            throw new Error("Erro ao verificar pagamento.");
          }

          data = (await res.json()) as PaymentStatusResponse;
        }

        applyStatus(data, source);
      } catch (error) {
        const aborted = error instanceof DOMException
          ? error.name === "AbortError"
          : error instanceof Error && error.name === "AbortError";
        if (source === "manual") {
          setCheckError(aborted ? PAYMENT_CHECK_TIMEOUT_MESSAGE : PAYMENT_CHECK_ERROR_MESSAGE);
        } else if (aborted) {
          // Polling silencioso: não sobrescreve mensagem manual com timeout de fundo.
        } else {
          setCheckError((prev) => prev ?? PAYMENT_CHECK_ERROR_MESSAGE);
        }
      } finally {
        clearTimeout(timeoutId);
        if (abortRef.current === controller) abortRef.current = null;
        setIsManualChecking(false);
        setIsBackgroundChecking(false);
        isCheckingRef.current = false;
      }
    },
    [slug, booking.bookingId, booking.accessToken, checkStatusFn, applyStatus],
  );

  // Relógio visual. O texto acessível fica no horário-limite; o ao vivo só muda nos marcos.
  useEffect(() => {
    announcedRef.current = new Set();
    lastMinuteRef.current = null;
  }, [deadlineIso]);

  useEffect(() => {
    if (deadlineMs == null || isTerminal) return;

    const tick = () => {
      const current = Date.now();
      const remaining = deadlineMs - current;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const minute = Math.floor(current / 60000);
      if (!reduced || lastMinuteRef.current !== minute || remaining <= 0) {
        lastMinuteRef.current = minute;
        setNow(current);
      }

      const label = formatTimeSlot(new Date(deadlineMs).toISOString(), timezone);
      const next = nextDeadlineAnnouncement(remaining, announcedRef.current, label);
      if (!next) return;
      announcedRef.current.add(next.milestone);
      if (next.milestone === "one" || next.milestone === "expired") announcedRef.current.add("five");
      if (next.milestone === "expired") announcedRef.current.add("one");
      setAnnouncement(next.message);
      if (next.milestone === "expired" && !hasCheckedOnExpireRef.current) {
        hasCheckedOnExpireRef.current = true;
        void checkStatus("background");
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [deadlineMs, timezone, checkStatus, isTerminal]);

  // Polling automático a cada 4 segundos
  useEffect(() => {
    if (isTerminal) return;

    const interval = setInterval(() => {
      void checkStatus("background");
    }, 4000);

    return () => clearInterval(interval);
  }, [checkStatus, isTerminal]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleCopy = async () => {
    if (!payment?.copyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      document.getElementById("pix-copypaste")?.focus();
    }
  };

  const handleSimulateDev = async () => {
    if (!showDevSimulate || !booking.accessToken || isSimulating) return;
    setIsSimulating(true);
    setCheckError(null);
    try {
      const res = await fetch(devSimulatePixUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${booking.accessToken}`,
        },
        body: JSON.stringify({ slug, bookingId: booking.bookingId }),
      });
      if (!res.ok) {
        throw new Error("Falha ao simular");
      }
      // Lê o status fora do mutex do polling para avançar mesmo se houver verificação em curso.
      const statusRes = await fetch(publicBookingPaymentUrl(slug, booking.bookingId), {
        headers: { Authorization: `Bearer ${booking.accessToken}` },
      });
      if (!statusRes.ok) throw new Error("Falha ao ler status");
      const data = (await statusRes.json()) as PaymentStatusResponse;
      applyStatus(data, "manual");
    } catch {
      setCheckError("Não foi possível simular o pagamento. Verifique o ambiente de desenvolvimento.");
    } finally {
      setIsSimulating(false);
    }
  };

  const remainingMs = now != null && deadlineMs != null ? deadlineMs - now : null;
  const countdown = remainingMs != null ? formatCountdown(remainingMs) : null;
  const close = remainingMs != null && isDeadlineClose(remainingMs);
  const releasedTime = summary ? formatTimeSlot(summary.slot.startsAt, summary.timezone) : null;

  if (phase === "expired") {
    return (
      <div role="alert" aria-live="assertive" className="space-y-4 rounded-card border border-danger/30 bg-danger-soft p-6 text-center">
        <Icon icon={PIX_STATUS_ICONS.expired} size="xl" className="mx-auto text-danger" />
        <h2 className="font-display text-xl font-bold text-ink">Tempo de reserva esgotado</h2>
        <p className="text-sm text-ink">
          {releasedTime
            ? `O prazo para pagar o sinal acabou e o horário das ${releasedTime} foi liberado para outros clientes.`
            : "O prazo para pagar o sinal acabou e o horário foi liberado para outros clientes."}
        </p>
        <Button onClick={onRestart} size="lg" className="w-full">
          Fazer novo agendamento
        </Button>
      </div>
    );
  }

  if (phase === "cancelled") {
    return (
      <div role="alert" aria-live="assertive" className="space-y-4 rounded-card border border-danger/30 bg-danger-soft p-6 text-center">
        <Icon icon={PIX_STATUS_ICONS.cancelled} size="xl" className="mx-auto text-danger" />
        <h2 className="font-display text-xl font-bold text-ink">Pagamento cancelado</h2>
        <p className="text-sm text-ink">Esta cobrança Pix foi cancelada. Escolha outro horário para gerar um novo sinal.</p>
        <Button onClick={onRestart} size="lg" className="w-full">
          Fazer novo agendamento
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pix-step">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Pague o sinal por Pix</h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-ink">
          <span className="relative flex size-2.5" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-pix opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-pix" />
          </span>
          <span role="status" aria-live="polite" aria-atomic="true">
            {isManualChecking ? "Verificando o pagamento…" : "Horário pré-reservado. Aguardando o pagamento do Pix."}
          </span>
        </p>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="pix-deadline-live">
        {announcement}
      </p>

      {untilLabel ? (
        <div className={cn("rounded-card px-4 py-3", close ? "bg-warning-soft" : "bg-pix-soft")} data-testid="pix-pay-until">
          <p className={cn("text-sm font-semibold", close ? "text-warning" : "text-ink")}>Pague até {untilLabel}</p>
          {close ? <p className="mt-1 text-sm text-warning">O prazo para pagar está acabando.</p> : null}
        </div>
      ) : null}

      {payment?.provider === "fake" && (
        <div role="note" className="flex gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">Ambiente de teste.</strong> Este Pix é simulado: não envie dinheiro real.
          </p>
        </div>
      )}

      {summary ? <ReservedTimeBand startsAt={summary.slot.startsAt} timezone={summary.timezone} /> : null}

      <ValueSlab
        size="compact"
        label="Sinal a pagar por Pix"
        value={formatCurrency(payment?.amountCents ?? 0)}
        badge={
          countdown && remainingMs != null && remainingMs > 0 && !reducedMotion ? (
            <StatusChip active tone="slab" className={close ? "bg-warning-soft text-warning" : undefined}>
              <Icon icon={PIX_ICONS.timer} className="size-3.5" />
              <span aria-hidden="true" className="font-mono tabular-nums">{countdown}</span>
            </StatusChip>
          ) : undefined
        }
        sublabel={summary
          ? pixRecipientDisplayName
            ? `${summary.service.name} · para ${pixRecipientDisplayName}`
            : summary.service.name
          : "O horário é confirmado assim que o Pix cair."}
      />
      {summary?.service.policySummary && onOpenPolicy ? (
        <PolicySummaryLine
          summary={summary.service.policySummary}
          tone={policyLineTone(summary.service.depositPolicy, summary.slot.startsAt)}
          compact
          onDetails={onOpenPolicy}
        />
      ) : null}

      <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="order-1 min-w-0 flex-1 space-y-4 sm:order-2">
            {payment?.copyPaste && (
              <div className="space-y-2">
                <Button type="button" variant="pix" size="lg" onClick={() => void handleCopy()} className="w-full" data-testid="pix-copy-button">
                  {copied ? <Icon icon={PIX_ICONS.copied} size="md" /> : <Icon icon={PIX_ICONS.copy} size="md" />}
                  {copied ? "Copiado" : "Copiar código"}
                </Button>
                <p className="sr-only" aria-live="polite" aria-atomic="true">{copied ? "Copiado." : ""}</p>
                <label htmlFor="pix-copypaste" className="block text-xs font-semibold text-muted">Pix copia e cola</label>
                <Input
                  id="pix-copypaste"
                  data-testid="pix-copypaste"
                  type="text"
                  readOnly
                  value={payment.copyPaste}
                  onFocus={(e) => e.currentTarget.select()}
                  className="truncate font-mono"
                />
              </div>
            )}
            <ol className="space-y-2 text-sm text-ink">
              <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold">1</span>Toque em Copiar código.</li>
              <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold">2</span>No app do banco, abra Pix e cole o código. Se preferir, escaneie o QR.</li>
              <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold">3</span>Confirme o valor. A confirmação aparece aqui sozinha.</li>
            </ol>
          </div>

          <div className="order-2 mx-auto w-full max-w-[200px] shrink-0 sm:order-1 sm:mx-0">
            <PixQr value={payment?.qrCodeDataUrl} />
          </div>
        </div>
      </div>

      {checkError && (
        <p role="alert" className="text-center text-sm font-medium text-danger">
          {checkError}
        </p>
      )}

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          disabled={isManualChecking || isSimulating}
          aria-busy={isManualChecking || undefined}
          onClick={() => void checkStatus("manual")}
          className="w-full"
        >
          {isManualChecking ? <Icon icon={PIX_ICONS.loading} size="md" className="animate-spin motion-reduce:animate-none" /> : <Icon icon={PIX_ICONS.refresh} size="md" />}
          {isManualChecking ? "Verificando confirmação…" : "Já paguei, verificar agora"}
        </Button>
        <p className="text-center text-xs text-muted">Verificamos automaticamente a cada poucos segundos. Guarde o comprovante.</p>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <Icon icon={PIX_ICONS.secure} />
        Pagamento seguro via Pix · o sinal confirma seu horário
      </p>

      {showDevSimulate && (
        <div role="note" className="space-y-2 rounded-card border border-dashed border-warning/40 bg-warning-soft/60 p-4">
          <p className="text-center text-xs font-semibold text-warning">
            Somente desenvolvimento · provedor fake
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={isSimulating || isManualChecking}
            onClick={() => void handleSimulateDev()}
            className="w-full border-warning/40"
          >
            {isSimulating ? <Icon icon={PIX_ICONS.loading} size="md" className="animate-spin" /> : <Icon icon={FlaskConical} size="md" />}
            {isSimulating ? "Simulando…" : "Simular pagamento (dev)"}
          </Button>
        </div>
      )}
    </div>
  );
}
