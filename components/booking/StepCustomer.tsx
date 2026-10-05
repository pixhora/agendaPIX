"use client";

import React, { useState } from "react";
import type { PublicService, AvailabilitySlot } from "./types";
import {
  formatCurrency,
  formatDuration,
  formatPhoneMask,
  formatTimeSlot,
  formatDateFull,
  isValidBrazilianPhone,
} from "./formatters";
import { Button } from "@/components/ui/button";

interface StepCustomerProps {
  service: PublicService;
  slot: AvailabilitySlot;
  timezone: string;
  name: string;
  phone: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onChangeName: (name: string) => void;
  onChangePhone: (phone: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function StepCustomer({
  service,
  slot,
  timezone,
  name,
  phone,
  isSubmitting,
  errorMessage,
  onChangeName,
  onChangePhone,
  onBack,
  onSubmit,
}: StepCustomerProps) {
  const [touched, setTouched] = useState({ name: false, phone: false });

  const isNameValid = name.trim().length >= 2;
  const isPhoneValid = isValidBrazilianPhone(phone);
  const canSubmit = isNameValid && isPhoneValid && !isSubmitting;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = formatPhoneMask(e.target.value);
    onChangePhone(masked);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, phone: true });
    if (canSubmit) {
      onSubmit();
    }
  };

  const remainingCents = Math.max(0, service.priceCents - service.depositCents);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-5" noValidate>
      <div>
        <h2 className="text-xl font-semibold text-foreground">Seus dados para contato</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Informe seu nome e WhatsApp para confirmar a reserva.
        </p>
      </div>

      {/* Resumo do Horário Selecionado */}
      <section
        aria-label="Resumo do agendamento"
        className="rounded-xl border border-border bg-surface p-4 space-y-2.5 text-sm"
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold text-foreground">{service.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              ⏱ {formatDuration(service.durationMinutes)} de atendimento
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-foreground">{formatCurrency(service.priceCents)}</p>
            <p className="text-xs text-muted-foreground">Valor total</p>
          </div>
        </div>

        <div className="border-t border-border pt-2 text-xs text-muted-foreground space-y-1">
          <p>
            📅 <span className="font-medium text-foreground capitalize">{formatDateFull(slot.startsAt, timezone)}</span>
          </p>
          <p>
            ⏰ Horário: <span className="font-semibold text-foreground">{formatTimeSlot(slot.startsAt, timezone)}</span>
          </p>
        </div>

        {service.depositCents > 0 && (
          <div className="border-t border-border pt-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-primary">Sinal no Pix agora:</span>
            <span className="font-bold text-primary text-sm">{formatCurrency(service.depositCents)}</span>
          </div>
        )}
        {remainingCents > 0 && service.depositCents > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Restante a pagar no local:</span>
            <span>{formatCurrency(remainingCents)}</span>
          </div>
        )}
      </section>

      {/* Campos de Entrada */}
      <div className="space-y-4">
        <div>
          <label htmlFor="customer-name" className="block text-sm font-medium text-foreground mb-1.5">
            Nome completo
          </label>
          <input
            id="customer-name"
            type="text"
            required
            autoComplete="name"
            placeholder="Como gostaria de ser chamado?"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            aria-invalid={touched.name && !isNameValid}
            aria-describedby={touched.name && !isNameValid ? "name-error" : undefined}
            className={`w-full rounded-xl border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              touched.name && !isNameValid ? "border-destructive ring-1 ring-destructive" : "border-border"
            }`}
          />
          {touched.name && !isNameValid && (
            <p id="name-error" className="mt-1 text-xs text-destructive">
              Por favor, informe seu nome (pelo menos 2 caracteres).
            </p>
          )}
        </div>

        <div>
          <label htmlFor="customer-phone" className="block text-sm font-medium text-foreground mb-1.5">
            WhatsApp para confirmação
          </label>
          <input
            id="customer-phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            placeholder="(11) 98765-4321"
            value={phone}
            onChange={handlePhoneChange}
            onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
            aria-invalid={touched.phone && !isPhoneValid}
            aria-describedby={touched.phone && !isPhoneValid ? "phone-error" : undefined}
            className={`w-full rounded-xl border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              touched.phone && !isPhoneValid ? "border-destructive ring-1 ring-destructive" : "border-border"
            }`}
          />
          {touched.phone && !isPhoneValid && (
            <p id="phone-error" className="mt-1 text-xs text-destructive">
              Informe um número de celular válido com DDD (ex: 11 99999-9999).
            </p>
          )}
        </div>
      </div>

      {/* Erro Geral do Servidor */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {/* Ações Voltar / Confirmar */}
      <div className="flex items-center gap-3 pt-3 border-t border-border/60">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onBack}
          className="flex-1 min-h-12 rounded-full font-semibold"
        >
          Voltar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-[2] min-h-12 rounded-full font-bold shadow-xs"
        >
          {isSubmitting
            ? "Processando..."
            : service.depositCents > 0
            ? `Pagar sinal de ${formatCurrency(service.depositCents)}`
            : "Confirmar agendamento"}
        </Button>
      </div>
    </form>
  );
}
