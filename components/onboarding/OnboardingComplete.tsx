"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, FileQuestion, Loader2, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { BrandLink } from "@/components/ui/brand";
import { cn } from "@/lib/utils";
import { provisionBusiness, type ProvisioningResult } from "@/lib/provisioning";
import {
  IDEMPOTENCY_KEY,
  ONBOARDING_COMPLETE_PATH,
  clearCompletedSetup,
  ensureOnboardingIdempotencyKey,
  readCommitResult,
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
    const committed = readCommitResult();
    if (committed) {
      setState({ kind: "done", publicPath: committed.publicPath, slug: committed.slug });
      return;
    }
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

  const primary = cn(buttonVariants({ size: "lg" }), "w-full");
  const secondary = cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center px-4 sm:px-6"><BrandLink /></div>
      </header>
      <main id="content" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-frame border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8" aria-live="polite">
          {state.kind === "loading" && (
            <div className="space-y-4 py-6 text-center" role="status">
              <Loader2 aria-hidden="true" className="mx-auto size-8 animate-spin text-pix motion-reduce:animate-none" />
              <p className="font-semibold">Ativando sua agenda…</p>
              <p className="text-sm text-muted">Criando sua página, serviço e horários.</p>
            </div>
          )}

          {state.kind === "missing" && (
            <div className="space-y-5 text-center">
              <span aria-hidden="true" className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-subtle text-muted"><FileQuestion className="size-7" /></span>
              <h1 className="font-display text-2xl font-extrabold tracking-tight">Nenhum cadastro pendente</h1>
              <p className="text-muted">
                Não encontramos um cadastro para continuar. Comece de novo, leva poucos minutos.
              </p>
              <Link href="/onboarding" className={primary}>Fazer cadastro</Link>
            </div>
          )}

          {state.kind === "done" && (
            <div className="space-y-6 text-center">
              <span aria-hidden="true" className="animate-confirm-pop mx-auto flex size-16 items-center justify-center rounded-full bg-pix text-pix-foreground"><Check className="size-8" strokeWidth={3} /></span>
              <div className="space-y-2">
                <h1 className="font-display text-3xl font-extrabold tracking-tight">Sua agenda está no ar</h1>
                <p className="text-muted">Compartilhe o link no WhatsApp e no Instagram. Cada reserva chega com o sinal pago no Pix.</p>
              </div>
              <p className="rounded-field border border-line bg-subtle px-4 py-3 font-semibold break-all">/{state.slug}</p>
              <div className="flex flex-col gap-2">
                <Link href="/dashboard" className={primary}>Ir para o painel<ArrowRight aria-hidden="true" /></Link>
                <Link href={state.publicPath} className={secondary}><ExternalLink aria-hidden="true" />Ver minha página</Link>
              </div>
            </div>
          )}

          {state.kind === "error" && (
            <div className="space-y-5">
              <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger"><TriangleAlert className="size-6" /></span>
              <h1 className="font-display text-2xl font-extrabold tracking-tight">Não foi possível ativar sua agenda</h1>
              <p role="alert" className="rounded-field border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger">
                {state.result.message}
              </p>
              {state.result.code === "server_error" ? (
                <Button type="button" size="lg" onClick={() => void run()} className="w-full">
                  Tentar novamente
                </Button>
              ) : state.result.code === "unauthorized" ? (
                <Link href={`/login?next=${encodeURIComponent(ONBOARDING_COMPLETE_PATH)}`} className={primary}>Entrar novamente</Link>
              ) : (
                <Link href="/onboarding" className={primary}>Revisar cadastro</Link>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
