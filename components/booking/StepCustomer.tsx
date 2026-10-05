"use client";

import React, { useState } from "react";
import type { PublicService, AvailabilitySlot } from "./types";
import { formatCurrency, formatPhoneMask, isValidBrazilianPhone } from "./formatters";
import { ArrowLeft, Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FieldHint } from "@/components/ui/field";
import { BookingSummary } from "./BookingSummary";

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
  /** Classes do resumo (ex.: `lg:hidden` quando a página já mostra o resumo ao lado). */
  summaryClassName?: string;
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
  summaryClassName,
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

  const nameError = touched.name && !isNameValid ? "Informe seu nome (pelo menos 2 letras)." : null;
  const phoneError = touched.phone && !isPhoneValid ? "Informe um celular válido com DDD, por exemplo (11) 98765-4321." : null;

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6" noValidate>
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Seus dados para contato</h2>
        <p className="mt-1 text-sm text-muted">Só nome e WhatsApp. Sem cadastro e sem senha.</p>
      </div>

      <BookingSummary service={service} slot={slot} timezone={timezone} variant="plain" className={summaryClassName} headingLevel="h3" />

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="customer-name">Seu nome</Label>
          <Input
            id="customer-name"
            required
            autoComplete="name"
            placeholder="Como podemos te chamar?"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "name-error" : undefined}
          />
          <FieldError id="name-error">{nameError}</FieldError>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-phone">WhatsApp</Label>
          <div className="relative">
            <MessageCircle aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              id="customer-phone"
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
              placeholder="(11) 98765-4321"
              value={phone}
              onChange={handlePhoneChange}
              onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={phoneError ? "phone-error phone-hint" : "phone-hint"}
              className="pl-10"
            />
          </div>
          <FieldHint id="phone-hint">Usado só para lembrar você do horário.</FieldHint>
          <FieldError id="phone-error">{phoneError}</FieldError>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onBack} className="sm:-ml-3">
          <ArrowLeft aria-hidden="true" /> Voltar
        </Button>
        <Button type="submit" size="lg" variant={service.depositCents > 0 ? "pix" : "default"} disabled={isSubmitting} className="w-full sm:w-auto">
          {service.depositCents > 0 && <Lock aria-hidden="true" />}
          {isSubmitting
            ? "Gerando Pix…"
            : service.depositCents > 0
              ? `Gerar Pix de ${formatCurrency(service.depositCents)}`
              : "Confirmar agendamento"}
        </Button>
      </div>
    </form>
  );
}
