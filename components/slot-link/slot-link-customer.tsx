"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BusinessAvatar } from "@/components/ui/business-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";
import { StepPayment } from "@/components/booking/StepPayment";
import { cpfDigitsOnly, formatCpfMask, formatCurrency, formatDuration, formatPhoneMask, isValidBrazilianPhone, isValidCpf, normalizePhoneToE164 } from "@/components/booking/formatters";
import type { BookingResponse, PublicService } from "@/components/booking/types";
import { publicBookingPagePath } from "@/lib/public-api";
import { pixResumePayload, pixResumeStorageKey } from "@/components/booking/pix-resume";
import type { SlotLinkOpenResponse } from "@/lib/contracts/slot-link";
import { POLICY_CHECK, localDateParts, payButtonLabel } from "@/lib/slot-link/copy";
import {
  failureCode,
  parseOpenLink,
  screenFromFailure,
  screenFromStatus,
  shouldClearPayKey,
  type CustomerScreen,
} from "@/lib/slot-link/customer-state";
import { browserSlotLinkStores, clearPayKey, lockPayPayload, payRequestBody, readPayResume, savePayAccess, type SlotLinkPayDraft, type SlotLinkPayPayload, type SlotLinkPayStores } from "@/lib/slot-link/idempotency";
import { paySlotLinkUrl, publicSlotLinkUrl } from "@/lib/slot-link/paths";
import { isOfflineError } from "@/components/booking/booking-error";
import { AgendaPixFooter } from "./agenda-pix-footer";
import { parsePayResult } from "./pay-result";
import { SlotLinkNotice } from "./slot-link-notice";

type Phase =
  | { kind: "loading" }
  | CustomerScreen
  | { kind: "pix"; link: SlotLinkOpenResponse; booking: BookingResponse }
  | { kind: "confirmed"; link: SlotLinkOpenResponse; booking: BookingResponse; customerName: string; customerPhone: string };

type StoreContext = { publicPath: string; businessName: string | null; whatsapp: string | null; startsAt: string | null };

