"use client";

import React, { useState } from "react";
import type {
  PublicService,
  AvailabilitySlot,
  BookingResponse,
  PaymentStatusResponse,
} from "@/components/booking/types";
import {
  MOCK_PUBLIC_BUSINESS,
  MOCK_SERVICES,
  getMockAvailabilitySlots,
} from "@/lib/preview/mock-data";
import { StepProgress } from "@/components/booking/StepProgress";
import { StepService } from "@/components/booking/StepService";
import { StepCustomer } from "@/components/booking/StepCustomer";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";
import { StepSlot } from "@/components/booking/StepSlot";
import { StepPayment } from "@/components/booking/StepPayment";
import { PausedState } from "@/components/booking/PausedState";
import { POLICY_CHANGED_MESSAGE } from "@/components/booking/booking-error";
import { formatCurrency } from "@/components/booking/formatters";
import type { BookingPolicyView } from "@/components/booking/types";
import { PolicySheet } from "@/components/policy/PolicySheet";
import type { PreviewScene } from "@/components/preview/scene";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BusinessAvatar } from "@/components/ui/business-avatar";
import { PREVIEW_PIX_COPY_PASTE, PREVIEW_PIX_QR } from "@/lib/preview/sample-pix-qr";
import { PIX_HOLD_MS, previewLateSlot, previewOpeningSlot, previewPayDeadline } from "@/lib/preview/preview-schedule";
import { mirrorCustomerPolicy } from "@/components/booking/policy-copy";

/** Frase de comprovante da reserva em cima da hora. A variante de crédito ainda não está na spec 06. */
const LATE_BOOKING_POLICY_TEXT = "Este sinal não é devolvido se cancelar.";

function previewStep(scene: PreviewScene): 1 | 2 | 3 | 4 {
  if (scene === "dados" || scene === "politica" || scene === "politica-mudou") return 3;
  if (scene === "pix" || scene === "pix-perto" || scene === "pix-expirado") return 4;
  return 1;
}

function previewBooking(scene: PreviewScene, service: PublicService, slot: AvailabilitySlot): BookingResponse {
  const expiresAt = previewPayDeadline(scene === "pix-perto" || scene === "pix-expirado" ? scene : "pix").toISOString();
  const expired = scene === "pix-expirado";
  return {
    bookingId: "bk-preview-pix",
    status: expired ? "expired" : "pending_payment",
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    expiresAt,
    accessToken: "mock-preview-token-12345",
    payment: {
      id: "pay-preview",
      provider: "fake",
      externalId: "fake_charge_preview",
      amountCents: service.depositCents,
      status: expired ? "expired" : "pending",
      expiresAt,
      qrCodeDataUrl: expired ? null : PREVIEW_PIX_QR,
      copyPaste: expired ? null : PREVIEW_PIX_COPY_PASTE,
    },
  };
}

function previewPolicy(slot: AvailabilitySlot, lateBooking: boolean): BookingPolicyView {
  if (lateBooking) return { text: LATE_BOOKING_POLICY_TEXT };
  const deadline = new Date(new Date(slot.startsAt).getTime() - 24 * 60 * 60 * 1000).toISOString();
  return {
    refundDeadlineAt: deadline,
    rescheduleDeadlineAt: deadline,
  };
}

