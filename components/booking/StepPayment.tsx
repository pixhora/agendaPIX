"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import type { BookingResponse, PaymentStatusResponse } from "./types";
import { formatCurrency } from "./formatters";
import { Button } from "@/components/ui/button";
import { ValueSlab, StatusChip } from "@/components/ui/value-slab";

interface StepPaymentProps {
  slug: string;
  booking: BookingResponse;
  onPaymentConfirmed: (updatedBooking: PaymentStatusResponse) => void;
  onRestart: () => void;
  checkStatusFn?: () => Promise<PaymentStatusResponse | null>;
}

export function StepPayment({
  slug,
  booking,
  onPaymentConfirmed,
  onRestart,
  checkStatusFn,
}: StepPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const isCheckingRef = useRef(false);
  const hasCheckedOnExpireRef = useRef(false);

  const payment = booking.payment;
  const expiresAt = payment?.expiresAt || booking.expiresAt;

  // Função para verificar status do pagamento via API pública ou mock
  const checkStatus = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);
    setCheckError(null);

    try {
      if (checkStatusFn) {
        const data = await checkStatusFn();
        if (data?.status === "expired" || data?.payment?.status === "expired") {
          setIsExpired(true);
        } else if (data?.status === "confirmed") {
          onPaymentConfirmed(data);
        }
        return;
      }

      if (!booking.accessToken) return;

      const res = await fetch(
        `/api/public/${slug}/bookings/${booking.bookingId}/payment`,
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
      if (data.status === "expired" || data?.payment?.status === "expired") {
        setIsExpired(true);
      } else if (data.status === "confirmed") {
        onPaymentConfirmed(data);
      }
    } catch {
      setCheckError("Não foi possível verificar no momento. Tentaremos novamente.");
    } finally {
      setIsChecking(false);
      isCheckingRef.current = false;
    }
  }, [slug, booking.bookingId, booking.accessToken, onPaymentConfirmed, checkStatusFn]);

  // Atualiza contador regressivo a cada segundo
  useEffect(() => {
    if (!expiresAt) return;

    const targetTime = new Date(expiresAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        // Consulta o servidor antes de anunciar a expiração local
        if (!hasCheckedOnExpireRef.current) {
          hasCheckedOnExpireRef.current = true;
          checkStatus();
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
  }, [expiresAt, checkStatus]);

  // Polling automático a cada 4 segundos
  useEffect(() => {
    if (isExpired) return;

    const interval = setInterval(() => {
      checkStatus();
    }, 4000);

    return () => clearInterval(interval);
  }, [checkStatus, isExpired]);

  const handleCopy = async () => {
    if (!payment?.copyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para seleção manual
    }
  };

  if (isExpired) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-4">
        <h2 className="text-xl font-bold text-destructive">Tempo de reserva esgotado</h2>
        <p className="text-sm text-foreground">
          O prazo para pagamento do sinal de 15 minutos expirou e o horário foi liberado para outros clientes.
        </p>
        <Button onClick={onRestart} className="w-full min-h-11 font-semibold">
          Fazer novo agendamento
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Pague o sinal por Pix</h2>
        <p className="text-sm text-muted-foreground">
          Horário pré-reservado. Conclua o Pix para confirmar sua vaga.
        </p>
      </div>

      {/* Alerta Obrigatório de Simulação / Teste */}
      <div
        role="alert"
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left text-xs text-amber-900 dark:text-amber-200 space-y-1"
      >
        <p className="font-bold flex items-center gap-1.5">
          <span>⚠️</span> AMBIENTE DE TESTE / DEMONSTRAÇÃO
        </p>
        <p>
          Este é um Pix simulado para testes. Não envie dinheiro real de sua conta bancária.
        </p>
      </div>

      {/* Placa de Valor do Sinal (Elemento-Assinatura v2) */}
      <ValueSlab
        label="Sinal a pagar por Pix"
        value={formatCurrency(payment?.amountCents ?? 0)}
        badge={
          timeLeft ? (
            <StatusChip active={true}>
              Expira em <span className="font-mono tabular-nums">{timeLeft}</span>
            </StatusChip>
          ) : undefined
        }
        sublabel="Horário garantido imediatamente após confirmação bancária"
      />

      {/* Caixa do QR Code e Copia e Cola */}
      <div className="rounded-2xl border border-border bg-surface p-5 text-center space-y-4 shadow-sm">

        {/* QR Code */}
        {payment?.qrCodeDataUrl ? (
          <div className="flex justify-center p-2">
            <div className="rounded-xl border border-border bg-white p-3 shadow-inner inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={payment.qrCodeDataUrl}
                alt="QR Code do Pix simulado"
                width={200}
                height={200}
                className="w-48 h-48 block mx-auto object-contain"
              />
            </div>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center bg-muted rounded-xl text-xs text-muted-foreground">
            QR Code indisponível
          </div>
        )}

        {/* Copia e Cola */}
        {payment?.copyPaste && (
          <div className="space-y-2 text-left">
            <label htmlFor="pix-copypaste" className="text-xs font-semibold text-muted-foreground block">
              Código Pix Copia e Cola:
            </label>
            <div className="flex gap-2">
              <input
                id="pix-copypaste"
                type="text"
                readOnly
                value={payment.copyPaste}
                className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-foreground truncate focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
              />
              <Button
                type="button"
                variant={copied ? "default" : "outline"}
                onClick={handleCopy}
                className="shrink-0 min-h-11 px-4 text-xs font-semibold"
              >
                {copied ? "✓ Copiado!" : "Copiar"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {checkError && (
        <p role="alert" aria-live="polite" className="text-xs text-destructive text-center">
          {checkError}
        </p>
      )}

      {/* Botão de Verificação Manual */}
      <div className="space-y-2 pt-1">
        <Button
          type="button"
          disabled={isChecking}
          onClick={checkStatus}
          className="w-full min-h-11 font-semibold"
        >
          {isChecking ? "Verificando confirmação..." : "Já fiz o pagamento no banco"}
        </Button>
        <p className="text-[11px] text-center text-muted-foreground">
          Após efetuar o Pix do sinal, a vaga é confirmada pelo estabelecimento. Guarde seu comprovante.
        </p>
      </div>
    </div>
  );
}
