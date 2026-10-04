import React, { useState } from "react";
import type { OnboardingData } from "./types";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";
import { Button } from "@/components/ui/button";

interface StepAccountProps {
  data: OnboardingData;
  email: string;
  onChangeEmail: (email: string) => void;
  onBack: () => void;
  onComplete: () => void;
}

import { requestMagicLink } from "@/lib/magic-link";

export function StepAccount({
  data,
  email,
  onChangeEmail,
  onBack,
  onComplete,
}: StepAccountProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [wasSimulated, setWasSimulated] = useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleStartTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    // Salva o rascunho de onboarding e recupera ou gera a Idempotency-Key
    let idempotencyKey: string;
    try {
      const existingKey = localStorage.getItem("agenda_onboarding_idempotency_key");
      if (existingKey) {
        idempotencyKey = existingKey;
      } else {
        idempotencyKey = crypto.randomUUID();
        localStorage.setItem("agenda_onboarding_idempotency_key", idempotencyKey);
      }
    } catch {
      idempotencyKey = crypto.randomUUID();
    }

    const result = await requestMagicLink(email.trim());

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
      <div className="text-center space-y-5 py-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-3xl font-bold">
          ✉️
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Verifique seu e-mail
          </h2>
          <p className="text-sm text-muted-foreground">
            Enviamos um link mágico de acesso para{" "}
            <span className="font-semibold text-foreground">{email}</span>.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground text-left space-y-2">
          <p className="font-semibold text-foreground">O que acontece agora?</p>
          <p>
            1. Abra seu e-mail e clique no botão <strong>Entrar na Agenda</strong>.
          </p>
          <p>
            2. Você entrará no seu painel para confirmar a ativação do seu link personalizado{" "}
            <code className="text-foreground font-mono font-bold">
              agenda.com.br/{data.slug}
            </code>.
          </p>
        </div>

        {/* Alerta de simulação — só aparece em dev quando o envio foi simulado */}
        {wasSimulated && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400 text-left">
            <p className="font-semibold mb-0.5">⚠ Modo de desenvolvimento — envio simulado</p>
            <p>
              Nenhum e-mail foi disparado. Para envio real, configure{" "}
              <code className="font-mono">BETTER_AUTH_URL</code>,{" "}
              <code className="font-mono">BETTER_AUTH_SECRET</code> e{" "}
              <code className="font-mono">DATABASE_URL</code> no{" "}
              <code className="font-mono">.env</code> e reinicie o servidor.
            </p>
          </div>
        )}

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSent(false)}
            className="w-full min-h-11 font-medium"
          >
            Usar outro e-mail
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleStartTrial} className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">
          Pronto para começar seus 7 dias grátis?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu e-mail para receber o acesso seguro sem senha.
        </p>
      </div>

      {/* Resumo da Configuração */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5 text-xs">
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <span className="text-muted-foreground">Negócio:</span>
          <span className="font-bold text-foreground">{data.businessName}</span>
        </div>
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <span className="text-muted-foreground">Link público:</span>
          <span className="font-mono text-foreground font-semibold">
            agenda.com.br/{data.slug}
          </span>
        </div>
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <span className="text-muted-foreground">Primeiro serviço:</span>
          <span className="font-medium text-foreground">
            {data.serviceName} ({formatDuration(data.durationMinutes)}) ·{" "}
            {formatCurrency(data.priceCents)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Sinal no Pix:</span>
          <span className="font-semibold text-foreground">
            {data.depositCents > 0 ? formatCurrency(data.depositCents) : "Sem sinal"}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="account-email"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Seu melhor e-mail profissional
          </label>
          <input
            id="account-email"
            type="email"
            required
            autoComplete="email"
            placeholder="seuemail@exemplo.com.br"
            value={email}
            onChange={(e) => onChangeEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground/60 min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          />
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive transition-all duration-180 ease-out motion-reduce:transition-none"
          >
            {errorMessage}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-lime inline-block" /> 7 dias de teste grátis
            do Plano {data.plan === "completo" ? "Completo" : "Base"}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-lime inline-block" /> Sem cartão de crédito
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onBack}
          className="flex-1 min-h-12 font-medium rounded-full transition-transform duration-120 active:scale-[0.98] motion-reduce:transform-none"
        >
          Voltar
        </Button>
        <Button
          type="submit"
          disabled={!isEmailValid || isSubmitting}
          className="flex-[2] min-h-12 font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-transform duration-120 active:scale-[0.98] motion-reduce:transform-none"
        >
          {isSubmitting ? "Enviando link..." : "Ativar meus 7 dias grátis"}
        </Button>
      </div>
    </form>
  );
}
