"use client";

import React, { useEffect, useState } from "react";
import type {
  PublicBusinessData,
  PublicService,
  AvailabilitySlot,
  BookingResponse,
} from "./types";
import { normalizePhoneToE164 } from "./formatters";
import { StepProgress } from "./StepProgress";
import { StepService } from "./StepService";
import { StepSlot } from "./StepSlot";
import { StepCustomer } from "./StepCustomer";
import { StepPayment } from "./StepPayment";
import { BookingConfirmation } from "./BookingConfirmation";
import { Button } from "@/components/ui/button";

interface BookingFlowProps {
  slug: string;
}

export function BookingFlow({ slug }: BookingFlowProps) {
  // Estado do Negócio
  const [business, setBusiness] = useState<PublicBusinessData | null>(null);
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(true);
  const [businessError, setBusinessError] = useState<string | null>(null);

  // Estado das Etapas
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isCompleted, setIsCompleted] = useState(false);

  // Seleções do Usuário
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Submissão da Reserva
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingResponse, setBookingResponse] = useState<BookingResponse | null>(null);

  // Chave de Idempotência fixa por tentativa de reserva
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "00000000-0000-4000-8000-000000000000";
  });

  const [reloadCount, setReloadCount] = useState(0);

  // Carrega serviços públicos do negócio
  useEffect(() => {
    let isCancelled = false;

    fetch(`/api/public/${slug}/services`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Estabelecimento não encontrado. Verifique o link informado.");
          }
          throw new Error("Não foi possível carregar os serviços deste estabelecimento.");
        }
        return res.json();
      })
      .then((data: PublicBusinessData) => {
        if (!isCancelled) {
          setBusiness(data);
          setBusinessError(null);
          setIsLoadingBusiness(false);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : "Erro inesperado ao carregar dados.";
          setBusinessError(msg);
          setIsLoadingBusiness(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [slug, reloadCount]);

  // Cria a reserva chamando POST /api/public/[slug]/bookings
  const handleCreateBooking = async () => {
    if (!selectedService || !selectedSlot) return;

    setIsSubmittingBooking(true);
    setBookingError(null);

    const payload = {
      serviceId: selectedService.id,
      startsAt: selectedSlot.startsAt,
      customer: {
        name: customerName.trim(),
        phone: normalizePhoneToE164(customerPhone),
      },
    };

    try {
      const res = await fetch(`/api/public/${slug}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg =
          data?.error?.message ||
          (res.status === 409
            ? "Esse horário acabou de ser reservado por outra pessoa. Por favor, escolha outro horário."
            : "Não foi possível criar o agendamento. Tente novamente.");
        throw new Error(errorMsg);
      }

      const booking: BookingResponse = data;
      setBookingResponse(booking);

      // Se não há sinal ou já foi confirmado diretamente:
      if (booking.status === "confirmed" || !booking.payment) {
        setIsCompleted(true);
      } else {
        // Avança para o Passo 4 (Pix)
        setStep(4);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao agendar.";
      setBookingError(msg);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Reiniciar fluxo
  const handleRestart = () => {
    setSelectedService(null);
    setSelectedSlot(null);
    setCustomerName("");
    setCustomerPhone("");
    setBookingResponse(null);
    setIsCompleted(false);
    setStep(1);
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      setIdempotencyKey(crypto.randomUUID());
    }
  };

  // Estado de Carregamento Inicial (Skeleton)
  if (isLoadingBusiness) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-8 space-y-6" role="status" aria-busy="true">
        <div className="space-y-2 text-center">
          <div className="h-7 w-48 bg-muted animate-pulse rounded-lg mx-auto" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded mx-auto" />
        </div>
        <div className="space-y-3 pt-4">
          <div className="h-20 bg-muted animate-pulse rounded-xl" />
          <div className="h-20 bg-muted animate-pulse rounded-xl" />
          <div className="h-20 bg-muted animate-pulse rounded-xl" />
        </div>
        <span className="sr-only">Carregando informações do estabelecimento...</span>
      </div>
    );
  }

  // Estado de Erro de Carregamento
  if (businessError || !business) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 text-center space-y-4">
        <div
          role="alert"
          aria-live="polite"
          className="rounded-2xl border border-destructive/20 bg-surface p-6 shadow-sm space-y-3"
        >
          <span className="text-3xl" aria-hidden="true">⚠️</span>
          <h2 className="text-lg font-bold text-foreground">Aviso</h2>
          <p className="text-sm text-muted-foreground">{businessError || "Estabelecimento não disponível."}</p>
          <Button
            onClick={() => {
              setIsLoadingBusiness(true);
              setReloadCount((c) => c + 1);
            }}
            className="mt-2 min-h-11 w-full font-semibold"
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // Tela de Sucesso Final (Reserva Confirmada)
  if (isCompleted && selectedService && selectedSlot) {
    return (
      <main className="w-full max-w-md mx-auto px-4 py-6 md:py-10">
        <BookingConfirmation
          businessName={business.name}
          service={selectedService}
          slot={selectedSlot}
          timezone={business.timezone}
          customerName={customerName}
          customerPhone={customerPhone}
          onNewBooking={handleRestart}
        />
      </main>
    );
  }

  return (
    <main className="w-full max-w-md mx-auto px-4 py-6 md:py-10 space-y-5">
      {/* Cabeçalho da Empresa */}
      <header className="flex flex-col items-center text-center space-y-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-forest text-primary font-display font-extrabold text-lg shadow-xs ring-2 ring-primary/20">
          {business.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div className="space-y-0.5">
          <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">
            {business.name}
          </h1>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Agendamento online oficial · Garantia por Pix
          </p>
        </div>
      </header>

      {/* Barra de Progresso */}
      <StepProgress currentStep={step} />

      {/* Conteúdo do Passo Atual */}
      <div
        key={step}
        className="rounded-3xl border border-border bg-surface p-5 sm:p-7 shadow-sm animate-step-in"
      >
        {step === 1 && (
          <StepService
            services={business.services}
            selectedServiceId={selectedService?.id ?? null}
            onSelectService={(srv) => {
              setSelectedService(srv);
              setSelectedSlot(null);
            }}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && selectedService && (
          <StepSlot
            slug={slug}
            service={selectedService}
            timezone={business.timezone}
            selectedStartsAt={selectedSlot?.startsAt ?? null}
            onSelectSlot={(slot) => setSelectedSlot(slot)}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && selectedService && selectedSlot && (
          <StepCustomer
            service={selectedService}
            slot={selectedSlot}
            timezone={business.timezone}
            name={customerName}
            phone={customerPhone}
            isSubmitting={isSubmittingBooking}
            errorMessage={bookingError}
            onChangeName={setCustomerName}
            onChangePhone={setCustomerPhone}
            onBack={() => setStep(2)}
            onSubmit={handleCreateBooking}
          />
        )}

        {step === 4 && bookingResponse && (
          <StepPayment
            slug={slug}
            booking={bookingResponse}
            onPaymentConfirmed={() => {
              setIsCompleted(true);
            }}
            onRestart={handleRestart}
          />
        )}
      </div>

      {/* Rodapé Seguro */}
      <footer className="text-center text-[11px] text-muted-foreground pt-2">
        <span>🔒 Seus dados estão protegidos. Sinal antecipado para garantia do horário.</span>
      </footer>
    </main>
  );
}
