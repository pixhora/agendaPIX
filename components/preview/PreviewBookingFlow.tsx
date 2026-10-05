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
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PreviewBookingFlow() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isCompleted, setIsCompleted] = useState(false);

  const [selectedService, setSelectedService] = useState<PublicService | null>(
    MOCK_SERVICES[0] // Corte feminino R$ 80,00 60min
  );
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const slots = getMockAvailabilitySlots(today);
    return slots[0] || null;
  });
  const [customerName, setCustomerName] = useState("Juliana Mendes");
  const [customerPhone, setCustomerPhone] = useState("(11) 98234-5678");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResponse, setBookingResponse] = useState<BookingResponse | null>(null);

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
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // QR Code em SVG/DataURL determinístico para o preview
    const sampleQr =
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='white'/><rect x='10' y='10' width='30' height='30' fill='black'/><rect x='60' y='10' width='30' height='30' fill='black'/><rect x='10' y='60' width='30' height='30' fill='black'/><rect x='20' y='20' width='10' height='10' fill='white'/><rect x='70' y='20' width='10' height='10' fill='white'/><rect x='20' y='70' width='10' height='10' fill='white'/><rect x='45' y='45' width='10' height='10' fill='black'/><rect x='65' y='65' width='15' height='15' fill='black'/></svg>";

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
        qrCodeDataUrl: sampleQr,
        copyPaste: `00020126580014br.gov.bcb.pix0136studio-bella-preview-${selectedService.id}520400005303986540${(
          selectedService.depositCents / 100
        ).toFixed(2)}5802BR5912Studio Bella6009Sao Paulo62070503***6304PREV`,
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

  return (
    <div className="min-h-screen bg-background text-foreground pt-6 pb-24 sm:py-8 px-4 sm:px-6">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Barra Superior do Preview */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
          <Link href="/preview" className="font-bold text-pix dark:text-primary hover:underline">
            ← Voltar ao Hub Preview
          </Link>
          <span className="rounded-full bg-subtle border border-border px-2.5 py-0.5 text-[10px] font-mono font-semibold">
            {MOCK_PUBLIC_BUSINESS.name}
          </span>
        </div>

        {/* Cabeçalho do Estabelecimento */}
        <header className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-primary font-display font-extrabold text-lg shadow-xs ring-2 ring-primary/20">
            SB
          </div>
          <div className="space-y-0.5">
            <h1 className="font-display text-2xl font-extrabold text-foreground tracking-tight">
              {MOCK_PUBLIC_BUSINESS.name}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              São Paulo, SP · Agendamento com sinal Pix garantido
            </p>
          </div>
        </header>

        {isCompleted && selectedService && selectedSlot ? (
          <div className="rounded-3xl border border-border bg-surface p-6 sm:p-7 shadow-sm">
            <BookingConfirmation
              businessName={MOCK_PUBLIC_BUSINESS.name}
              service={selectedService}
              slot={selectedSlot}
              timezone={MOCK_PUBLIC_BUSINESS.timezone}
              customerName={customerName}
              customerPhone={customerPhone}
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
                  services={MOCK_SERVICES}
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
                  onBack={() => setStep(2)}
                  onSubmit={handleCreateMockBooking}
                />
              )}

              {step === 4 && bookingResponse && (
                <div className="space-y-4">
                  <StepPayment
                    slug="studio-bella"
                    booking={bookingResponse}
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

                  {/* Atalho de Demonstração para Confirmar o Pix Imediatamente */}
                  <div className="rounded-xl border border-success/30 bg-success-soft p-3 text-center space-y-2">
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
                  </div>
                </div>
              )}
            </div>

            <footer className="text-center text-[11px] text-muted-foreground pt-1">
              <span>🔒 Ambiente de Preview determinístico com dados locais.</span>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
