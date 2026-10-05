"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import type { BookingResponse, PaymentStatusResponse } from "./types";
import { formatCurrency } from "./formatters";
import { pixUiPhase } from "./pix-status";
import { Ban, Check, Copy, FlaskConical, Loader2, RefreshCw, Timer, TimerOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ValueSlab, StatusChip } from "@/components/ui/value-slab";
import type { AvailabilitySlot, PublicService } from "./types";
import { formatDateFull, formatTimeSlot } from "./formatters";
import { publicBookingPaymentUrl } from "@/lib/public-api";

interface StepPaymentProps {
  slug: string;
  booking: BookingResponse;
  onPaymentConfirmed: (updatedBooking: PaymentStatusResponse) => void;
  onRestart: () => void;
  checkStatusFn?: () => Promise<PaymentStatusResponse | null>;
  /** Dados do pedido para o resumo acima do QR. */
  summary?: { service: PublicService; slot: AvailabilitySlot; timezone: string };
}

export function StepPayment({
  slug,
  booking,
  onPaymentConfirmed,
  onRestart,
  checkStatusFn,
  summary,
}: StepPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [phase, setPhase] = useState(() => pixUiPhase(booking));
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const isCheckingRef = useRef(false);
  const hasCheckedOnExpireRef = useRef(false);

  const payment = booking.payment;
  const expiresAt = payment?.expiresAt || booking.expiresAt;
  const isTerminal = phase === "expired" || phase === "cancelled";

  const applyStatus = useCallback(
    (data: PaymentStatusResponse | null | undefined) => {
      if (!data) return;
      const next = pixUiPhase(data);
      setPhase(next);
      if (next === "paid" || data.status === "confirmed") {
        onPaymentConfirmed(data);
      }
    },
    [onPaymentConfirmed],
  );

  // Função para verificar status do pagamento via API pública ou mock
  const checkStatus = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);
    setCheckError(null);

    try {
      if (checkStatusFn) {
        const data = await checkStatusFn();
        applyStatus(data);
        return;
      }

      if (!booking.accessToken) return;

      const res = await fetch(
        publicBookingPaymentUrl(slug, booking.bookingId),
        {
          headers: {
            Authorization: `Bearer ${booking.accessToken}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("Erro ao verificar pagamento.");
      }

      const data: PaymentStatusResponse = await res.json();
      applyStatus(data);
    } catch {
      setCheckError("Não foi possível verificar no momento. Tentaremos novamente.");
    } finally {
      setIsChecking(false);
      isCheckingRef.current = false;
    }
  }, [slug, booking.bookingId, booking.accessToken, checkStatusFn, applyStatus]);

  // Atualiza contador regressivo a cada segundo
  useEffect(() => {
    if (!expiresAt || isTerminal) return;

    const targetTime = new Date(expiresAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        // Consulta o servidor antes de anunciar a expiração local
        if (!hasCheckedOnExpireRef.current) {
          hasCheckedOnExpireRef.current = true;
          void checkStatus();
        }
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft(
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, checkStatus, isTerminal]);

  // Polling automático a cada 4 segundos
  useEffect(() => {
    if (isTerminal) return;

    const interval = setInterval(() => {
      void checkStatus();
    }, 4000);

    return () => clearInterval(interval);
  }, [checkStatus, isTerminal]);

  const handleCopy = async () => {
    if (!payment?.copyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.copyPaste);
      setCopied(true);
      toast.success("Código Pix copiado", { description: "Cole no app do seu banco, em Pix › Copia e Cola." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: o input readonly abaixo permite seleção manual
    }
  };

  if (phase === "expired") {
    return (
      <div role="alert" aria-live="assertive" className="space-y-4 rounded-card border border-danger/30 bg-danger-soft p-6 text-center">
        <TimerOff aria-hidden="true" className="mx-auto size-8 text-danger" />
        <h2 className="font-display text-xl font-bold text-ink">Tempo de reserva esgotado</h2>
        <p className="text-sm text-ink">O prazo para pagar o sinal acabou e o horário foi liberado para outros clientes.</p>
        <Button onClick={onRestart} size="lg" className="w-full">
          Fazer novo agendamento
        </Button>
      </div>
    );
  }

  if (phase === "cancelled") {
    return (
      <div role="alert" aria-live="assertive" className="space-y-4 rounded-card border border-danger/30 bg-danger-soft p-6 text-center">
        <Ban aria-hidden="true" className="mx-auto size-8 text-danger" />
        <h2 className="font-display text-xl font-bold text-ink">Pagamento cancelado</h2>
        <p className="text-sm text-ink">Esta cobrança Pix foi cancelada. Escolha outro horário para gerar um novo sinal.</p>
        <Button onClick={onRestart} size="lg" className="w-full">
          Fazer novo agendamento
        </Button>
      </div>
    );
  }

  const expiresLabel = expiresAt ? formatTimeSlot(expiresAt, summary?.timezone ?? "America/Sao_Paulo") : null;
  const liveStatus =
    isChecking
      ? "Verificando o pagamento…"
      : "Horário pré-reservado. Aguardando o pagamento do Pix.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Pague o sinal por Pix</h2>
        <p role="status" aria-live="polite" aria-atomic="true" className="mt-2 flex items-center gap-2 text-sm text-ink">
          <span className="relative flex size-2.5" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-pix opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-pix" />
          </span>
          {liveStatus}
        </p>
      </div>

      {payment?.provider === "fake" && (
        <div role="note" className="flex gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">Ambiente de teste.</strong> Este Pix é simulado: não envie dinheiro real.
          </p>
        </div>
      )}

      {/* Resumo estilo Stripe: valor em destaque antes do QR */}
      <ValueSlab
        size="compact"
        label="Sinal a pagar por Pix"
        value={formatCurrency(payment?.amountCents ?? 0)}
        badge={
          timeLeft ? (
            <StatusChip active tone="slab">
              <Timer aria-hidden="true" className="size-3.5" />
              <span aria-hidden="true" className="font-mono tabular-nums">{timeLeft}</span>
              <span className="sr-only">{expiresLabel ? `Expira às ${expiresLabel}` : "Prazo em andamento"}</span>
            </StatusChip>
          ) : undefined
        }
        sublabel={
          summary
            ? `${summary.service.name} · ${formatDateFull(summary.slot.startsAt, summary.timezone)}, ${formatTimeSlot(summary.slot.startsAt, summary.timezone)}`
            : "O horário é confirmado assim que o Pix cair."
        }
      />

      <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          {payment?.qrCodeDataUrl?.startsWith("data:image/png;base64,") ? (
            <div className="shrink-0 rounded-2xl border border-line bg-white p-3">
              {/* QR sempre sobre branco, inclusive no modo escuro. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payment.qrCodeDataUrl} alt="QR Code do Pix para pagar o sinal" width={208} height={208} className="block size-44 object-contain sm:size-52" />
            </div>
          ) : (
            <div className="flex size-44 shrink-0 items-center justify-center rounded-2xl bg-subtle text-sm text-muted">QR Code indisponível</div>
          )}
          <div className="w-full min-w-0 space-y-4">
            <ol className="space-y-2 text-sm text-ink">
              <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold">1</span>Abra o app do seu banco e vá em Pix.</li>
              <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold">2</span>Escaneie o QR ou use o Pix copia e cola.</li>
              <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold">3</span>Confirme o valor. A confirmação aparece aqui sozinha.</li>
            </ol>
            {payment?.copyPaste && (
              <div className="space-y-2">
                <Button type="button" variant="pix" size="lg" onClick={handleCopy} className="w-full" data-testid="pix-copy-button">
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? "Código copiado" : "Copiar código Pix"}
                </Button>
                <span className="sr-only" aria-live="polite">{copied ? "Código Pix copiado." : ""}</span>
                <label htmlFor="pix-copypaste" className="block text-xs font-semibold text-muted">Pix copia e cola</label>
                <input
                  id="pix-copypaste"
                  data-testid="pix-copypaste"
                  type="text"
                  readOnly
                  value={payment.copyPaste}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-h-11 w-full truncate rounded-field border border-line bg-subtle px-3 font-mono text-xs text-ink"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {checkError && (
        <p role="alert" className="text-center text-sm font-medium text-danger">
          {checkError}
        </p>
      )}

      <div className="space-y-2">
        <Button type="button" variant="outline" disabled={isChecking} onClick={() => void checkStatus()} className="w-full">
          {isChecking ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
          {isChecking ? "Verificando confirmação…" : "Já paguei, verificar agora"}
        </Button>
        <p className="text-center text-xs text-muted">Verificamos automaticamente a cada poucos segundos. Guarde o comprovante.</p>
      </div>
    </div>
  );
}
