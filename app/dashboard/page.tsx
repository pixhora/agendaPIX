"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

/**
 * Página /dashboard — placeholder enquanto o painel real (T2) não está integrado.
 *
 * Após o login via magic link, o Better Auth redireciona aqui.
 * Detecta a sessão ativa e exibe boas-vindas com o e-mail do usuário.
 * Quando o painel real estiver disponível, esta página será substituída.
 */
export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setEmail(data?.user?.email ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full rounded-2xl border border-border bg-surface p-8 text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Sessão não encontrada
          </h1>
          <p className="text-sm text-muted-foreground">
            Seu link de acesso pode ter expirado ou já foi usado.
          </p>
          <Link
            href="/onboarding"
            className="block w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full rounded-2xl border border-border bg-surface p-8 text-center space-y-5">
        {/* Ícone de sucesso */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
          🎉
        </div>

        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Acesso confirmado!
          </h1>
          <p className="text-sm text-muted-foreground">
            Você entrou como{" "}
            <span className="font-semibold text-foreground">{email}</span>.
          </p>
        </div>

        {/* Aviso de painel em construção */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-left space-y-1.5">
          <p className="text-xs font-semibold text-foreground">
            Painel em preparação 🛠
          </p>
          <p className="text-xs text-muted-foreground">
            Sua conta foi criada com sucesso. O painel de controle está sendo
            desenvolvido e ficará disponível em breve.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <Link
            href="/"
            className="block w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Ver landing page
          </Link>
          <Link
            href="/preview/dashboard"
            className="block w-full rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface/80 transition-colors"
          >
            Explorar demo do painel
          </Link>
        </div>
      </div>
    </div>
  );
}
