"use client";

import { useCallback, useEffect, useState } from "react";
import { MpSettingsCard } from "./mp-settings-card";
import { MpBannerList } from "./mp-banner";
import { parseMpOwnerStatus, type MpOwnerStatus } from "@/lib/mercadopago/contract";
import { mpConnectionUrl } from "@/lib/mercadopago/contract";

export function MpStatusPanel({
  businessId,
  timezone,
  fixture,
  hasDepositService = false,
  pendingPixCount = 0,
  showBanner = false,
}: {
  businessId: string;
  timezone: string;
  fixture: MpOwnerStatus | null;
  hasDepositService?: boolean;
  pendingPixCount?: number;
  showBanner?: boolean;
}) {
  const [status, setStatus] = useState<MpOwnerStatus | null>(fixture);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(fixture ? "ready" : "loading");

  const load = useCallback(async () => {
    if (fixture) {
      setStatus(fixture);
      setPhase("ready");
      return;
    }
    setPhase("loading");
    try {
      const response = await fetch(mpConnectionUrl(businessId), { cache: "no-store" });
      if (!response.ok) {
        setPhase("error");
        return;
      }
      const parsed = parseMpOwnerStatus(await response.json());
      if (!parsed) {
        setPhase("error");
        return;
      }
      setStatus(parsed);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [businessId, fixture]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (phase === "loading") {
    return (
      <section aria-labelledby="recebimento-title" aria-busy="true" className="rounded-card border border-line bg-surface p-5">
        <h2 id="recebimento-title" className="font-display text-lg font-bold">Recebimento</h2>
        <div className="mt-4 grid gap-2" role="status">
          <span className="sr-only">Carregando o status do Mercado Pago…</span>
          <span className="h-4 w-40 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
          <span className="h-4 w-56 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
          <span className="h-4 w-32 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
        </div>
      </section>
    );
  }

  if (phase === "error" || !status) {
    return (
      <section aria-labelledby="recebimento-title" className="rounded-card border border-line bg-surface p-5">
        <h2 id="recebimento-title" className="font-display text-lg font-bold">Recebimento</h2>
        <p role="alert" className="mt-3 text-sm text-ink">Não conseguimos carregar o status agora.</p>
        <button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none">
          Tentar de novo
        </button>
      </section>
    );
  }

  return (
    <>
      {showBanner ? <MpBannerList businessId={businessId} status={status} hasDepositService={hasDepositService} /> : null}
      <MpSettingsCard businessId={businessId} status={status} timezone={timezone} pendingPixCount={pendingPixCount} onStatus={setStatus} />
    </>
  );
}