export function SlotLinkCustomer({
  slug,
  token,
  timezone,
  stores,
  fetchImpl,
  now = () => new Date(),
}: {
  slug: string;
  token: string;
  timezone: string;
  stores?: SlotLinkPayStores;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}) {
  const [fallbackStores] = useState<SlotLinkPayStores>(() => browserSlotLinkStores());
  const payStores = stores ?? fallbackStores;
  const request = fetchImpl ?? fetch;
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [savedPayload, setSavedPayload] = useState<SlotLinkPayPayload | null>(null);
  const linkRef = React.useRef<SlotLinkOpenResponse | null>(null);
  const publicPath = `/${slug}`;

  const rememberStore = useCallback((link: SlotLinkOpenResponse): StoreContext => ({
    publicPath: link.business.publicPath || publicPath,
    businessName: link.business.name,
    whatsapp: link.business.contactWhatsapp,
    startsAt: link.startsAt,
  }), [publicPath]);

  const [known, setKnown] = useState<StoreContext>({ publicPath, businessName: null, whatsapp: null, startsAt: null });
  const knownRef = React.useRef(known);
  const nowRef = React.useRef(now);
  useEffect(() => {
    knownRef.current = known;
    nowRef.current = now;
  }, [known, now]);

  const applyScreen = useCallback(async (screen: CustomerScreen) => {
    if (shouldClearPayKey(screen)) {
      const saved = await readPayResume(token, payStores, nowRef.current().getTime());
      await clearPayKey(token, payStores);
      setSavedPayload(null);
      if (screen.kind === "used" && saved?.accessToken && saved.bookingId && saved.serviceId) {
        try {
          sessionStorage.setItem(pixResumeStorageKey(slug), pixResumePayload({
            bookingId: saved.bookingId,
            accessToken: saved.accessToken,
            expiresAt: saved.expiresAt ?? null,
            serviceId: saved.serviceId,
          }));
        } catch {
          setPhase(screen);
          return;
        }
        window.location.assign(publicBookingPagePath(slug, saved.bookingId));
        return;
      }
    }
    setPhase(screen);
  }, [payStores, slug, token]);

  const load = useCallback(async () => {
    const context = knownRef.current;
    const clock = nowRef.current;
    try {
      const response = await request(publicSlotLinkUrl(slug, token), { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = failureCode(response.status, body);
        const screen = screenFromFailure(code === "unknown" ? "link_invalid" : code, { ...context, now: clock() });
        await applyScreen(screen);
        return screen;
      }
      const opened = parseOpenLink(body);
      linkRef.current = opened;
      const next = rememberStore(opened);
      knownRef.current = next;
      setKnown(next);
      const saved = await readPayResume(token, payStores, clock().getTime());
      setSavedPayload(saved?.payload ?? null);
      const screen = screenFromStatus(opened, clock(), { resumePay: Boolean(saved?.idempotencyKey) });
      await applyScreen(screen);
      return screen;
    } catch (error) {
      const screen: CustomerScreen = isOfflineError(error)
        ? { kind: "offline", publicPath: context.publicPath }
        : screenFromFailure("unknown", { ...context, now: clock() });
      await applyScreen(screen);
      return screen;
    }
  }, [applyScreen, payStores, rememberStore, request, slug, token]);

  useEffect(() => {
    let cancelled = false;
    void load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function pay(link: SlotLinkOpenResponse) {
    if (!link.policy) return;
    setSubmitting(true);
    try {
      const fresh = await load();
      if (fresh.kind !== "form") return;
      const draft: SlotLinkPayDraft = {
        customer: {
          name: name.trim(),
          phone: normalizePhoneToE164(phone),
          ...(link.requiresPayerCpf ? { cpfCnpj: cpfDigitsOnly(cpf) } : {}),
        },
        policyHash: link.policy.hash,
      };
      const locked = await lockPayPayload(token, payStores, draft, link.expiresAt, undefined, now().getTime());
      if (!locked) {
        await applyScreen(screenFromFailure("link_expired", {
          publicPath: link.business.publicPath,
          businessName: link.business.name,
          whatsapp: link.business.contactWhatsapp,
          startsAt: link.startsAt,
          now: now(),
        }));
        return;
      }
      setSavedPayload(locked.payload);
      const opened = await postPay(locked.record.idempotencyKey, locked.fresh ? draft : locked.payload);
      if (opened) setPhase({ kind: "pix", link, booking: opened });
    } catch (error) {
      if (isOfflineError(error)) setPhase({ kind: "offline", publicPath: link.business.publicPath });
      else setPhase({ kind: "offline", publicPath: link.business.publicPath });
    } finally {
      setSubmitting(false);
    }
  }

  async function postPay(idempotencyKey: string, payload: SlotLinkPayDraft) {
    const response = await request(paySlotLinkUrl(slug, token), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payRequestBody(payload)),
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 201) {
      const booking = parsePayResult(body);
      const current = linkRef.current;
      await savePayAccess(token, payStores, {
        bookingId: booking.bookingId,
        accessToken: booking.accessToken,
        expiresAt: booking.expiresAt,
        serviceId: current?.service.id ?? "",
      }, now().getTime());
      return booking;
    }
    const current = linkRef.current;
    const code = failureCode(response.status, body);
    const screen = screenFromFailure(code, {
      publicPath: current?.business.publicPath ?? publicPath,
      businessName: current?.business.name,
      whatsapp: current?.business.contactWhatsapp,
      startsAt: current?.startsAt,
      now: now(),
    });
    await applyScreen(screen);
    return null;
  }

  async function retryPay() {
    const screen = await load();
    if (screen.kind === "form") await pay(screen.link);
  }

  async function continueSavedPay() {
    if (submitting) return;
    const saved = await readPayResume(token, payStores, now().getTime());
    const current = linkRef.current;
    if (!saved?.payload || !current) return;
    setSubmitting(true);
    try {
      const booking = await postPay(saved.idempotencyKey, saved.payload);
      if (booking) setPhase({ kind: "pix", link: current, booking });
    } catch (error) {
      if (isOfflineError(error)) setPhase({ kind: "offline", publicPath: current.business.publicPath });
      else setPhase({ kind: "offline", publicPath: current.business.publicPath });
    } finally {
      setSubmitting(false);
    }
  }

  const link = phase.kind === "form" || phase.kind === "pix" || phase.kind === "confirmed" ? phase.link : null;
  const when = link ? localDateParts(link.startsAt, timezone) : null;
  const askCpf = link?.requiresPayerCpf === true;
  const locked = Boolean(savedPayload);
  const nameOk = locked || name.trim().length >= 2;
  const phoneOk = locked || isValidBrazilianPhone(phone);
  const cpfOk = locked || !askCpf || isValidCpf(cpf);
  const canPay = Boolean(link?.policy) && accepted && nameOk && phoneOk && cpfOk && !submitting;
  const payerName = savedPayload?.customer.name ?? name;
  const payerPhone = savedPayload ? formatPhoneMask(savedPayload.customer.phone) : phone;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <BusinessAvatar name={link?.business.name} logoUrl={link?.business.logoUrl} />
            {phase.kind === "loading" || phase.kind === "form" || phase.kind === "pix" || phase.kind === "confirmed" ? (
              <h1 className="truncate font-display text-lg font-extrabold tracking-tight text-ink">
                {link?.business.name ?? <span className="inline-block h-5 w-40 animate-pulse rounded bg-subtle motion-reduce:animate-none" />}
              </h1>
            ) : (
              <p className="truncate font-display text-lg font-extrabold tracking-tight text-ink">{known.businessName}</p>
            )}
          </div>
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
      </header>
      <main id="content" className="mx-auto w-full max-w-xl px-4 py-6">
        {phase.kind === "loading" ? <CardSkeleton /> : null}
        {phase.kind !== "loading" && phase.kind !== "form" && phase.kind !== "pix" && phase.kind !== "confirmed" ? (
          <SlotLinkNotice
            screen={phase}
            onRetry={phase.kind === "offline" || phase.kind === "in_progress" || phase.kind === "error"
              ? () => void (phase.kind === "in_progress" ? retryPay() : load())
              : undefined}
            onContinue={phase.kind === "conflict" ? () => void continueSavedPay() : undefined}
          />
        ) : null}
        {phase.kind === "form" && link && when ? (
          <form
            className="grid gap-5"
            data-testid="slot-link-screen"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (canPay) void pay(link);
            }}
          >
            <article className="grid gap-3 rounded-card border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <p className="text-sm font-semibold text-ink">{link.service.name}</p>
              <p className="text-sm text-muted">{formatDuration(link.service.durationMinutes)}</p>
              <p className="font-display text-3xl font-extrabold capitalize tracking-tight text-ink">{when.weekday}, {when.day}/{when.month}</p>
              <p className="font-display text-4xl font-extrabold tabular-nums tracking-tight text-ink">{when.time}</p>
              <p className="text-sm text-muted">Preço total {formatCurrency(link.service.priceCents)}</p>
              <p className="text-base font-semibold text-ink">Sinal agora: {formatCurrency(link.depositCents)} no Pix</p>
              {link.remainingCents > 0 ? <p className="text-sm text-muted">Restante {formatCurrency(link.remainingCents)} no dia do atendimento</p> : null}
            </article>
            {link.policy ? (
              <fieldset className="grid gap-3 rounded-card border border-line bg-surface p-5">
                <legend className="px-1 text-sm font-semibold text-ink">Antes de pagar</legend>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{link.policy.text}</p>
                <label htmlFor="slot-policy" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
                  <input
                    id="slot-policy"
                    type="checkbox"
                    className="size-5 accent-pix"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                  />
                  {POLICY_CHECK}
                </label>
              </fieldset>
            ) : <p role="alert" className="text-sm text-warning">Não conseguimos carregar as regras do sinal. Tente de novo.</p>}
            {savedPayload ? (
              <LockedPayer name={savedPayload.customer.name} phone={formatPhoneMask(savedPayload.customer.phone)} />
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="slot-customer-name">Nome</Label>
                  <Input id="slot-customer-name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
                  {touched && !nameOk ? <p className="text-sm text-danger">Informe seu nome (pelo menos 2 letras).</p> : null}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="slot-customer-phone">WhatsApp</Label>
                  <Input id="slot-customer-phone" inputMode="tel" autoComplete="off" value={phone} onChange={(event) => setPhone(formatPhoneMask(event.target.value))} />
                  {touched && !phoneOk ? <p className="text-sm text-danger">Informe um celular válido com DDD.</p> : null}
                </div>
                {askCpf ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="slot-customer-cpf">CPF</Label>
                    <Input id="slot-customer-cpf" inputMode="numeric" autoComplete="off" value={cpf} onChange={(event) => setCpf(formatCpfMask(event.target.value))} />
                    {touched && !cpfOk ? <p className="text-sm text-danger">Informe um CPF válido.</p> : null}
                  </div>
                ) : null}
              </div>
            )}
            {touched && !accepted ? <p className="text-sm text-danger">Marque que você leu a política.</p> : null}
            <Button type="submit" variant="pix" size="lg" className="w-full" disabled={submitting || !link.policy}>
              {submitting ? "Gerando…" : payButtonLabel(link.depositCents)}
            </Button>
            <p className="text-center text-sm text-muted">
              Prefere outro horário?{" "}
              <a className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4" href={link.business.publicPath} referrerPolicy="no-referrer">
                Ver agenda da loja
              </a>
            </p>
          </form>
        ) : null}
        {phase.kind === "pix" ? (
          <>
            {savedPayload ? <LockedPayer name={savedPayload.customer.name} phone={formatPhoneMask(savedPayload.customer.phone)} /> : null}
            <StepPayment
              slug={slug}
              booking={phase.booking}
              summary={{ service: serviceFrom(phase.link), slot: { startsAt: phase.link.startsAt, endsAt: phase.booking.endsAt }, timezone }}
              businessName={phase.link.business.name}
              contactWhatsapp={phase.link.business.contactWhatsapp}
              onPaymentConfirmed={() => {
                void clearPayKey(token, payStores);
                setSavedPayload(null);
                setPhase({ kind: "confirmed", link: phase.link, booking: phase.booking, customerName: payerName, customerPhone: payerPhone });
              }}
              onRestart={() => { void load(); }}
            />
          </>
        ) : null}
        {phase.kind === "confirmed" ? (
          <>
            <BookingConfirmation
              businessName={phase.link.business.name}
              service={serviceFrom(phase.link)}
              slot={{ startsAt: phase.link.startsAt, endsAt: phase.booking.endsAt }}
              timezone={timezone}
              customerName={phase.customerName}
              customerPhone={phase.customerPhone}
              policy={phase.booking.policy}
              policyText={phase.booking.policy?.text}
              contactWhatsapp={phase.link.business.contactWhatsapp}
              onNewBooking={() => { window.location.assign(phase.link.business.publicPath); }}
            />
            <AgendaPixFooter campaign="reserva_confirmada" />
          </>
        ) : null}
      </main>
    </div>
  );
}

function LockedPayer({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="grid gap-3 rounded-card border border-line bg-surface p-5" data-testid="slot-link-payer">
      <div>
        <p className="text-sm font-semibold text-muted">Nome</p>
        <p className="text-base font-semibold text-ink">{name}</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-muted">WhatsApp</p>
        <p className="text-base font-semibold text-ink">{phone}</p>
      </div>
    </div>
  );
}

function serviceFrom(link: SlotLinkOpenResponse): PublicService {
  return {
    id: link.service.id,
    name: link.service.name,
    durationMinutes: link.service.durationMinutes,
    priceCents: link.service.priceCents,
    depositCents: link.depositCents,
    policySummary: link.policy?.text ?? null,
    policyHash: link.policy?.hash ?? null,
  };
}

function CardSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Carregando horário" data-testid="slot-link-screen">
      <Skeleton className="h-48 w-full rounded-card" />
      <Skeleton className="h-24 w-full rounded-card" />
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}
