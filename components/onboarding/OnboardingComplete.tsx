"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { provisionBusiness, type ProvisioningResult } from "@/lib/provisioning";
import {
  IDEMPOTENCY_KEY,
  clearCompletedSetup,
  ensureOnboardingIdempotencyKey,
  readCompletedSetup,
} from "./storage";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "done"; publicPath: string; slug: string }
  | { kind: "error"; result: Extract<ProvisioningResult, { ok: false }> };

/**
 * Destino do link mágico do cadastro: com a sessão já criada pelo Better Auth,
 * envia o rascunho salvo para `POST /api/onboarding` (mesma Idempotency-Key em novas tentativas).
 */
export function OnboardingComplete() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const started = useRef(false);

  const run = useCallback(async () => {
    const setup = readCompletedSetup();
    if (!setup) {
      setState({ kind: "missing" });
      return;
    }
    setState({ kind: "loading" });
    const result = await provisionBusiness(setup, { idempotencyKey: ensureOnboardingIdempotencyKey() });
    if (result.ok) {
      clearCompletedSetup();
      setState({ kind: "done", publicPath: result.publicPath, slug: result.slug });
      return;
    }
    if (result.code === "conflict" || result.code === "idempotency_conflict" || result.code === "invalid_payload") {
      // Os dados precisam mudar: devolve o rascunho ao formulário e descarta a chave usada.
      try {
        localStorage.setItem("agenda_onboarding_draft", JSON.stringify(setup));
        localStorage.setItem("agenda_onboarding_step", "1");
        localStorage.removeItem(IDEMPOTENCY_KEY);
      } catch {
        // localStorage indisponível: o usuário refaz o cadastro.
      }
    }
    setState({ kind: "error", result });
  }, []);

  useEffect(() => {
    // Evita a segunda chamada do StrictMode; a rota é idempotente de qualquer forma.
    if (started.current) return;
    started.current = true;
    queueMicrotask(() => void run());
  }, [run]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-5" aria-live="polite">
        {state.kind === "loading" && (
          <div className="space-y-3 text-center" role="status">
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-foreground border-t-transparent animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Ativando sua agenda…</p>
          </div>
        )}

        {state.kind === "missing" && (
          <div className="space-y-4 text-center">
            <h1 className="font-display text-2xl font-bold">Nenhum cadastro pendente</h1>
            <p className="text-sm text-muted-foreground">
              Não encontramos os dados do cadastro neste navegador. Abra o link no mesmo navegador em que você preencheu o cadastro, ou comece de novo.
            </p>
            <Link href="/onboarding" className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">
              Fazer cadastro
            </Link>
          </div>
        )}

        {state.kind === "done" && (
          <div className="space-y-4 text-center">
            <h1 className="font-display text-2xl font-bold">Sua agenda está no ar</h1>
            <p className="text-sm text-muted-foreground">
              Compartilhe seu link com os clientes:{" "}
              <span className="font-mono font-semibold text-foreground break-all">/{state.slug}</span>
            </p>
            <div className="flex flex-col gap-2">
              <Link href={state.publicPath} className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">
                Abrir minha página de agendamento
              </Link>
              <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium">
                Ir para o painel
              </Link>
            </div>
          </div>
        )}

        {state.kind === "error" && (
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-bold">Não foi possível ativar sua agenda</h1>
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {state.result.message}
            </p>
            {state.result.code === "server_error" ? (
              <Button type="button" onClick={() => void run()} className="w-full min-h-11">
                Tentar novamente
              </Button>
            ) : state.result.code === "unauthorized" ? (
              <Link href="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">
                Entrar novamente
              </Link>
            ) : (
              <Link href="/onboarding" className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">
                Revisar cadastro
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
