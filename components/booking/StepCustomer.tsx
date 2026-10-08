"use client";

import React, { useState } from "react";
import type { PublicService, AvailabilitySlot } from "./types";
import { formatCurrency, formatCpfMask, formatPhoneMask, isValidBrazilianPhone, isValidCpf } from "./formatters";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { CUSTOMER_FIELD_ICONS } from "@/lib/icons/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FieldHint } from "@/components/ui/field";
import { BookingSummary } from "./BookingSummary";
import { PolicySummaryLine } from "@/components/policy/PolicySummaryLine";
import { POLICY_MISSING_MESSAGE } from "./booking-error";
import { policyLineTone, servicePolicyState } from "./policy-gate";

interface StepCustomerProps {
  service: PublicService;
  slot: AvailabilitySlot;
  timezone: string;
  name: string;
  phone: string;
  cpf: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  errorContactHref?: string | null;
  /** `calm` para o estabelecimento pausado: o cliente não errou o preenchimento. */
  errorTone?: "danger" | "calm";
  onChangeName: (name: string) => void;
  onChangePhone: (phone: string) => void;
  onChangeCpf: (cpf: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  /** `false`: esconde o CPF. Ausente: o campo continua, a API atual ainda pede o documento. */
  requiresPayerCpf?: boolean;
  onOpenPolicy?: (trigger: HTMLElement) => void;
  /** Classes do resumo (ex.: `lg:hidden` quando a página já mostra o resumo ao lado). */
  summaryClassName?: string;
}

export function StepCustomer({
  service,
  slot,
  timezone,
  name,
  phone,
  cpf,
  isSubmitting,
  errorMessage,
  errorContactHref,
  errorTone = "danger",
  onChangeName,
  onChangePhone,
  onChangeCpf,
  onBack,
  onSubmit,
  summaryClassName,
  requiresPayerCpf,
  onOpenPolicy,
}: StepCustomerProps) {
  const [touched, setTouched] = useState({ name: false, phone: false, cpf: false });
  const askCpf = requiresPayerCpf !== false;
  const policyState = servicePolicyState(service);
  const policyBlocked = policyState === "missing";

  const isNameValid = name.trim().length >= 2;
  const isPhoneValid = isValidBrazilianPhone(phone);
  const isCpfValid = !askCpf || isValidCpf(cpf);
  const canSubmit = isNameValid && isPhoneValid && isCpfValid && !isSubmitting && !policyBlocked;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangePhone(formatPhoneMask(e.target.value));
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeCpf(formatCpfMask(e.target.value));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, phone: true, cpf: true });
    if (canSubmit) {
      onSubmit();
    }
  };

  const nameError = touched.name && !isNameValid ? "Informe seu nome (pelo menos 2 letras)." : null;
  const phoneError = touched.phone && !isPhoneValid ? "Informe um celular válido com DDD, por exemplo (11) 98765-4321." : null;
  const cpfError = touched.cpf && !isCpfValid ? "Informe um CPF válido." : null;

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6" noValidate>
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Seus dados para contato</h2>
        <p className="mt-1 text-sm text-muted">
          {askCpf ? "Nome, WhatsApp e CPF. Sem cadastro e sem senha." : "Nome e WhatsApp. Sem cadastro e sem senha."}
        </p>
      </div>

      <BookingSummary service={service} slot={slot} timezone={timezone} variant="plain" className={summaryClassName} headingLevel="h3" />

      {policyState === "ready" && service.policySummary && onOpenPolicy ? (
        <PolicySummaryLine
          summary={service.policySummary}
          tone={policyLineTone(service.depositPolicy, slot.startsAt)}
          onDetails={onOpenPolicy}
        />
      ) : null}
      {policyBlocked ? <p role="alert" className="text-sm font-medium text-danger">{POLICY_MISSING_MESSAGE}</p> : null}

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="customer-name">Seu nome</Label>
          <div className="relative">
            <Icon icon={CUSTOMER_FIELD_ICONS.name} className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
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
              className="pl-10"
            />
          </div>
          <FieldError id="name-error">{nameError}</FieldError>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-phone">WhatsApp</Label>
          <div className="relative">
            <Icon icon={CUSTOMER_FIELD_ICONS.whatsapp} className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
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

        {askCpf ? <div className="space-y-2">
          <Label htmlFor="customer-cpf">CPF</Label>
          <div className="relative">
            <Icon icon={CUSTOMER_FIELD_ICONS.cpf} className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              id="customer-cpf"
              type="text"
              inputMode="numeric"
              required
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={handleCpfChange}
              onBlur={() => setTouched((prev) => ({ ...prev, cpf: true }))}
              aria-invalid={cpfError ? true : undefined}
              aria-describedby={cpfError ? "cpf-error cpf-hint" : "cpf-hint"}
              className="pl-10"
            />
          </div>
          <FieldHint id="cpf-hint">Exigido para emitir a cobrança Pix em seu nome.</FieldHint>
          <FieldError id="cpf-error">{cpfError}</FieldError>
        </div> : null}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className={
            errorTone === "calm"
              ? "space-y-3 rounded-card border border-line bg-subtle p-4 text-sm text-ink"
              : "space-y-3 rounded-card border border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger"
          }
        >
          <p>{errorMessage}</p>
          {errorContactHref ? (
            <a
              href={errorContactHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-line-strong underline-offset-4"
            >
              Falar no WhatsApp
            </a>
          ) : null}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onBack} className="sm:-ml-3">
          <ArrowLeft aria-hidden="true" /> Voltar
        </Button>
        <Button type="submit" size="lg" variant={service.depositCents > 0 ? "pix" : "default"} disabled={isSubmitting || policyBlocked} aria-busy={isSubmitting || undefined} className="w-full sm:w-auto">
          {isSubmitting ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : service.depositCents > 0 ? <Lock aria-hidden="true" /> : null}
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