export function PreviewBookingFlow({ scene = "fluxo" }: { scene?: PreviewScene }) {
  const openingSlot = scene === "cima-da-hora" ? previewLateSlot() : previewOpeningSlot();
  const previewServices = MOCK_SERVICES.map((service, index) => {
    if (index !== 0 || !openingSlot) return service;
    const mirrored = mirrorCustomerPolicy({
      businessName: MOCK_PUBLIC_BUSINESS.name,
      hours: 24,
      startsAt: new Date(openingSlot.startsAt),
      hasContact: true,
    });
    return {
      ...service,
      policySummary: mirrored.summary,
      policyDetails: mirrored.details,
    };
  });
  const services = scene === "indisponivel"
    ? [
        ...previewServices.map((service) => (service.depositCents > 0 ? { ...service, bookable: false } : service)),
        { id: "srv-sem-sinal", name: "Ajuste de franja", durationMinutes: 20, priceCents: 3000, depositCents: 0, bookable: false },
      ]
    : previewServices;
  const contactWhatsapp = scene === "indisponivel" || scene === "pausada" ? "5511987654321" : null;
  const openingService = services.find((service) => service.bookable !== false) ?? services[0];
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => previewStep(scene));
  const lateBooking = scene === "cima-da-hora";
  const [isCompleted, setIsCompleted] = useState(scene === "comprovante" || lateBooking);

  const [selectedService, setSelectedService] = useState<PublicService | null>(openingService);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(openingSlot);
  const [customerName, setCustomerName] = useState("Juliana Mendes");
  const [customerPhone, setCustomerPhone] = useState("(11) 98234-5678");
  const [customerCpf, setCustomerCpf] = useState("529.982.247-25");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(scene === "politica" || scene === "politica-mudou");
  const [bookingResponse, setBookingResponse] = useState<BookingResponse | null>(() => {
    if (!openingSlot || (scene !== "pix" && scene !== "pix-perto" && scene !== "pix-expirado")) return null;
    return previewBooking(scene, openingService, openingSlot);
  });

  const handleGetSlots = React.useCallback(
    async (dateStr: string) => {
      const duration = selectedService?.durationMinutes ?? 60;
      return getMockAvailabilitySlots(dateStr, duration);
    },
    [selectedService?.durationMinutes]
  );

  const handleCreateMockBooking = async () => {
    if (!selectedService || !selectedSlot) return;

    setIsSubmitting(true);

    // Simula pequena latência de rede realista
    await new Promise((resolve) => setTimeout(resolve, 400));

    const mockBookingId = `bk-preview-${Date.now()}`;
    const expiresAt = new Date(Date.now() + PIX_HOLD_MS).toISOString();

    const mockResponse: BookingResponse = {
      bookingId: mockBookingId,
      status: "pending_payment",
      startsAt: selectedSlot.startsAt,
      endsAt: selectedSlot.endsAt,
      expiresAt,
      accessToken: "mock-preview-token-12345",
      payment: {
        id: `pay-preview-${Date.now()}`,
        provider: "fake",
        externalId: `fake_charge_${Date.now()}`,
        amountCents: selectedService.depositCents,
        status: "pending",
        expiresAt,
        qrCodeDataUrl: PREVIEW_PIX_QR,
        copyPaste: PREVIEW_PIX_COPY_PASTE,
      },
    };

    setBookingResponse(mockResponse);
    setIsSubmitting(false);

    if (selectedService.depositCents === 0) {
      setIsCompleted(true);
    } else {
      setStep(4);
    }
  };

  const handleRestart = () => {
    setSelectedService(MOCK_SERVICES[0]);
    setSelectedSlot(null);
    setCustomerName("");
    setCustomerPhone("");
    setBookingResponse(null);
    setIsCompleted(false);
    setStep(1);
  };

  const businessHeader = (
    <header className="flex flex-col items-center space-y-2 text-center">
      <BusinessAvatar name={MOCK_PUBLIC_BUSINESS.name} logoUrl={MOCK_PUBLIC_BUSINESS.logoUrl} size="lg" className="shadow-xs ring-2 ring-pix/20" />
      <div className="space-y-0.5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          {MOCK_PUBLIC_BUSINESS.name}
        </h1>
        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
          São Paulo, SP · Agendamento com sinal Pix garantido
        </p>
      </div>
    </header>
  );

  if (scene === "pausada") {
    return (
      <div data-scene={scene} className="min-h-screen bg-background px-4 pb-24 pt-6 text-foreground sm:py-8 sm:px-6">
        <div className="mx-auto w-full max-w-[560px] space-y-6">
          {businessHeader}
          <PausedState businessName={MOCK_PUBLIC_BUSINESS.name} contactWhatsapp={contactWhatsapp} services={MOCK_SERVICES} />
        </div>
      </div>
    );
  }

  return (
    <div data-scene={scene} className="min-h-screen bg-background text-foreground pt-6 pb-24 sm:py-8 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-[560px] space-y-6">
        {/* Barra Superior do Preview */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
          <Link href="/preview" className="font-bold text-pix dark:text-primary hover:underline">
            ← Voltar ao Hub Preview
          </Link>
          <span className="rounded-full bg-subtle border border-border px-2.5 py-0.5 text-[10px] font-mono font-semibold">
            {MOCK_PUBLIC_BUSINESS.name}
          </span>
        </div>

        {businessHeader}

        {isCompleted && selectedService && selectedSlot ? (
          <div className="rounded-3xl border border-border bg-surface p-6 sm:p-7 shadow-sm">
            <BookingConfirmation
              businessName={MOCK_PUBLIC_BUSINESS.name}
              service={selectedService}
              slot={selectedSlot}
              timezone={MOCK_PUBLIC_BUSINESS.timezone}
              customerName={customerName}
              customerPhone={customerPhone}
              policy={previewPolicy(selectedSlot, lateBooking)}
              lateBooking={lateBooking}
              onNewBooking={handleRestart}
            />
          </div>
        ) : (
          <>
            <StepProgress currentStep={step} />

            <div
              key={step}
              className="rounded-3xl border border-border bg-surface p-5 sm:p-7 shadow-sm animate-step-in"
            >
              {step === 1 && (
                <StepService
                  services={services}
                  contactWhatsapp={contactWhatsapp}
                  selectedServiceId={selectedService?.id ?? null}
                  onSelectService={(srv) => {
                    setSelectedService(srv);
                  }}
                  onNext={() => setStep(2)}
                />
              )}

              {step === 2 && selectedService && (
                <StepSlot
                  slug="studio-bella"
                  service={selectedService}
                  timezone={MOCK_PUBLIC_BUSINESS.timezone}
                  selectedStartsAt={selectedSlot?.startsAt ?? null}
                  getSlotsForDate={handleGetSlots}
                  onSelectSlot={(slot) => setSelectedSlot(slot)}
                  onBack={() => setStep(1)}
                  onNext={() => setStep(3)}
                />
              )}

              {step === 3 && selectedService && selectedSlot && (
                <StepCustomer
                  service={selectedService}
                  slot={selectedSlot}
                  timezone={MOCK_PUBLIC_BUSINESS.timezone}
                  name={customerName}
                  phone={customerPhone}
                  isSubmitting={isSubmitting}
                  errorMessage={null}
                  onChangeName={setCustomerName}
                  onChangePhone={setCustomerPhone}
                  cpf={customerCpf}
                  onChangeCpf={setCustomerCpf}
                  onBack={() => setStep(2)}
                  onSubmit={handleCreateMockBooking}
                  requiresPayerCpf={scene === "fluxo" ? undefined : false}
                  onOpenPolicy={() => setPolicyOpen(true)}
                />
              )}

              {step === 4 && bookingResponse && (
                <div className="space-y-4">
                  <StepPayment
                    slug="studio-bella"
                    booking={bookingResponse}
                    summary={selectedService && selectedSlot ? { service: selectedService, slot: selectedSlot, timezone: MOCK_PUBLIC_BUSINESS.timezone } : undefined}
                    pixRecipientDisplayName="Studio Bella"
                    onOpenPolicy={() => setPolicyOpen(true)}
                    checkStatusFn={async () => {
                      if (bookingResponse.status === "confirmed") {
                        return {
                          bookingId: bookingResponse.bookingId,
                          status: "confirmed",
                          expiresAt: null,
                          payment: {
                            ...bookingResponse.payment!,
                            status: "paid",
                          },
                        };
                      }
                      return null;
                    }}
                    onPaymentConfirmed={() => {
                      setIsCompleted(true);
                    }}
                    onRestart={handleRestart}
                  />

                  {scene === "fluxo" ? <div className="rounded-xl border border-success/30 bg-success-soft p-3 text-center space-y-2">
                    <p className="text-xs font-semibold text-success ">
                      Simulador de Pagamento Instantâneo (Preview)
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        const updated: PaymentStatusResponse = {
                          bookingId: bookingResponse.bookingId,
                          status: "confirmed",
                          expiresAt: null,
                          payment: {
                            ...bookingResponse.payment!,
                            status: "paid",
                          },
                        };
                        setBookingResponse((prev) =>
                          prev
                            ? {
                                ...prev,
                                status: "confirmed",
                                payment: updated.payment,
                              }
                            : null
                        );
                        setIsCompleted(true);
                      }}
                      className="w-full bg-success hover:bg-ink-hover text-white min-h-11 text-xs font-bold shadow-sm cursor-pointer"
                    >
                      ⚡ Simular Pix Pago no Banco
                    </Button>
                  </div> : null}
                </div>
              )}
            </div>

            <footer className="text-center text-[11px] text-muted-foreground pt-1">
              <span>🔒 Ambiente de Preview determinístico com dados locais.</span>
            </footer>
          </>
        )}
      </div>
      {selectedService ? (
        <PolicySheet
          open={policyOpen}
          businessName={MOCK_PUBLIC_BUSINESS.name}
          serviceName={selectedService.name}
          depositLabel={formatCurrency(selectedService.depositCents)}
          lines={selectedService.policyDetails}
          text={selectedService.policySummary}
          notice={scene === "politica-mudou" ? POLICY_CHANGED_MESSAGE : null}
          onClose={() => setPolicyOpen(false)}
        />
      ) : null}
    </div>
  );
}
