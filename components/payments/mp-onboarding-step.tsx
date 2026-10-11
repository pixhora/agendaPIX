"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck, CircleX, Info, Percent, TriangleAlert, Undo2, Unplug, Wallet } from "lucide-react";
import { BrandLink } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MP_CONNECT_CONSENT_VERSION } from "@/lib/mercadopago/consent";
import { PERMISSIONS, callbackFocusesAck, presentMpCallback, type MpCallbackView, type MpOwnerStatus } from "@/lib/mercadopago/contract";
import { MP_GOOD_TO_KNOW } from "@/lib/mercadopago/connect-copy";
import { MpConnectForm } from "./mp-connect-form";
import { MpConnectionCard } from "./mp-settings-card";

const KNOW_ICONS = [Percent, Undo2, Info, Wallet, Unplug] as const;

function ConsentLine({ published }: { published: boolean }) {
  if (!published) {
    return (
      <p className="text-[13px] leading-relaxed text-ink/80">
        Ao continuar, você autoriza o AgendaPix a usar sua conta Mercado Pago só para as ações acima e confirma que aceita os termos do Mercado Pago.
      </p>
    );
  }
  return (
    <p className="text-[13px] leading-relaxed text-ink/80">
      Ao continuar, você autoriza o AgendaPix a usar sua conta Mercado Pago só para as ações acima, conforme os{" "}
      <Link href="/termos#5-a" className="font-semibold text-ink underline underline-offset-4">Termos de Uso (seção 5-A)</Link> e a{" "}
      <Link href="/privacidade" className="font-semibold text-ink underline underline-offset-4">Política de Privacidade</Link>, e confirma que aceita os termos do Mercado Pago.
    </p>
  );
}

