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

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleStartTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Chamada real para Better Auth magic link conforme CONTRATOS.md
      const res = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          callbackURL: "/dashboard",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.message || "Não foi possível enviar o link de acesso. Verifique o email informado."
        );
      }

      setIsSent(true);
      onComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar conta.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
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
            2. Você será direcionado diretamente para o painel com seu link público{" "}
            <code className="text-primary font-mono font-bold">agenda.com.br/{data.slug}</code> ativado.
          </p>
        </div>

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
          <span className="font-mono text-primary font-semibold">agenda.com.br/{data.slug}</span>
        </div>
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <span className="text-muted-foreground">Primeiro serviço:</span>
          <span className="font-medium text-foreground">
            {data.serviceName} ({formatDuration(data.durationMinutes)}) · {formatCurrency(data.priceCents)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Sinal no Pix:</span>
          <span className="font-semibold text-emerald-600">
            {data.depositCents > 0 ? formatCurrency(data.depositCents) : "Sem sinal"}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="account-email" className="block text-sm font-medium text-foreground mb-1.5">
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
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground/60 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            {errorMessage}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> 7 dias de teste grátis do Plano{" "}
            {data.plan === "completo" ? "Completo" : "Base"}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> Sem cartão de crédito
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onBack}
          className="flex-1 min-h-11 font-medium"
        >
          Voltar
        </Button>
        <Button
          type="submit"
          disabled={!isEmailValid || isSubmitting}
          className="flex-[2] min-h-11 font-semibold"
        >
          {isSubmitting ? "Enviando link..." : "Ativar meus 7 dias grátis"}
        </Button>
      </div>
    </form>
  );
}
