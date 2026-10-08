"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { readCommitResult } from "@/components/onboarding/storage";
import {
  DISCONNECTED_TOAST,
  mpConnectionUrl,
  parseMpOwnerStatus,
  presentMpCallback,
  type MpCallbackView,
} from "@/lib/mercadopago/contract";
import { MpOnboardingStep } from "./mp-onboarding-step";
import { takeMpCallback } from "./mp-callback";

export function MpRecebimento({ legalPagesPublished }: { legalPagesPublished: boolean }) {
  const searchParams = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null | undefined>(undefined);
  const [callback, setCallback] = useState<MpCallbackView | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountEmailMasked, setAccountEmailMasked] = useState<string | null>(null);
  const [accountIdLast4, setAccountIdLast4] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBusinessId(readCommitResult()?.businessId ?? null);
      const live = presentMpCallback(searchParams.get("mp"), searchParams.get("reason"));
      if (live) {
        setCallback(live);
        return;
      }
      const stored = takeMpCallback();
      if (!stored) return;
      setCallback(presentMpCallback(stored.mp, stored.reason));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    if (!businessId || callback?.mp !== "connected") return;
    const controller = new AbortController();
    void fetch(mpConnectionUrl(businessId), { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const parsed = parseMpOwnerStatus(payload);
        if (!parsed) return;
        if (parsed.connectedAt) setConnectedAt(parsed.connectedAt);
        setAccountName(parsed.accountName);
        setAccountEmailMasked(parsed.accountEmailMasked);
        setAccountIdLast4(parsed.accountIdLast4);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [businessId, callback]);

  if (businessId === undefined) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6" role="status" aria-busy="true">
        <p className="text-sm text-muted">Carregando recebimento…</p>
      </main>
    );
  }

  if (!businessId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Não encontramos este cadastro</h1>
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
      connectedAt={connectedAt}
      accountName={accountName}
      accountEmailMasked={accountEmailMasked}
      accountIdLast4={accountIdLast4}
      onDismissAccount={callback?.mp === "connected" ? () => {
        void fetch(mpConnectionUrl(businessId), { method: "DELETE" })
          .then((response) => {
            if (response.status !== 204) {
              toast("Não conseguimos desconectar agora. Tente de novo.");
              return;
            }
            toast(DISCONNECTED_TOAST);
            setCallback(null);
            setConnectedAt(null);
            setAccountName(null);
            setAccountEmailMasked(null);
            setAccountIdLast4(null);
          })
          .catch(() => {
            toast("Sem internet. Tente de novo quando a conexão voltar.");
          });
      } : undefined}
    />
  );
}
