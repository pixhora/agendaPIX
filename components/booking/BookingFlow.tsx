"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type {
  PublicBusinessData,
  PublicService,
  AvailabilitySlot,
  BookingResponse,
} from "./types";
import { cpfDigitsOnly, formatCurrency, normalizePhoneToE164 } from "./formatters";
import { publicBookingPagePath, publicBookingPaymentUrl, publicBookingsUrl, publicServicesUrl } from "@/lib/public-api";
import { parsePaymentStatusResponse } from "@/lib/public/payment-status";
import { showDepositUnavailableCard } from "./deposit-availability";
import { DepositUnavailableCard } from "./DepositUnavailable";
import { StepProgress } from "./StepProgress";
import { StepService } from "./StepService";
import { StepSlot } from "./StepSlot";
import { StepCustomer } from "./StepCustomer";
const StepPayment = React.lazy(() => import("./StepPayment").then((mod) => ({ default: mod.StepPayment })));
const BookingConfirmation = React.lazy(() => import("./BookingConfirmation").then((mod) => ({ default: mod.BookingConfirmation })));
import { AlertTriangle } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { BusinessAvatar } from "@/components/ui/business-avatar";
import { BUSINESS_HEADER_ICONS, PIX_ICONS } from "@/lib/icons/registry";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BrandMark } from "@/components/ui/brand";
import { BookingSummary } from "./BookingSummary";
import { GENERIC_SUBMIT_MESSAGE, OFFLINE_MESSAGE, POLICY_CHANGED_MESSAGE, businessLoadCopy, isOfflineError, publicBookingErrorView, whatsappHref } from "./booking-error";
import { migratedPixResumePayload, pixResumePayload, pixResumeStorageKey, readPixResume, shouldClearExpiredResume, shouldResumePix, type PixResumeSession } from "./pix-resume";
import { buildPublicBookingBody } from "./booking-payload";
import { PausedState } from "./PausedState";
const PolicySheet = React.lazy(() => import("@/components/policy/PolicySheet").then((mod) => ({ default: mod.PolicySheet })));

interface BookingFlowProps {
  slug: string;
  initialBookingId?: string;
  /** Dados já carregados no servidor. O primeiro render não busca de novo. */
  initialBusiness?: PublicBusinessData;
  /** Só para a prévia de desenvolvimento. Em produção o fluxo busca a página pública. */
  previewBusiness?: PublicBusinessData;
  /** Espelha `LEGAL_PAGES_PUBLISHED`. Desligado: sem link de privacidade. */
  legalPagesPublished?: boolean;
}

