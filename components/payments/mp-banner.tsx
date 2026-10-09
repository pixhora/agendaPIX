"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlugZap, Unplug, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bannerDismissStorageKey,
  bannerDismissUntil,
  bannerHiddenUntil,
  reconnectRequiresAck,
  selectMpBanners,
  type MpBannerId,
  type MpOwnerStatus,
} from "@/lib/mercadopago/contract";
import { MpConnectForm } from "./mp-connect-form";

function readNotConnectedHidden(businessId: string): boolean {
  try {
    return bannerHiddenUntil(
      localStorage.getItem(bannerDismissStorageKey(businessId, "mp-not-connected")),
      Date.now(),
    );
  } catch {
    return false;
  }
}

const COPY: Record<MpBannerId, { title: string; body: string; action: string }> = {
  "mp-reauth": {
    title: "Sua conta Mercado Pago foi desconectada",
    body: "Os serviços com sinal estão pausados e não aparecem para novos agendamentos. Sinais já pagos estão na sua conta Mercado Pago.",
    action: "Conectar de novo",
  },
  "mp-not-connected": {
    title: "Conecte sua conta Mercado Pago para cobrar o sinal.",
    body: "Serviços com sinal estão indisponíveis na sua página.",
    action: "Conectar",
  },
};

export function MpBannerList({
  businessId,
  status,
  hasDepositService,
  blockedReasons,
}: {
  businessId: string;
  status: MpOwnerStatus;
  hasDepositService: boolean;
  blockedReasons?: readonly string[];
}) {
  const banners = selectMpBanners({ status: status.status, hasDepositService, blockedReasons });
  const bannerKey = banners.join("|");
  const [hidden, setHidden] = useState<Partial<Record<MpBannerId, boolean>>>({});
  const [ready, setReady] = useState(false);
  const loaded = useRef("");

  useEffect(() => {
    const token = `${businessId}:${bannerKey}`;
    if (loaded.current === token) return;
    loaded.current = token;
    const next: Partial<Record<MpBannerId, boolean>> = {};
    if (bannerKey.includes("mp-not-connected")) {
      next["mp-not-connected"] = readNotConnectedHidden(businessId);
    }
    setHidden(next);
    setReady(true);
  }, [bannerKey, businessId]);

  if (!ready) return null;
  const visible = banners.filter((banner) => banner === "mp-reauth" || !hidden[banner]).slice(0, 2);
  if (!visible.length) return null;

  return (
    <div className="mb-4 grid gap-3">
      {visible.map((banner) => (
        <MpBanner
          key={banner}
          id={banner}
          businessId={businessId}
          requireAck={reconnectRequiresAck(status.consentVersion)}
          onDismiss={banner === "mp-not-connected" ? () => {
            try {
              localStorage.setItem(bannerDismissStorageKey(businessId, banner), String(bannerDismissUntil(Date.now())));
            } catch {
              // o aviso volta na próxima visita
            }
            setHidden((current) => ({ ...current, [banner]: true }));
          } : undefined}
        />
      ))}
    </div>
  );
}

function MpBanner({
  id,
  businessId,
  requireAck,
  onDismiss,
}: {
  id: MpBannerId;
  businessId: string;
  requireAck: boolean;
  onDismiss?: () => void;
}) {
  const copy = COPY[id];
  const stop = id === "mp-reauth";
  const Icon = stop ? Unplug : PlugZap;
  return (
    <section
      role="region"
      aria-label="Aviso do recebimento"
      className={cn("rounded-card border px-4 py-4", stop ? "border-danger/30 bg-danger-soft" : "border-warning/30 bg-warning-soft")}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", stop ? "text-danger" : "text-warning")} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-bold leading-snug">{copy.title}</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-ink/85">{copy.body}</p>
        </div>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} aria-label="Fechar aviso" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none">
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-3">
        {requireAck ? (
          <Link href="/dashboard/settings#recebimento" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>{copy.action}</Link>
        ) : (
          <MpConnectForm
            businessId={businessId}
            returnTo="/dashboard"
            requireAck={false}
            acknowledged
            onAcknowledgedChange={() => undefined}
            ackInvalid={false}
            submitLabel={copy.action}
            buttonVariant="default"
            onBlocked={() => undefined}
          />
        )}
      </div>
    </section>
  );
}
