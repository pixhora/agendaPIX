"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck, CircleX, Info, Percent, TriangleAlert, Undo2, Unplug, Wallet } from "lucide-react";
import { BrandLink } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PERMISSIONS, callbackFocusesAck, formatConnectedSince, presentMpCallback, type MpCallbackView } from "@/lib/mercadopago/contract";
import { MpConnectForm } from "./mp-connect-form";

const KNOW = [
  { icon: Percent, text: "A tarifa do Pix é do Mercado Pago e é descontada da sua conta, conforme o seu contrato com ele." },
  {
    icon: Undo2,
    text: "Devoluções, contestações e MED acontecem na sua conta Mercado Pago. Devoluções dependem de saldo disponível e valem até 180 dias depois do pagamento (regras do Mercado Pago). Se uma devolução automática falhar, você é avisado e devolve manualmente.",
  },
  {
    icon: Info,
    text: "Se você desvincular o AgendaPix direto no Mercado Pago, podemos não conseguir verificar pagamentos: nesse caso, mandamos um e-mail para você conferir e resolver na sua conta.",
  },
  { icon: Wallet, text: "Conecte uma conta sua (ou do seu negócio), com uma chave Pix cadastrada. É nela que os clientes vão pagar.", emphasize: "sua" },
  { icon: Unplug, text: "Você pode desconectar quando quiser, aqui no AgendaPix ou no Mercado Pago. Sem conexão, os serviços com sinal ficam pausados." },
] as const;

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
      <Link href="/termos" className="font-semibold text-ink underline underline-offset-4">Termos de Uso</Link> (seção 5-A) e a{" "}
      <Link href="/privacidade" className="font-semibold text-ink underline underline-offset-4">Política de Privacidade</Link>, e confirma que aceita os termos do Mercado Pago.
    </p>
  );
}

function KnowList() {
  return (
    <section className="mt-5 rounded-card border border-line bg-surface" aria-label="Bom saber">
      <h2 className="border-b border-line px-4 py-3 font-display text-base font-bold">Bom saber</h2>
      <ul className="grid">
        {KNOW.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.text.slice(0, 24)} className="flex min-h-11 items-start gap-3 px-4 py-3">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-pix-soft text-pix">
                <Icon className="size-[18px]" />
              </span>
              <span className="text-sm leading-relaxed text-ink">
                {"emphasize" in item ? (
                  <>
                    Conecte uma conta <strong className="font-semibold">sua</strong> (ou do seu negócio), com uma chave Pix cadastrada. É nela que os clientes vão pagar.
                  </>
                ) : item.text}
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
      <span>
        <strong className="font-semibold">Se pular agora:</strong> sua página fica no ar e serviços sem sinal funcionam. Serviços com sinal ficam indisponíveis até você conectar.
      </span>
    </p>
  );
}

function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="z-20 border-t border-line bg-paper/95 px-5 pt-3 backdrop-blur-md max-md:sticky max-md:bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:mt-6 md:border-0 md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none">
      {children}
    </div>
  );
}

export function MpOnboardingStep({
  businessId,
  legalPagesPublished = false,
  callback = null,
  connectedAt = null,
  onDismissAccount,
}: {
  businessId: string;
  legalPagesPublished?: boolean;
  callback?: MpCallbackView | null;
  connectedAt?: string | null;
  onDismissAccount?: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackBlocked, setAckBlocked] = useState(false);
  const ackInvalid = !acknowledged && (ackBlocked || callbackFocusesAck(callback ?? null));
  const errorTitle = useRef<HTMLHeadingElement>(null);
  const connected = callback?.mp === "connected";
  const errorView = callback?.mp === "error" && !callbackFocusesAck(callback) ? callback : null;
  const since = formatConnectedSince(connectedAt);

  useEffect(() => {
    if (errorView) errorTitle.current?.focus();
  }, [errorView]);

  return (
    <div className="min-h-dvh bg-paper md:py-10" style={{ scrollPaddingBottom: "calc(var(--sticky-cta-height) + 16px)" }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper md:min-h-0 md:rounded-frame md:border md:border-line md:bg-surface md:shadow-[var(--shadow-card)]">
        <header className="flex h-14 shrink-0 items-center justify-between px-4">
          <BrandLink href="/onboarding" label="AgendaPix" />
          <p className="text-xs text-muted">Quase lá · recomendado</p>
        </header>
        {connected ? (
          <ConnectedBody since={since} onDismissAccount={onDismissAccount} />
        ) : (
          <>
            <div className="flex-1 px-5 pt-2 max-md:pb-4">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-pix-soft px-2.5 py-1 text-xs font-semibold text-pix">
                <CircleCheck aria-hidden="true" className="size-3.5" />
                Conta criada
              </p>
              <h1 className="mt-4 font-display text-[28px] font-extrabold leading-[1.12] tracking-tight">Conecte sua conta Mercado Pago para cobrar o sinal</h1>
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
                    <h2 ref={errorTitle} tabIndex={-1} className="font-display text-base font-bold outline-none focus-visible:shadow-[var(--shadow-focus)]">Não deu para conectar</h2>
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
                  O AgendaPix não vê sua senha, não faz transferências nem saques e não cobra taxa sobre o sinal. Só tira dinheiro da sua conta nas duas devoluções acima.
                </p>
              </div>}
              {errorView ? null : <KnowList />}
              <SkipNote />
            </div>
            <ActionBar>
              <MpConnectForm
                businessId={businessId}
                returnTo="/onboarding"
                requireAck
                acknowledged={acknowledged}
                onAcknowledgedChange={setAcknowledged}
                ackInvalid={ackInvalid}
                submitLabel={errorView ? "Tentar de novo" : "Continuar para o Mercado Pago"}
                onBlocked={() => setAckBlocked(true)}
              >
                <div className="mt-4">
                  <ConsentLine published={legalPagesPublished} />
                </div>
              </MpConnectForm>
              <Link
                href="/onboarding/concluir"
                aria-describedby="mp-skip-note"
                className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "mt-1 w-full")}
              >
                Agora não
              </Link>
              <p className="pb-1 text-center text-xs leading-relaxed text-muted">Você será levado ao site do Mercado Pago. Não tem conta? Dá para criar lá.</p>
            </ActionBar>
          </>
        )}
      </div>
    </div>
  );
}

function ConnectedBody({ since, onDismissAccount }: { since: string | null; onDismissAccount?: () => void }) {
  return (
    <>
      <div className="flex-1 px-5 pt-4 max-md:pb-4" role="status">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-pix-soft text-pix">
          <Check className="size-7" strokeWidth={2.5} />
        </span>
        <h1 tabIndex={-1} className="mt-4 font-display text-2xl font-extrabold tracking-tight outline-none">Conta Mercado Pago conectada</h1>
        <p className="mt-2 text-[15px] text-muted">Os Pix de sinal vão cair em:</p>
        <div className="mt-4 rounded-card border border-line bg-paper p-4">
          <p className="font-semibold">Sua conta Mercado Pago</p>
          {since ? <p className="mt-1 text-[13px] text-muted">Conectado desde {since}</p> : null}
        </div>
        {onDismissAccount ? (
          <button type="button" onClick={onDismissAccount} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline-offset-4 outline-none hover:underline focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none">
            Não é essa conta? Desconectar e trocar
          </button>
        ) : null}
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
