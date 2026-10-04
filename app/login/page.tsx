"use client";

import React from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { requestMagicLink, type MagicLinkResult } from "@/lib/magic-link";

export type { MagicLinkResult };
export const sendLoginMagicLink = requestMagicLink;

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header Compacto */}
      <header className="border-b border-border bg-surface py-2 px-4 sm:px-6">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-foreground min-h-11 py-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-forest text-xs font-black text-primary">
              A
            </span>
            <span>Agenda</span>
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center text-xs font-semibold text-primary hover:underline min-h-11 px-2 -mr-2"
          >
            Criar conta
          </Link>
        </div>
      </header>

      {/* Conteúdo Centralizado */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-10 flex flex-col justify-center">
        <LoginForm />
      </main>
    </div>
  );
}
