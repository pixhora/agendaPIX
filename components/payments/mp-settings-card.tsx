"use client";

import { useState } from "react";
import { ExternalLink, Info, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DISCONNECTED_TOAST,
  LEGACY_PIX_NOTICE,
  MP_TARIFF_URL,
  formatConnectedSince,
  legacyNoticeAfterDismiss,
  legacyNoticeVisible,
  legacyPixDismissUrl,
  mpAccountIdentity,
  mpConnectionUrl,
  reconnectRequiresAck,
  type MpReturnTo,
  showsTestMode,
  statusBadge,
  type MpOwnerStatus,
} from "@/lib/mercadopago/contract";
import { MpConnectForm } from "./mp-connect-form";
import { MpDisconnectDialog } from "./mp-disconnect-dialog";

function StatusPill({ status }: { status: MpOwnerStatus["status"] }) {
  const badge = statusBadge(status);
  const tone = badge.tone === "connected"
    ? "bg-success-soft text-success"
    : badge.tone === "needs_reconnect"
      ? "bg-danger-soft text-danger"
      : "bg-subtle text-muted";
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold", tone)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", badge.tone === "not_connected" ? "border border-current bg-transparent" : "bg-current")} />
      {badge.label}
    </span>
  );
}

function LegacyNotice({ businessId, onDismissed }: { businessId: string; onDismissed: () => void }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="rounded-card bg-subtle px-3.5 py-3">
      <div className="flex items-start gap-3">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
      <p className="flex-1 text-sm leading-relaxed text-ink">{LEGACY_PIX_NOTICE}</p>
      <button
        type="button"
        aria-busy={pending || undefined}
        onClick={() => {
          setPending(true);
          setFailed(false);
          void fetch(legacyPixDismissUrl(businessId), { method: "POST" })
            .then((response) => {
              if (legacyNoticeAfterDismiss(response.status) === "hidden") {
                onDismissed();
                return;
              }
              setFailed(true);
            })
            .catch(() => setFailed(true))
            .finally(() => setPending(false));
        }}
        className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-ink underline-offset-4 outline-none hover:underline focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
      >
        {pending ? <Loader2 aria-hidden="true" className="mr-1 size-3.5 animate-spin motion-reduce:animate-none" /> : null}
        {pending ? "Entendi…" : "Entendi"}
      </button>
      </div>
      {failed ? <p role="alert" className="mt-2 text-[13px] font-medium text-danger">Não conseguimos dispensar o aviso agora. Tente de novo.</p> : null}
    </div>
  );
}

function DisconnectLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center self-start text-base font-normal text-danger underline decoration-danger/40 underline-offset-4 outline-none hover:decoration-danger focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
    >
      Desconectar
    </button>
  );
}