function KnowList() {
  return (
    <section className="mt-5 rounded-card border border-line bg-surface" aria-label="Bom saber">
      <h2 className="border-b border-line px-4 py-3 font-display text-base font-bold">Bom saber</h2>
      <ul className="grid">
        {MP_GOOD_TO_KNOW.map((text, index) => {
          const Icon = KNOW_ICONS[index];
          const ownAccount = text.startsWith("Conecte uma conta sua");
          return (
            <li key={text.slice(0, 24)} className="flex min-h-11 items-start gap-3 px-4 py-3">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-pix-soft text-pix">
                <Icon className="size-[18px]" />
              </span>
              <span className="text-sm leading-relaxed text-ink">
                {ownAccount ? (
                  <>
                    Conecte uma conta <strong className="font-semibold">sua</strong>
                    {text.slice("Conecte uma conta sua".length)}
                  </>
                ) : text}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SkipNote() {
  return (
    <p id="mp-skip-note" className="mt-4 flex items-start gap-2 rounded-card bg-warning-soft px-3.5 py-3 text-sm leading-relaxed text-ink">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>Se fizer depois, sua página já fica no ar e os serviços sem sinal podem ser agendados. Os serviços com sinal aparecem como indisponíveis até você conectar.</span>
    </p>
  );
}

function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="z-20 shrink-0 border-t border-line bg-paper/95 px-5 pt-3 backdrop-blur-md max-md:sticky max-md:bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:mt-6 md:border-0 md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none">
      {children}
    </div>
  );
}

export function MpOnboardingStep({
  businessId,
  legalPagesPublished = false,
  callback = null,
  connectedAt = null,
  accountName = null,
  accountEmailMasked = null,
  accountIdLast4 = null,
  ownerStatus = null,
  onDisconnected,
}: {
  businessId: string;
  legalPagesPublished?: boolean;
  callback?: MpCallbackView | null;
  connectedAt?: string | null;
  accountName?: string | null;
  accountEmailMasked?: string | null;
  accountIdLast4?: string | null;
  ownerStatus?: MpOwnerStatus | null;
  onDisconnected?: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackBlocked, setAckBlocked] = useState(false);
  const ackInvalid = !acknowledged && (ackBlocked || callbackFocusesAck(callback ?? null));
  const errorTitle = useRef<HTMLHeadingElement>(null);
  const viewStatus = ownerStatus ?? (callback?.mp === "connected" ? connectedOwnerStatus({
    connectedAt,
    accountName,
    accountEmailMasked,
    accountIdLast4,
  }) : null);
  const connected = callback?.mp === "connected" && viewStatus?.status === "connected";
  const errorView = callback?.mp === "error" && !callbackFocusesAck(callback) ? callback : null;

  useEffect(() => {
    if (errorView) errorTitle.current?.focus();
  }, [errorView]);

  return (
    <div className="bg-paper max-md:fixed max-md:inset-0 max-md:overflow-hidden md:static md:min-h-dvh md:py-10" style={{ scrollPaddingBottom: "calc(var(--sticky-cta-height) + 16px)" }}>
      <div className="mx-auto flex w-full max-w-[480px] flex-col bg-paper max-md:h-full max-md:overflow-hidden md:min-h-0 md:rounded-frame md:border md:border-line md:bg-surface md:shadow-[var(--shadow-card)]">
        <header className="flex h-14 shrink-0 items-center px-4">
          <BrandLink href="/onboarding" />
        </header>
        {connected ? (
          <ConnectedBody
            businessId={businessId}
            status={viewStatus}
            onStatus={(next) => {
              if (next.status === "not_connected") onDisconnected?.();
            }}
          />
        ) : (
          <MpConnectForm
            businessId={businessId}
            returnTo="/onboarding"
            requireAck
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            ackInvalid={ackInvalid}
            submitLabel={errorView ? "Tentar de novo" : "Continuar para o Mercado Pago"}
            onBlocked={() => setAckBlocked(true)}
            pinActions
            lead={
              <>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-pix-soft px-2.5 py-1 text-xs font-semibold text-pix">
                <CircleCheck aria-hidden="true" className="size-3.5" />
                Conta criada
              </p>
              <h1 className="mt-4 font-display text-[28px] font-extrabold leading-[1.12] tracking-tight">Último passo: receber o sinal no Pix</h1>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                O Pix do sinal vai cair direto na <strong className="font-semibold text-ink">sua</strong> conta Mercado Pago. O AgendaPix não recebe, não guarda e não transfere esse dinheiro.
              </p>
              <div className="mt-5 flex items-stretch gap-2" aria-hidden="true">
                <div className="flex-1 rounded-card border border-line bg-surface px-3 py-3 text-center">
                  <p className="text-sm font-semibold">Cliente</p>
                  <p className="text-xs text-muted">paga o Pix</p>
                </div>
                <ArrowRight aria-hidden="true" className="mt-4 size-4 shrink-0 text-muted" />
                <div className="flex-1 rounded-card bg-pix-soft px-3 py-3 text-center text-pix">
                  <p className="text-sm font-semibold">Sua conta Mercado Pago</p>
                  <p className="text-xs">recebe direto</p>
                </div>
              </div>
              <p className="sr-only">O cliente paga o Pix e o valor cai direto na sua conta Mercado Pago.</p>
              {errorView ? (
                <div
                  role="alert"
                  className={cn(
                    "mt-5 flex items-start gap-3 rounded-card p-4",
                    errorView.tone === "danger" ? "bg-danger-soft" : "bg-warning-soft",
                  )}
                >
                  {errorView.tone === "danger" ? <CircleX aria-hidden="true" className="size-5 shrink-0 text-danger" /> : <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-warning" />}
                  <div>
                    <h2 ref={errorTitle} tabIndex={-1} className="font-display text-base font-bold outline-none">Não deu para conectar</h2>
                    <p className="mt-1 text-sm leading-relaxed text-ink">{errorView.message}</p>
                  </div>
                </div>
              ) : null}
              {errorView ? null : <div className="mt-5">
                <p className="text-sm font-semibold leading-relaxed">Na próxima tela, no site do Mercado Pago, você entra na sua conta e autoriza o AgendaPix a:</p>
                <ul className="mt-3 grid gap-2.5">
                  {PERMISSIONS.map((item) => (
                    <li key={item.strong} className="flex items-start gap-2 text-sm leading-relaxed">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />
                      <span><strong className="font-semibold">{item.strong}</strong>{item.rest}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  O AgendaPix não vê sua senha, não faz transferências nem saques e não cobra taxa sobre o sinal. Só tira dinheiro da sua conta na devolução automática acima.
                </p>
              </div>}
              {errorView ? null : <KnowList />}
              <SkipNote />
              </>
            }
            footer={
              <>
                <Link
                  href="/onboarding/concluir"
                  aria-describedby="mp-skip-note"
                  className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "mt-1 w-full")}
                >
                  Fazer depois
                </Link>
                <p className="pb-1 text-center text-xs leading-relaxed text-muted">Você será levado ao site do Mercado Pago. Não tem conta? Dá para criar lá.</p>
              </>
            }
          >
            <div className="mt-4">
              <ConsentLine published={legalPagesPublished} />
            </div>
          </MpConnectForm>
        )}
      </div>
    </div>
  );
}

function connectedOwnerStatus(input: {
  connectedAt: string | null;
  accountName: string | null;
  accountEmailMasked: string | null;
  accountIdLast4: string | null;
}): MpOwnerStatus {
  return {
    status: "connected",
    connectedAt: input.connectedAt,
    expiresAt: null,
    liveMode: true,
    canReceiveDeposits: true,
    hadLegacyPixKey: false,
    consentVersion: MP_CONNECT_CONSENT_VERSION,
    accountName: input.accountName,
    accountEmailMasked: input.accountEmailMasked,
    accountIdLast4: input.accountIdLast4,
  };
}

function ConnectedBody({
  businessId,
  status,
  onStatus,
}: {
  businessId: string;
  status: MpOwnerStatus | null;
  onStatus: (status: MpOwnerStatus) => void;
}) {
  if (!status) return null;
  return (
    <>
      <div data-mp-scroll="" className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 max-md:pb-4 md:overflow-visible" role="status">
        <MpConnectionCard
          businessId={businessId}
          status={status}
          timezone="America/Sao_Paulo"
          onStatus={onStatus}
          returnTo="/onboarding"
        />
      </div>
      <ActionBar>
        <Link href="/onboarding/concluir" className={cn(buttonVariants({ size: "lg" }), "w-full")}>Continuar</Link>
      </ActionBar>
    </>
  );
}

export function onboardingCallbackFromSearch(mp: string | null, reason: string | null): MpCallbackView | null {
  return presentMpCallback(mp, reason);
}
