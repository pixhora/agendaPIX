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

type MagicLinkResult =
  | { ok: true; simulated?: boolean }
  | { ok: false; code: "auth_unavailable" | "invalid_email" | "unknown"; message: string };

/**
 * Tenta enviar o magic-link real.
 *
 * Em ambiente de desenvolvimento ou em rotas /preview, quando o servidor
 * responde com 5xx (ex: BETTER_AUTH_URL/SECRET ausentes, banco ou SMTP offline),
 * simula o sucesso localmente para que o fluxo visual possa ser testado
 * sem Postgres + SMTP configurados.
 *
 * Em produção, erros de infraestrutura exibem mensagem clara ao usuário,
 * sem culpar o e-mail informado.
 */
async function sendMagicLink(
  email: string,
  pathname = typeof window !== "undefined" ? window.location.pathname : ""
): Promise<MagicLinkResult> {
  const isPreview = pathname.startsWith("/preview");

  try {
    const res = await fetch("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        callbackURL: "/dashboard",
      }),
    });

    if (res.ok) return { ok: true };

    // 5xx → problema de infraestrutura (env ausentes, banco ou SMTP offline)
    if (res.status >= 500) {
      if (isPreview) {
        return { ok: true, simulated: true };
      }
      return {
        ok: false,
        code: "auth_unavailable",
        message:
          "O serviço de envio de e-mail está temporariamente indisponível. Tente novamente em alguns instantes.",
      };
    }

    // 4xx → erro de validação (e-mail inválido, domínio bloqueado, etc.)
    const body = await res.json().catch(() => null);
    return {
      ok: false,
      code: "invalid_email",
      message:
        (body?.message as string) ||
        "Não foi possível enviar o link de acesso. Verifique o e-mail informado.",
    };
  } catch {
    // Falha de rede: sem conexão, DNS, CORS, etc.
    if (isPreview) {
      return { ok: true, simulated: true };
    }
    return {
      ok: false,
      code: "unknown",
      message: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    };
  }
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
  const [wasSimulated, setWasSimulated] = useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleStartTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await sendMagicLink(email.trim());

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
            <code className="text-primary font-mono font-bold">
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
          <span className="font-mono text-primary font-semibold">
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
          <span className="font-semibold text-emerald-600">
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
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground/60 min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
            <span className="text-emerald-600 font-bold">✓</span> 7 dias de teste grátis
            do Plano {data.plan === "completo" ? "Completo" : "Base"}
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
          className="flex-1 min-h-12 font-medium rounded-full transition-transform duration-120 active:scale-[0.98] motion-reduce:transform-none"
        >
          Voltar
        </Button>
        <Button
          type="submit"
          disabled={!isEmailValid || isSubmitting}
          className="flex-[2] min-h-12 font-semibold rounded-full bg-primary hover:bg-primary-hover text-primary-foreground transition-transform duration-120 active:scale-[0.98] motion-reduce:transform-none"
        >
          {isSubmitting ? "Enviando link..." : "Ativar meus 7 dias grátis"}
        </Button>
      </div>
    </form>
  );
}
