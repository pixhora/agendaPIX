"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type {
  PublicBusinessData,
  PublicService,
  AvailabilitySlot,
  BookingResponse,
} from "./types";
import { cpfDigitsOnly, normalizePhoneToE164 } from "./formatters";
import { publicBookingPagePath, publicBookingPaymentUrl, publicBookingsUrl, publicServicesUrl } from "@/lib/public-api";
import { StepProgress } from "./StepProgress";
import { StepService } from "./StepService";
import { StepSlot } from "./StepSlot";
import { StepCustomer } from "./StepCustomer";
import { StepPayment } from "./StepPayment";
import { BookingConfirmation } from "./BookingConfirmation";
import { AlertTriangle } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { BusinessAvatar } from "@/components/ui/business-avatar";
import { BUSINESS_HEADER_ICONS, PIX_ICONS } from "@/lib/icons/registry";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BrandMark } from "@/components/ui/brand";
import { BookingSummary } from "./BookingSummary";

interface BookingFlowProps {
  slug: string;
  initialBookingId?: string;
}

export function BookingFlow({ slug, initialBookingId }: BookingFlowProps) {
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
  const [customerCpf, setCustomerCpf] = useState("");

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000);

    fetch(publicServicesUrl(slug), {
      signal: controller.signal,
    })
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
          let msg = "Erro inesperado ao carregar dados.";
          if (err instanceof Error) {
            if (err.name === "AbortError") {
              msg = "A conexão demorou muito para responder. Verifique sua internet e tente novamente.";
            } else {
              msg = err.message;
            }
          }
          setBusinessError(msg);
          setIsLoadingBusiness(false);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [slug, reloadCount]);

  // Retoma sessão Pix ativa se cliente fechar aba e reabrir /[slug]
  useEffect(() => {
    if (!business || step !== 1 || isCompleted || bookingResponse) return;
    if (typeof window === "undefined") return;

    let stored: {
      bookingId: string;
      accessToken: string;
      serviceId?: string;
      customerName?: string;
      customerPhone?: string;
      customerCpf?: string;
      expiresAt?: string;
    } | null = null;

    try {
      const raw = sessionStorage.getItem(`booking_session_${slug}`);
      if (raw) {
        stored = JSON.parse(raw);
      }
    } catch {
      stored = null;
    }

    if (!stored?.bookingId || !stored?.accessToken) {
      return;
    }

    // Retoma se houver initialBookingId na URL ou se o usuário reabriu com bookingId explícito
    if (initialBookingId) {
      if (stored.bookingId !== initialBookingId) return;
    } else {
      // Se não há bookingId na URL, não sequestra o fluxo inicial
      return;
    }

    // Invariante: expirado permanece expirado
    if (stored.expiresAt && new Date(stored.expiresAt).getTime() <= Date.now()) {
      try {
        sessionStorage.removeItem(`booking_session_${slug}`);
      } catch {
        // ignore
      }
      return;
    }

    let isCancelled = false;

    fetch(publicBookingPaymentUrl(slug, stored.bookingId), {
      headers: {
        Authorization: `Bearer ${stored.accessToken}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Reserva não encontrada ou expirada");
        return res.json();
      })
      .then((paymentData) => {
        if (isCancelled) return;

        // Invariante: expirado/cancelado permanece terminal
        if (
          paymentData.status === "expired"
          || paymentData.status === "cancelled"
          || paymentData.payment?.status === "expired"
          || paymentData.payment?.status === "cancelled"
        ) {
          try {
            sessionStorage.removeItem(`booking_session_${slug}`);
            window.history.replaceState(null, "", publicBookingPagePath(slug));
          } catch {
            // ignore
          }
          return;
        }

        const matchedService =
          business.services.find((s) => s.id === stored!.serviceId) ||
          business.services[0];
        if (matchedService) {
          setSelectedService(matchedService);
        }

        if (paymentData.startsAt && paymentData.endsAt) {
          setSelectedSlot({
            startsAt: paymentData.startsAt,
            endsAt: paymentData.endsAt,
          });
        }

        if (stored?.customerName) setCustomerName(stored.customerName);
        if (stored?.customerPhone) setCustomerPhone(stored.customerPhone);
        if (stored?.customerCpf) setCustomerCpf(stored.customerCpf);

        if (paymentData.status === "confirmed") {
          setIsCompleted(true);
          try {
            sessionStorage.removeItem(`booking_session_${slug}`);
            window.history.replaceState(null, "", publicBookingPagePath(slug));
          } catch {
            // ignore
          }
          return;
        }

        const fullResponse: BookingResponse = {
          bookingId: paymentData.bookingId,
          status: paymentData.status,
          startsAt: paymentData.startsAt,
          endsAt: paymentData.endsAt,
          expiresAt: paymentData.expiresAt,
          accessToken: stored!.accessToken,
          payment: paymentData.payment,
        };

        setBookingResponse(fullResponse);
        setStep(4);
      })
      .catch(() => {
        if (isCancelled) return;
        try {
          sessionStorage.removeItem(`booking_session_${slug}`);
          window.history.replaceState(null, "", publicBookingPagePath(slug));
        } catch {
          // ignore
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [business, slug, initialBookingId, step, isCompleted, bookingResponse]);

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
        cpfCnpj: cpfDigitsOnly(customerCpf),
      },
    };

    try {
      const res = await fetch(publicBookingsUrl(slug), {
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
        // Persiste sessão ativa no sessionStorage para permitir retomar se aba for fechada
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(
              `booking_session_${slug}`,
              JSON.stringify({
                bookingId: booking.bookingId,
                accessToken: booking.accessToken,
                serviceId: selectedService.id,
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                customerCpf: customerCpf.trim(),
                expiresAt: booking.expiresAt,
              })
            );
            window.history.replaceState(null, "", publicBookingPagePath(slug, booking.bookingId));
          } catch {
            // sessionStorage desabilitado ou indisponível
          }
        }
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
    setCustomerCpf("");
    setBookingResponse(null);
    setIsCompleted(false);
    setStep(1);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(`booking_session_${slug}`);
        window.history.replaceState(null, "", publicBookingPagePath(slug));
      } catch {
        // ignore
      }
    }
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      setIdempotencyKey(crypto.randomUUID());
    }
  };


  const pageHeader = (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <BusinessAvatar name={business?.name} logoUrl={business?.logoUrl} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-extrabold tracking-tight text-ink sm:text-xl">
              {business?.name ?? <span aria-hidden="true" className="inline-block h-5 w-40 animate-pulse rounded bg-subtle motion-reduce:animate-none" />}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Icon icon={BUSINESS_HEADER_ICONS.secure} className="text-pix" />
                Agendamento online · sinal por Pix
              </span>
              {business?.address ? (
                <span className="inline-flex items-center gap-1">
                  <Icon icon={BUSINESS_HEADER_ICONS.location} />
                  <span className="truncate max-w-[28ch]">{business.address}</span>
                </span>
              ) : null}
              {business?.phone ? (
                <a
                  href={`https://wa.me/${business.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-ink hover:text-pix focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Icon icon={BUSINESS_HEADER_ICONS.whatsapp} />
                  WhatsApp
                  <span className="sr-only"> do estabelecimento (abre em nova aba)</span>
                </a>
              ) : null}
            </p>
          </div>
        </div>
        <ThemeToggle className="hidden sm:inline-flex" />
      </div>
    </header>
  );

  const pageFooter = (
    <footer className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 pb-10 pt-4 text-center text-xs text-muted sm:flex-row sm:justify-between sm:px-6 sm:text-left">
      <p className="inline-flex items-center gap-1.5">
        <Icon icon={PIX_ICONS.lock} />
        O sinal garante o horário. Seus dados são usados só para este agendamento.
      </p>
      <div className="flex items-center gap-3">
        <ThemeToggle className="sm:hidden" />
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-ink">
          <BrandMark size={24} className="rounded-md" /> Feito com Agenda
        </Link>
      </div>
    </footer>
  );

  if (isLoadingBusiness) {
    return (
      <div className="min-h-dvh bg-paper">
        {pageHeader}
        <main id="content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6" role="status" aria-busy="true">
          <div className="max-w-2xl space-y-3">
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
          </div>
          <span className="sr-only">Carregando informações do estabelecimento...</span>
        </main>
      </div>
    );
  }

  if (businessError || !business) {
    return (
      <div className="min-h-dvh bg-paper">
        <main id="content" className="mx-auto max-w-md px-4 py-16">
          <div role="alert" className="space-y-3 rounded-card border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
            <AlertTriangle aria-hidden="true" className="mx-auto size-8 text-warning" />
            <h1 className="font-display text-xl font-bold text-ink">Página indisponível</h1>
            <p className="text-sm text-muted">{businessError || "Estabelecimento não disponível."}</p>
            <Button
              onClick={() => {
                setIsLoadingBusiness(true);
                setReloadCount((c) => c + 1);
              }}
              className="mt-2 w-full"
            >
              Tentar novamente
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (isCompleted && selectedService && selectedSlot) {
    return (
      <div className="min-h-dvh bg-paper">
        {pageHeader}
        <main id="content" className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
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
        {pageFooter}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper">
      {pageHeader}
      <main id="content" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-5">
          <StepProgress currentStep={step} />

          <section key={step} aria-label="Etapa atual" className="rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow-card)] animate-step-in sm:p-8">
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
                cpf={customerCpf}
                isSubmitting={isSubmittingBooking}
                errorMessage={bookingError}
                onChangeName={setCustomerName}
                onChangePhone={setCustomerPhone}
                onChangeCpf={setCustomerCpf}
                onBack={() => setStep(2)}
                onSubmit={handleCreateBooking}
                summaryClassName="lg:hidden"
              />
            )}

            {step === 4 && bookingResponse && (
              <StepPayment
                slug={slug}
                booking={bookingResponse}
                summary={selectedService && selectedSlot ? { service: selectedService, slot: selectedSlot, timezone: business.timezone } : undefined}
                onPaymentConfirmed={() => {
                  if (typeof window !== "undefined") {
                    try {
                      sessionStorage.removeItem(`booking_session_${slug}`);
                      window.history.replaceState(null, "", publicBookingPagePath(slug));
                    } catch {
                      // ignore
                    }
                  }
                  setIsCompleted(true);
                }}
                onRestart={handleRestart}
              />
            )}
          </section>
        </div>

        <aside aria-label="Seu pedido" className="hidden lg:sticky lg:top-6 lg:block">
          <BookingSummary service={selectedService} slot={selectedSlot} timezone={business.timezone} />
          <p className="mt-4 flex gap-2 px-1 text-xs leading-relaxed text-muted">
            <Icon icon={BUSINESS_HEADER_ICONS.secure} className="shrink-0 text-pix" />
            Você paga só o sinal agora. O horário fica pré-reservado enquanto o Pix é feito. O prazo aparece no contador da cobrança.
          </p>
        </aside>
      </main>
      {pageFooter}
    </div>
  );
}
