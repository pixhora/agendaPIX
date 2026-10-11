"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { readCommitResult, writeCommitResult } from "@/components/onboarding/storage";
import {
  mpConnectionUrl,
  parseMpOwnerStatus,
  presentMpCallback,
  type MpCallbackView,
  type MpOwnerStatus,
} from "@/lib/mercadopago/contract";
import { stripOAuthReturnParams } from "@/lib/onboarding/oauth-return";
import { ONBOARDING_RESUME_PATH, onboardingResumeSchema } from "@/lib/onboarding/resume-contract";
import { loginErrorPath } from "@/lib/safe-redirect";
import { MpOnboardingStep } from "./mp-onboarding-step";
import { takeMpCallback } from "./mp-callback";

type ResumeGate = "loading" | "ready" | "signed-out" | "missing";

function readCallback(searchParams: { get(name: string): string | null }) {
  const live = presentMpCallback(searchParams.get("mp"), searchParams.get("reason"));
  if (live) return live;
  const stored = takeMpCallback();
  return stored ? presentMpCallback(stored.mp, stored.reason) : null;
}

/** Tira id, slug, code e state da barra. Nenhum desses valores vai para o sessionStorage. */
function dropBusinessHintsFromUrl() {
  const url = new URL(window.location.href);
  const hinted = url.searchParams.has("businessId") || url.searchParams.has("slug") || url.searchParams.has("code") || url.searchParams.has("state");
  if (!hinted) return;
  url.searchParams.delete("businessId");
  url.searchParams.delete("slug");
  stripOAuthReturnParams(url.searchParams);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", next);
}

export function MpRecebimento({ legalPagesPublished }: { legalPagesPublished: boolean }) {
  const searchParams = useSearchParams();
  const [gate, setGate] = useState<ResumeGate>("loading");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [callback, setCallback] = useState<MpCallbackView | null>(null);
  const [ownerStatus, setOwnerStatus] = useState<MpOwnerStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCallback(readCallback(searchParams));
      dropBusinessHintsFromUrl();
      const local = readCommitResult()?.businessId;
      if (local) {
        setBusinessId(local);
        setGate("ready");
        return;
      }
      void fetch(ONBOARDING_RESUME_PATH, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
        .then(async (response) => {
          if (response.status === 401) {
            setGate("signed-out");
            return;
          }
          if (!response.ok) {
            setGate("missing");
            return;
          }
          const parsed = onboardingResumeSchema.safeParse(await response.json());
          if (!parsed.success) {
            setGate("missing");
            return;
          }
          writeCommitResult(parsed.data);
          setBusinessId(parsed.data.businessId);
          setGate("ready");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setGate("missing");
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchParams]);

  useEffect(() => {
    if (!businessId || callback?.mp !== "connected") return;
    const controller = new AbortController();
    void fetch(mpConnectionUrl(businessId), { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const parsed = parseMpOwnerStatus(payload);
        if (parsed) setOwnerStatus(parsed);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [businessId, callback]);

  if (gate === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6" role="status" aria-busy="true">
        <p className="text-sm text-muted">Carregando recebimento…</p>
      </main>
    );
  }

  if (gate === "signed-out") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Seu cadastro está salvo. Entre com seu e-mail para continuar de onde parou.</h1>
        <Link href={loginErrorPath("/onboarding/recebimento")} className={buttonVariants({ variant: "pixDeep", size: "lg" })}>Entrar</Link>
      </main>
    );
  }

  if (gate === "missing" || !businessId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Não encontramos este cadastro</h1>
        {/* O retorno do Mercado Pago trouxe uma resposta: mostramos em vez de descartar. */}
        {callback ? (
          <p role="status" className="text-sm leading-relaxed">{callback.mp === "connected" ? callback.toast : callback.message}</p>
        ) : null}
        <p className="text-sm leading-relaxed text-muted">Abra o painel para conectar o Mercado Pago, ou comece o cadastro de novo.</p>
        <Link href="/dashboard/settings#recebimento" className={buttonVariants({ size: "lg" })}>Abrir o painel</Link>
        <Link href="/onboarding" className={buttonVariants({ variant: "outline", size: "lg" })}>Começar de novo</Link>
      </main>
    );
  }

  return (
    <MpOnboardingStep
      businessId={businessId}
      legalPagesPublished={legalPagesPublished}
      callback={callback}
      ownerStatus={ownerStatus}
      onDisconnected={() => {
        setCallback(null);
        setOwnerStatus(null);
      }}
    />
  );
}