export function BookingFlow({ slug, initialBookingId, initialBusiness, previewBusiness, legalPagesPublished = false }: BookingFlowProps) {
  // Estado do Negócio
  const [business, setBusiness] = useState<PublicBusinessData | null>(previewBusiness ?? initialBusiness ?? null);
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(!(previewBusiness || initialBusiness));
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
  const [bookingError, setBookingError] = useState<{ message: string; contactHref: string | null; tone: "danger" | "calm" } | null>(null);
  const [depositBlocked, setDepositBlocked] = useState(false);
  const [policySheet, setPolicySheet] = useState<{ open: boolean; notice: string | null; trigger: HTMLElement | null }>({
    open: false,
    notice: null,
    trigger: null,
  });
  const [bookingResponse, setBookingResponse] = useState<BookingResponse | null>(null);

  useEffect(() => {
    if (step < 2 && !selectedService) return;
    void import("./StepPayment");
    void import("./BookingConfirmation");
    void import("@/components/policy/PolicySheet");
  }, [step, selectedService]);

  // Chave de Idempotência fixa por tentativa de reserva
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "00000000-0000-4000-8000-000000000000";
  });

  const [reloadCount, setReloadCount] = useState(0);
  const [slotsReload, setSlotsReload] = useState(0);
  const [slotNotice, setSlotNotice] = useState<string | null>(null);
  const noBookingFlow = Boolean(business && showDepositUnavailableCard(business.services));

  // Carrega serviços públicos do negócio
  useEffect(() => {
    if (previewBusiness) return;
    if (reloadCount === 0 && initialBusiness) return;
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
          const error = new Error(res.status === 404 ? "not_found" : "unavailable");
          error.name = "PublicLoadError";
          throw error;
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
          console.error(err);
          setBusinessError(businessLoadCopy(err));
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
  }, [slug, reloadCount, previewBusiness, initialBusiness]);

  // Recarregar ou voltar neste separador retoma o Pix. Fechar a aba apaga o sessionStorage.
  useEffect(() => {
    if (!business || step !== 1 || isCompleted || bookingResponse) return;
    if (typeof window === "undefined") return;

    const storageKey = pixResumeStorageKey(slug);
    let stored: PixResumeSession | null = null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const migrated = migratedPixResumePayload(raw);
        if (!migrated) {
          sessionStorage.removeItem(storageKey);
        } else {
          if (migrated !== raw) sessionStorage.setItem(storageKey, migrated);
          stored = readPixResume(migrated);
        }
      }
    } catch {
      stored = null;
    }

    if (shouldClearExpiredResume(stored, initialBookingId)) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      return;
    }

    if (!shouldResumePix(stored, initialBookingId) || !stored) return;

    let isCancelled = false;

    fetch(publicBookingPaymentUrl(slug, stored.bookingId), {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${stored.accessToken}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Reserva não encontrada ou expirada");
        return parsePaymentStatusResponse(await res.json());
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
            sessionStorage.removeItem(storageKey);
            window.history.replaceState(null, "", publicBookingPagePath(slug));
          } catch {
            // ignore
          }
          return;
        }

        const matchedService = business.services.find((s) => s.id === stored.serviceId) ?? null;
        if (matchedService) setSelectedService(matchedService);

        if (paymentData.startsAt && paymentData.endsAt) {
          setSelectedSlot({
            startsAt: paymentData.startsAt,
            endsAt: paymentData.endsAt,
          });
        }

        if (paymentData.status === "confirmed") {
          setIsCompleted(true);
          try {
            sessionStorage.removeItem(storageKey);
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
          accessToken: stored.accessToken,
          payment: paymentData.payment
            ? { ...paymentData.payment, expiresAt: paymentData.payment.expiresAt ?? null }
            : null,
          policy: paymentData.policy
            ? {
                text: paymentData.policy.text ?? null,
                latePaymentPolicy: paymentData.policy.latePaymentPolicy ?? null,
                refundDeadlineAt: paymentData.policy.refundDeadlineAt ?? null,
                rescheduleDeadlineAt: paymentData.policy.rescheduleDeadlineAt ?? null,
                refundWindowClosedAtBooking: paymentData.policy.refundWindowClosedAtBooking,
              }
            : null,
        };

        setBookingResponse(fullResponse);
        setStep(4);
      })
      .catch(() => {
        if (isCancelled) return;
        try {
          sessionStorage.removeItem(storageKey);
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

    const payload = buildPublicBookingBody({
      service: selectedService,
      startsAt: selectedSlot.startsAt,
      name: customerName.trim(),
      phone: normalizePhoneToE164(customerPhone),
      cpfDigits: cpfDigitsOnly(customerCpf),
      requiresPayerCpf: business?.requiresPayerCpf,
    });

    try {
      const res = await fetch(publicBookingsUrl(slug), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const failure = publicBookingErrorView(res.status, data);
        if (failure.kind === "paused") {
          setBusiness((current) => (current ? { ...current, bookingsPaused: true } : current));
          setBookingError(null);
          return;
        }
        if (failure.kind === "unavailable") {
          const contact = failure.contactWhatsapp ?? business?.contactWhatsapp ?? null;
          setDepositBlocked(true);
          setBookingError({ message: failure.message, contactHref: whatsappHref(contact), tone: "calm" });
          if (selectedService.depositCents > 0) {
            const next = { ...selectedService, bookable: false };
            setSelectedService(next);
            setBusiness((current) => (current ? { ...current, services: current.services.map((service) => (service.id === next.id ? next : service)) } : current));
          }
          return;
        }
        if (failure.kind === "slot_unavailable") {
          setSelectedSlot(null);
          setSlotNotice(failure.message);
          setBookingError(null);
          setStep(2);
          setSlotsReload((count) => count + 1);
          if (typeof crypto !== "undefined" && crypto.randomUUID) setIdempotencyKey(crypto.randomUUID());
          return;
        }
        if (failure.kind === "policy_changed") {
          setSelectedService((current) => (current ? {
            ...current,
            policySummary: failure.update.policySummary ?? current.policySummary,
            policyHash: failure.update.policyHash ?? current.policyHash,
            depositPolicy: failure.update.depositPolicy ?? current.depositPolicy,
            policyDetails: failure.update.policyDetails ?? current.policyDetails,
          } : current));
          setBookingError(null);
          setPolicySheet({ open: true, notice: POLICY_CHANGED_MESSAGE, trigger: null });
          if (typeof crypto !== "undefined" && crypto.randomUUID) setIdempotencyKey(crypto.randomUUID());
          return;
        }
        setBookingError({ message: failure.message, contactHref: null, tone: "danger" });
        return;
      }
      if (!data || typeof data !== "object" || !("bookingId" in data)) {
        throw new Error(GENERIC_SUBMIT_MESSAGE);
      }

      const booking = data as BookingResponse;
      setBookingResponse(booking);

      // Se não há sinal ou já foi confirmado diretamente:
      if (booking.status === "confirmed" || !booking.payment) {
        setIsCompleted(true);
      } else {
        // Recarregar esta aba retoma o Pix. Fechar a aba apaga a sessão. Sem nome, telefone ou CPF.
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(
              pixResumeStorageKey(slug),
              pixResumePayload({
                bookingId: booking.bookingId,
                accessToken: booking.accessToken,
                serviceId: selectedService.id,
                expiresAt: booking.expiresAt,
              }),
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
      console.error(err);
      const msg = isOfflineError(err) ? OFFLINE_MESSAGE : GENERIC_SUBMIT_MESSAGE;
      setBookingError({ message: msg, contactHref: null, tone: "danger" });
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Reiniciar fluxo
  const handleRestart = () => {
    setDepositBlocked(false);
    setSelectedService(null);
    setSelectedSlot(null);
    // Os dados da cliente ficam: ela não precisa digitar tudo de novo para outro horário.
    setBookingResponse(null);
    setIsCompleted(false);
    setStep(1);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(pixResumeStorageKey(slug));
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
              {noBookingFlow ? null : (
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon={BUSINESS_HEADER_ICONS.secure} className="text-pix" />
                  Agendamento online · sinal por Pix
                </span>
              )}
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
      {noBookingFlow ? null : (
        <p className="inline-flex items-center gap-1.5">
          <Icon icon={PIX_ICONS.lock} />
          O sinal garante o horário. Seus dados são usados só para este agendamento.
        </p>
      )}
      <div className="flex items-center gap-3">
        <ThemeToggle className="sm:hidden" />
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-ink">
          <BrandMark className="size-6 rounded-[7.5px]" /> Feito com AgendaPix
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
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
            <Icon icon={PIX_ICONS.loading} size="md" className="animate-spin motion-reduce:animate-none" />
            Carregando…
          </p>
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

  if (business.bookingsPaused && !isCompleted && !(step === 4 && bookingResponse)) {
    return (
      <div className="min-h-dvh bg-paper">
        {pageHeader}
        <main id="content" className="mx-auto w-full max-w-xl px-4 py-8">
          <PausedState businessName={business.name} contactWhatsapp={business.contactWhatsapp} services={business.services} autoFocus />
        </main>
        {pageFooter}
      </div>
    );
  }

  if (isCompleted && selectedService && selectedSlot) {
    return (
      <div className="min-h-dvh bg-paper">
        {pageHeader}
        <main id="content" className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
          <React.Suspense fallback={null}>
          <BookingConfirmation
            businessName={business.name}
            service={selectedService}
            slot={selectedSlot}
            timezone={business.timezone}
            customerName={customerName}
            customerPhone={customerPhone}
            policy={bookingResponse?.policy}
            policyText={bookingResponse?.policy?.text}
            refundWindowClosedAtBooking={bookingResponse?.policy?.refundWindowClosedAtBooking}
            contactWhatsapp={business.contactWhatsapp}
            onNewBooking={handleRestart}
          />
          </React.Suspense>
        </main>
        {pageFooter}
      </div>
    );
  }

  if (business.bookingsPaused && !bookingResponse) {
    const whatsapp = business.contactWhatsapp?.replace(/^\+/, "");
    return (
      <div className="min-h-dvh bg-paper">
        {pageHeader}
        <main id="content" className="mx-auto max-w-md px-4 py-16">
          <div className="space-y-4 rounded-card border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
            <h1 className="font-display text-xl font-bold text-ink">Agendamento online pausado</h1>
            <p className="text-sm text-muted">
              {whatsapp ? `Fale com ${business.name} pelo WhatsApp para marcar um horário.` : `Fale com ${business.name} para marcar um horário.`}
            </p>
            {whatsapp && (
              <Button asChild className="w-full">
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper">
      {pageHeader}
      <main id="content" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-5">
          {noBookingFlow || depositBlocked ? (
            <DepositUnavailableCard
              businessName={business.name}
              phone={business.contactWhatsapp ?? business.phone}
              autoFocus
            />
          ) : (
          <>
          <StepProgress currentStep={step} />

          <section key={step} aria-label="Etapa atual" className="rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow-card)] animate-step-in sm:p-8">
            {step === 1 && (
              <StepService
                services={business.services}
                businessName={business.name}
                contactPhone={business.contactWhatsapp ?? business.phone}
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
                onSelectSlot={(slot) => {
                  setSelectedSlot(slot);
                  setSlotNotice(null);
                }}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                contactWhatsapp={business.contactWhatsapp}
                slotsReload={slotsReload}
                notice={slotNotice}
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
                errorMessage={bookingError?.message ?? null}
                errorContactHref={bookingError?.contactHref}
                errorTone={bookingError?.tone ?? "danger"}
                onChangeName={setCustomerName}
                onChangePhone={setCustomerPhone}
                onChangeCpf={setCustomerCpf}
                onBack={() => setStep(2)}
                onSubmit={handleCreateBooking}
                summaryClassName="lg:hidden"
                requiresPayerCpf={business.requiresPayerCpf}
                onOpenPolicy={(trigger) => setPolicySheet({ open: true, notice: null, trigger })}
                legalPagesPublished={legalPagesPublished}
              />
            )}

            {step === 4 && bookingResponse && (
              <React.Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
              <StepPayment
                slug={slug}
                booking={bookingResponse}
                summary={selectedService && selectedSlot ? { service: selectedService, slot: selectedSlot, timezone: business.timezone } : undefined}
                pixRecipientDisplayName={business.pixRecipientDisplayName}
                businessName={business.name}
                contactWhatsapp={business.contactWhatsapp ?? business.phone}
                onOpenPolicy={(trigger) => setPolicySheet({ open: true, notice: null, trigger })}
                onPaymentConfirmed={() => {
                  if (typeof window !== "undefined") {
                    try {
                      sessionStorage.removeItem(pixResumeStorageKey(slug));
                      window.history.replaceState(null, "", publicBookingPagePath(slug));
                    } catch {
                      // ignore
                    }
                  }
                  setIsCompleted(true);
                }}
                onRestart={handleRestart}
              />
              </React.Suspense>
            )}
          </section>
          </>
          )}
        </div>

        {noBookingFlow ? null : <aside aria-label="Seu pedido" className="hidden lg:sticky lg:top-6 lg:block">
          <BookingSummary service={selectedService} slot={selectedSlot} timezone={business.timezone} />
          <p className="mt-4 flex gap-2 px-1 text-xs leading-relaxed text-muted">
            <Icon icon={BUSINESS_HEADER_ICONS.secure} className="shrink-0 text-pix" />
            Você paga só o sinal agora. O horário fica reservado enquanto o Pix é feito. O prazo para pagar aparece na cobrança.
          </p>
        </aside>}
      </main>
      {pageFooter}
      {selectedService ? (
        <React.Suspense fallback={null}>
        <PolicySheet
          open={policySheet.open}
          businessName={business.name}
          serviceName={selectedService.name}
          depositLabel={formatCurrency(selectedService.depositCents)}
          lines={selectedService.policyDetails}
          text={selectedService.policySummary}
          notice={policySheet.notice}
          returnFocus={policySheet.trigger}
          onClose={() => setPolicySheet((current) => ({ ...current, open: false, trigger: null }))}
        />
        </React.Suspense>
      ) : null}
    </div>
  );
}