export function MpConnectionCard({
  businessId,
  status,
  timezone,
  pendingPixCount = 0,
  onStatus,
  initialDisconnectOpen = false,
  returnTo = "/dashboard",
}: {
  businessId: string;
  status: MpOwnerStatus;
  timezone: string;
  pendingPixCount?: number;
  onStatus: (status: MpOwnerStatus) => void;
  initialDisconnectOpen?: boolean;
  returnTo?: MpReturnTo;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackInvalid, setAckInvalid] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(initialDisconnectOpen);
  const [disconnecting, setDisconnecting] = useState(false);
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const requireAck = reconnectRequiresAck(status.consentVersion);
  const since = formatConnectedSince(status.connectedAt, timezone);
  const showNotice = legacyNoticeVisible(status.hadLegacyPixKey, dismissedNotice);
  const account = mpAccountIdentity(status);
  const connected = status.status === "connected";
  const reconnect = status.status === "needs_reconnect";

  async function disconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch(mpConnectionUrl(businessId), { method: "DELETE" });
      if (response.status !== 204) {
        toast("Não conseguimos desconectar agora. Tente de novo.");
        return;
      }
      toast(DISCONNECTED_TOAST);
      setDialogOpen(false);
      onStatus({
        status: "not_connected",
        connectedAt: null,
        expiresAt: null,
        liveMode: null,
        canReceiveDeposits: false,
        hadLegacyPixKey: status.hadLegacyPixKey,
        consentVersion: null,
        accountName: null,
        accountEmailMasked: null,
        accountIdLast4: null,
      });
    } catch {
      toast("Sem internet. Tente de novo quando a conexão voltar.");
    } finally {
      setDisconnecting(false);
    }
  }

  const showAccount = Boolean(account || since);
  const showActions = connected || reconnect;

  return (
    <>
      <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold">Mercado Pago</h3>
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={status.status} />
            {showsTestMode(status.liveMode) ? (
              <span className="inline-flex min-h-7 items-center rounded-full bg-subtle px-2.5 text-xs font-semibold text-ink">modo de teste</span>
            ) : null}
          </span>
        </div>

        {showAccount ? (
          <div className="mt-4">
            {account ? <p className="font-semibold">{account.title}</p> : null}
            {account?.detail ? <p className="mt-0.5 text-sm text-muted">{account.detail}</p> : null}
            {since ? <p className="mt-1 text-[13px] text-muted">Conectado desde {since}</p> : null}
          </div>
        ) : null}

        {showNotice ? (
          <div className="mt-3">
            <LegacyNotice businessId={businessId} onDismissed={() => setDismissedNotice(true)} />
          </div>
        ) : null}

        {connected ? (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-ink">
              O sinal dos clientes cai direto nesta conta. O Mercado Pago desconta a tarifa dele; o AgendaPix não cobra nada sobre o sinal.
            </p>
            <a href={MP_TARIFF_URL} target="_blank" rel="noopener" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink underline underline-offset-4 outline-none focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none">
              Ver tarifas no Mercado Pago
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </div>
        ) : null}

        {reconnect ? (
          <p className="mt-4 text-sm leading-relaxed text-ink">O Mercado Pago encerrou a conexão. Reservas com sinal estão pausadas.</p>
        ) : null}

        {status.status === "not_connected" ? (
          <p className="mt-4 text-sm leading-relaxed text-ink">Conecte para aceitar reservas com sinal. Serviços sem sinal funcionam normalmente.</p>
        ) : null}

        {connected || reconnect ? (
          <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-ink">
            <Undo2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
            <span>
              <strong className="font-semibold">Devoluções:</strong> devolva pelo app ou site do Mercado Pago. O valor sai do saldo da sua conta Mercado Pago. Pix pago depois do prazo para reservar o horário é devolvido sozinho, e você recebe um e-mail.
            </span>
          </p>
        ) : null}

        <div className="mt-4">
          <MpConnectForm
            businessId={businessId}
            returnTo={returnTo}
            requireAck={requireAck}
            acknowledged={acknowledged}
            onAcknowledgedChange={(value) => {
              setAcknowledged(value);
              if (value) setAckInvalid(false);
            }}
            ackInvalid={ackInvalid}
            submitLabel={status.status === "not_connected" ? "Conectar Mercado Pago" : "Reconectar"}
            buttonVariant={reconnect ? "pix" : connected ? "outline" : "pix"}
            onBlocked={() => setAckInvalid(true)}
            beside={showActions ? <DisconnectLink onClick={() => setDialogOpen(true)} /> : null}
          />
        </div>
      </div>
      <MpDisconnectDialog
        open={dialogOpen}
        pending={disconnecting}
        pendingPixCount={pendingPixCount}
        onCancel={() => {
          if (!disconnecting) setDialogOpen(false);
        }}
        onConfirm={() => void disconnect()}
      />
    </>
  );
}

export function MpSettingsCard(props: {
  businessId: string;
  status: MpOwnerStatus;
  timezone: string;
  pendingPixCount?: number;
  onStatus: (status: MpOwnerStatus) => void;
  initialDisconnectOpen?: boolean;
  returnTo?: MpReturnTo;
}) {
  return (
    <section id="recebimento" aria-labelledby="recebimento-title" className="scroll-mt-24">
      <h2 id="recebimento-title" className="font-display text-lg font-bold">Recebimento</h2>
      <div className="mt-3">
        <MpConnectionCard {...props} />
      </div>
    </section>
  );
}
