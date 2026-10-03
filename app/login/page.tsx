"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type MagicLinkResult =
  | { ok: true; simulated?: boolean }
  | { ok: false; code: "auth_unavailable" | "invalid_email" | "unknown"; message: string };

async function sendLoginMagicLink(email: string): Promise<MagicLinkResult> {
  const isDevOrPreview =
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" && window.location.pathname.startsWith("/preview"));

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

    if (res.status >= 500) {
      if (isDevOrPreview) {
        return { ok: true, simulated: true };
      }
      return {
        ok: false,
        code: "auth_unavailable",
        message:
          "O serviço de envio de e-mail está temporariamente indisponível. Tente novamente em alguns instantes.",
      };
    }

    const body = await res.json().catch(() => null);
    return {
      ok: false,
      code: "invalid_email",
      message:
        (body?.message as string) ||
        "Não foi possível enviar o link de acesso. Verifique o e-mail informado.",
    };
  } catch {
    if (isDevOrPreview) {
      return { ok: true, simulated: true };
    }
    return {
      ok: false,
      code: "unknown",
      message: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    };
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [wasSimulated, setWasSimulated] = useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await sendLoginMagicLink(email.trim());

    if (result.ok) {
      setWasSimulated(!!result.simulated);
      setIsSent(true);
    } else {
      setErrorMessage(result.message);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header Compacto */}
      <header className="border-b border-border bg-surface py-3.5 px-4 sm:px-6">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-forest text-xs font-black text-primary">
              A
            </span>
            <span>Agenda</span>
          </Link>
          <Link
            href="/onboarding"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Criar conta
          </Link>
        </div>
      </header>

      {/* Conteúdo Centralizado */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-10 flex flex-col justify-center">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm">
          {isSent ? (
            <div className="text-center space-y-5 py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-2xl font-bold">
                ✉️
              </div>
              <div className="space-y-1">
                <h1 className="font-display text-2xl font-bold text-foreground">
                  Verifique seu e-mail
                </h1>
                <p className="text-sm text-muted-foreground">
                  Enviamos o link de login seguro para{" "}
                  <span className="font-semibold text-foreground">{email}</span>.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground text-left space-y-2">
                <p className="font-semibold text-foreground">Como acessar?</p>
                <p>1. Abra o e-mail recebido e clique no link de acesso.</p>
                <p>2. Você será redirecionado diretamente ao seu painel.</p>
              </div>

              {wasSimulated && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400 text-left">
                  <p className="font-semibold mb-0.5">⚠ Modo de desenvolvimento — envio simulado</p>
                  <p>
                    Para envio real de e-mails, configure as variáveis de SMTP no servidor.
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
                  Tentar outro e-mail
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  Entrar na sua conta
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Digite seu e-mail profissional para receber o link de acesso sem senha.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-sm font-medium text-foreground mb-1.5"
                  >
                    E-mail profissional
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    aria-invalid={errorMessage ? "true" : undefined}
                    aria-describedby={errorMessage ? "login-error" : undefined}
                    placeholder="seuemail@exemplo.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground/60 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                </div>

                {errorMessage && (
                  <div
                    id="login-error"
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
                  >
                    {errorMessage}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={!isEmailValid || isSubmitting}
                className="w-full min-h-11 font-semibold rounded-full bg-primary hover:bg-primary-hover text-primary-foreground"
              >
                {isSubmitting ? "Enviando link..." : "Receber link de acesso"}
              </Button>

              <div className="text-center pt-2 text-xs text-muted-foreground">
                Ainda não tem uma conta?{" "}
                <Link
                  href="/onboarding"
                  className="font-semibold text-foreground hover:underline"
                >
                  Começar 7 dias grátis
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
