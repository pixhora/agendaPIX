import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, MailCheck, TriangleAlert } from "lucide-react";
import type { OnboardingData } from "./types";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field";
import { requestMagicLink } from "@/lib/magic-link";
import { ONBOARDING_COMPLETE_PATH, ensureOnboardingIdempotencyKey } from "./storage";
import { StepActions, StepHeader, usePublicHost } from "./parts";

interface StepAccountProps {
  data: OnboardingData;
  email: string;
  onChangeEmail: (email: string) => void;
  onBack: () => void;
  onComplete: () => void;
}

export function StepAccount({ data, email, onChangeEmail, onBack, onComplete }: StepAccountProps) {
  const host = usePublicHost();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [wasSimulated, setWasSimulated] = useState(false);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (isSent) sentHeadingRef.current?.focus();
  }, [isSent]);

  const handleStartTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    // Garante uma Idempotency-Key estável para o provisionamento feito após o login
    // (/onboarding/concluir reaproveita a mesma chave em novas tentativas).
    ensureOnboardingIdempotencyKey();

    const result = await requestMagicLink(email.trim(), undefined, ONBOARDING_COMPLETE_PATH);

    if (result.ok) {
      setWasSimulated(!!result.simulated);
      setIsSent(true);
      onComplete();
    } else {
      setErrorMessage(result.message);
    }

    setIsSubmitting(false);
  };

  if (isSent) {
    return (
      <div className="space-y-6">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-pix-soft text-pix">
          <MailCheck className="size-7" />
        </span>
        <div className="space-y-2">
          <h1 ref={sentHeadingRef} tabIndex={-1} className="font-display text-2xl font-extrabold tracking-tight outline-none sm:text-3xl">Verifique seu e-mail</h1>
          <p className="text-muted">
            Enviamos o link de acesso para <span className="break-all font-semibold text-ink">{email}</span>.
          </p>
        </div>
        <ol className="grid gap-3 rounded-card border border-line bg-subtle/60 p-4 text-sm">
          <li className="flex gap-3"><span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">1</span>Abra o e-mail e toque em <strong>Entrar</strong>, neste mesmo navegador.</li>
          <li className="flex gap-3"><span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">2</span><span>Sua página <strong className="break-all">{host}/{data.slug}</strong> entra no ar na hora.</span></li>
        </ol>

        {wasSimulated && (
          <div className="flex gap-2 rounded-field border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p><span className="font-semibold">Modo de desenvolvimento: envio simulado.</span> Nenhum e-mail foi disparado; configure o SMTP no servidor para envio real.</p>
          </div>
        )}

        <Button type="button" variant="outline" onClick={() => setIsSent(false)} className="w-full">
          <ArrowLeft aria-hidden="true" />Usar outro e-mail
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleStartTrial} noValidate className="space-y-6">
      <StepHeader title="Falta só o seu e-mail" description="Enviamos um link de acesso, sem senha. Ao entrar, sua agenda fica no ar." />

      <dl className="divide-y divide-line rounded-card border border-line text-sm">
        <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">Negócio</dt><dd className="text-right font-semibold">{data.businessName}</dd></div>
        <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">Link</dt><dd className="min-w-0 break-all text-right font-semibold">{host}/{data.slug}</dd></div>
        <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">Serviço</dt><dd className="text-right font-semibold">{data.serviceName} · {formatDuration(data.durationMinutes)} · <span className="tabular-nums">{formatCurrency(data.priceCents)}</span></dd></div>
        <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">Sinal no Pix</dt><dd className="text-right font-semibold tabular-nums text-pix">{data.depositCents > 0 ? formatCurrency(data.depositCents) : "Sem sinal"}</dd></div>
      </dl>

      <div className="grid gap-1.5">
        <label htmlFor="account-email" className="text-sm font-semibold">Seu e-mail profissional</label>
        <Input
          id="account-email"
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errorMessage ? "true" : undefined}
          aria-describedby={errorMessage ? "account-email-error" : undefined}
          placeholder="voce@seunegocio.com.br"
          value={email}
          onChange={(e) => onChangeEmail(e.target.value)}
        />
        <FieldError id="account-email-error">{errorMessage}</FieldError>
      </div>

      <ul className="grid gap-1.5 text-sm text-muted">
        <li className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-success" />7 dias grátis do plano {data.plan === "completo" ? "Completo" : "Base"}</li>
        <li className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-success" />Sem cartão de crédito</li>
      </ul>

      <StepActions onBack={onBack} backDisabled={isSubmitting} submitLabel={isSubmitting ? "Enviando link…" : "Ativar minha agenda grátis"} disabled={!isEmailValid || isSubmitting} />
    </form>
  );
}
