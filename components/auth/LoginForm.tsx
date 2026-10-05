"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field";
import { requestMagicLink, type MagicLinkResult } from "@/lib/magic-link";
import { DEFAULT_AFTER_LOGIN } from "@/lib/safe-redirect";
import { cn } from "@/lib/utils";

export const LINK_ERROR_MESSAGE =
  "Este link de acesso expirou ou já foi usado. Peça um novo link abaixo.";

export interface LoginFormProps {
  title?: string;
  subtitle?: string;
  /** Caminho relativo já validado (ver `safeNextPath`). */
  callbackURL?: string;
  /** Veio de um link mágico inválido/expirado (`/login?error=...`). */
  linkError?: boolean;
  showCreateAccountLink?: boolean;
  className?: string;
}

export function LoginForm({
  title = "Entrar na sua conta",
  subtitle = "Digite seu e-mail profissional. Enviamos um link de acesso, sem senha.",
  callbackURL = DEFAULT_AFTER_LOGIN,
  linkError = false,
  showCreateAccountLink = true,
  className = "",
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(linkError ? LINK_ERROR_MESSAGE : null);
  const [isSent, setIsSent] = useState(false);
  const [wasSimulated, setWasSimulated] = useState(false);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (isSent) sentHeadingRef.current?.focus();
  }, [isSent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result: MagicLinkResult = await requestMagicLink(email.trim(), undefined, callbackURL);

    if (result.ok) {
      setWasSimulated(!!result.simulated);
      setIsSent(true);
    } else {
      setErrorMessage(result.message);
    }

    setIsSubmitting(false);
  };

  if (isSent) {
    return (
      <div className={cn("space-y-6", className)}>
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-pix-soft text-pix">
          <MailCheck className="size-7" />
        </span>
        <div className="space-y-2">
          <h1 ref={sentHeadingRef} tabIndex={-1} className="font-display text-3xl font-extrabold tracking-tight outline-none">
            Verifique seu e-mail
          </h1>
          <p className="text-muted">
            Enviamos o link de acesso para <span className="break-all font-semibold text-ink">{email}</span>. Ele vale por alguns minutos e pode ser usado uma vez.
          </p>
        </div>
        <ol className="grid gap-3 rounded-card border border-line bg-surface p-4 text-sm">
          <li className="flex gap-3"><span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">1</span>Abra o e-mail “Seu link de acesso” no celular ou no computador.</li>
          <li className="flex gap-3"><span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">2</span>Toque em “Entrar” e você cai direto no painel.</li>
        </ol>
        <p className="text-sm text-muted">Não chegou? Confira a caixa de spam ou peça outro link.</p>

        {wasSimulated && (
          <div className="flex gap-2 rounded-field border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p><span className="font-semibold">Modo de desenvolvimento: envio simulado.</span> Configure o SMTP no servidor para enviar e-mails de verdade.</p>
          </div>
        )}

        <Button type="button" variant="outline" onClick={() => setIsSent(false)} className="w-full">
          <ArrowLeft aria-hidden="true" />Usar outro e-mail
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-muted">{subtitle}</p>
      </div>

      {errorMessage && linkError && errorMessage === LINK_ERROR_MESSAGE ? (
        <div id="login-error" role="alert" className="flex gap-2 rounded-field border border-warning/30 bg-warning-soft p-3 text-sm font-medium text-warning">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <label htmlFor="login-email" className="text-sm font-semibold">E-mail profissional</label>
        <Input
          id="login-email"
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errorMessage && errorMessage !== LINK_ERROR_MESSAGE ? "true" : undefined}
          aria-describedby={errorMessage && errorMessage !== LINK_ERROR_MESSAGE ? "login-error" : undefined}
          placeholder="voce@seunegocio.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errorMessage && errorMessage !== LINK_ERROR_MESSAGE && <FieldError id="login-error">{errorMessage}</FieldError>}
      </div>

      <Button type="submit" size="lg" disabled={!isEmailValid || isSubmitting} className="w-full">
        {isSubmitting ? "Enviando link…" : "Receber link de acesso"}
      </Button>

      {showCreateAccountLink && (
        <p className="flex flex-wrap items-center justify-center gap-1 text-sm text-muted">
          <span>Ainda não tem conta?</span>
          <Link href="/onboarding" className="inline-flex min-h-11 items-center px-1 font-semibold text-ink underline-offset-4 hover:underline">
            Criar minha agenda grátis
          </Link>
        </p>
      )}
    </form>
  );
}
