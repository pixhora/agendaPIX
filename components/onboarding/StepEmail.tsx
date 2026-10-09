"use client";

import { useState } from "react";
import Link from "next/link";
import { FieldError } from "@/components/ui/field";
import { applyEmailDomain, INVALID_EMAIL_MESSAGE, isValidEmail, suggestEmailDomain } from "@/lib/onboarding/email-hint";
import { waitMinutesMessage } from "@/lib/onboarding/flow";
import { StepActions } from "./chrome";
import { StepHeader, stepBodyClass } from "./parts";

export type EmailAlert =
  | { kind: "invalid" }
  | { kind: "rate"; minutes: number | null }
  | { kind: "draft" }
  | { kind: "otp" }
  | { kind: "offline" }
  | { kind: "generic" }
  | { kind: "validation"; message: string }
  | { kind: "expired" }
  | { kind: "not_found" }
  | null;

function alertText(alert: EmailAlert): string | null {
  if (!alert || alert.kind === "invalid") return null;
  if (alert.kind === "rate") return waitMinutesMessage(alert.minutes);
  if (alert.kind === "draft") return "Não conseguimos guardar seu cadastro agora. Tente de novo em instantes.";
  if (alert.kind === "otp") return "Seu cadastro está guardado, mas o e-mail não saiu. Tente reenviar.";
  if (alert.kind === "offline") return "Sem internet. Seus dados estão salvos neste aparelho. Quando a conexão voltar, toque em Enviar código.";
  if (alert.kind === "expired") return "Seu cadastro guardado venceu, mas os dados ainda estão neste aparelho.";
  if (alert.kind === "not_found") return "Não encontramos o cadastro guardado. Toque em Enviar código de novo.";
  if (alert.kind === "validation") return alert.message;
  return "Algo deu errado do nosso lado. Seus dados estão guardados; tente de novo.";
}

export function StepEmail({
  email,
  onChangeEmail,
  pending,
  alert,
  replacesPreviousCode = false,
  legalPagesPublished,
  onBack,
  onSubmit,
}: {
  email: string;
  onChangeEmail: (value: string) => void;
  pending: boolean;
  alert: EmailAlert;
  replacesPreviousCode?: boolean;
  legalPagesPublished: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [blurred, setBlurred] = useState(false);
  const suggestion = suggestEmailDomain(email);
  const invalid = (blurred || alert?.kind === "invalid") && !isValidEmail(email);
  const message = alertText(alert);
  const retryLabel = alert?.kind === "otp" ? "Reenviar código" : alert?.kind === "draft" ? "Tentar de novo" : null;

  return (
    <form
      className="flex flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setBlurred(true);
        if (pending) return;
        onSubmit();
      }}
    >
      <div className={stepBodyClass}>
        <StepHeader title="Para onde mandamos seu código?" description="Você usa esse e-mail para entrar no painel. Sem senha." />
        <div className="grid gap-1.5">
          <label htmlFor="onboarding-email" className="text-sm font-semibold">E-mail</label>
          <input
            id="onboarding-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            readOnly={pending}
            value={email}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? "onboarding-email-error" : undefined}
            onBlur={() => setBlurred(true)}
            onChange={(event) => onChangeEmail(event.target.value)}
            className="onb-control min-h-12 w-full rounded-field border border-line-strong/60 bg-surface px-3.5 text-base text-ink aria-invalid:border-danger"
          />
          <FieldError id="onboarding-email-error">{invalid ? INVALID_EMAIL_MESSAGE : null}</FieldError>
          {replacesPreviousCode ? (
            <p className="text-sm text-muted">O código anterior deixa de valer. Toque em Enviar código para receber outro.</p>
          ) : null}
          {suggestion ? (
            <p className="text-sm text-muted">
              Você quis dizer {suggestion}?{" "}
              <button
                type="button"
                onClick={() => onChangeEmail(applyEmailDomain(email, suggestion))}
                className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Corrigir
              </button>
            </p>
          ) : null}
        </div>
        {message ? (
          <div role="alert" className="space-y-2 rounded-field border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger">
            <p>{message}</p>
            {retryLabel ? (
              <button type="submit" className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline">
                {retryLabel}
              </button>
            ) : null}
          </div>
        ) : null}
        {legalPagesPublished ? (
          <p className="text-sm text-muted">
            Ao continuar, você concorda com os{" "}
            <Link href="/termos" className="font-semibold text-ink underline-offset-4 hover:underline">Termos de uso</Link>
            {" "}e a{" "}
            <Link href="/privacidade" className="font-semibold text-ink underline-offset-4 hover:underline">Política de privacidade</Link>.
          </p>
        ) : null}
      </div>
      <StepActions
        onBack={onBack}
        submitLabel={pending ? "Enviando…" : "Enviar código"}
        pending={pending}
        disabled={!isValidEmail(email)}
        onInvalid={() => {
          setBlurred(true);
          document.getElementById("onboarding-email")?.focus();
        }}
      />
    </form>
  );
}
