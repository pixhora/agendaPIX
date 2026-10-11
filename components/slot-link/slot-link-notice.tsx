"use client";

import { useEffect, useRef } from "react";
import { Clock, Link2Off, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CONTINUE_PAYMENT,
  CUSTOMER_CONFLICT_BODY,
  CUSTOMER_CONFLICT_TITLE,
  CUSTOMER_EXPIRED_TITLE,
  CUSTOMER_IN_PROGRESS,
  CUSTOMER_MP,
  CUSTOMER_OFFLINE,
  CUSTOMER_TAKEN_BODY,
  CUSTOMER_TAKEN_TITLE,
  CUSTOMER_GENERIC,
  CUSTOMER_UNAVAILABLE_TITLE,
  CUSTOMER_USED_HINT,
  CUSTOMER_USED_TITLE,
  SEE_SLOTS,
  TALK_TO_STORE,
  TRY_AGAIN,
  expiredBody,
  updatedLinkMessage,
} from "@/lib/slot-link/copy";
import type { CustomerScreen } from "@/lib/slot-link/customer-state";
import { whatsAppStoreHref } from "@/lib/slot-link/share";

type Notice = Exclude<CustomerScreen, { kind: "form" }>;

export function SlotLinkNotice({
  screen,
  onRetry,
  onContinue,
}: {
  screen: Notice;
  /** "Tentar de novo" do horário em pagamento: refaz a leitura e o pagamento. */
  onRetry?: () => void;
  /** "Continuar pagamento": reenvia o payload salvo e volta ao mesmo Pix. */
  onContinue?: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, [screen.kind]);

  const publicPath = screen.publicPath;
  const slots = (
    <Button asChild variant="pix" size="lg" className="w-full">
      <a href={publicPath} referrerPolicy="no-referrer">{SEE_SLOTS}</a>
    </Button>
  );

  if (screen.kind === "expired") {
    const whatsapp = whatsAppStoreHref(screen.whatsapp);
    return (
      <NoticeFrame titleRef={titleRef} title={CUSTOMER_EXPIRED_TITLE} icon={<Clock aria-hidden="true" className="size-8" />}>
        <p className="text-sm text-muted">{expiredBody(screen.businessName)}</p>
        <div className="grid gap-2">
          {slots}
          {whatsapp ? (
            <Button asChild variant="outline" size="lg" className="w-full">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{TALK_TO_STORE}</a>
            </Button>
          ) : null}
        </div>
      </NoticeFrame>
    );
  }

  if (screen.kind === "taken") {
    return (
      <NoticeFrame titleRef={titleRef} title={CUSTOMER_TAKEN_TITLE} icon={<Clock aria-hidden="true" className="size-8" />}>
        <p className="text-sm text-muted">{CUSTOMER_TAKEN_BODY}</p>
        {slots}
      </NoticeFrame>
    );
  }

  if (screen.kind === "used") {
    return (
      <NoticeFrame titleRef={titleRef} title={CUSTOMER_USED_TITLE} icon={<Clock aria-hidden="true" className="size-8" />}>
        <p className="text-sm text-muted">{CUSTOMER_USED_HINT}</p>
        {slots}
      </NoticeFrame>
    );
  }

  if (screen.kind === "offline") {
    return (
      <NoticeFrame titleRef={titleRef} title={CUSTOMER_OFFLINE} icon={<WifiOff aria-hidden="true" className="size-8" />}>
        {onRetry ? <Button type="button" variant="pix" size="lg" className="w-full" onClick={onRetry}>{TRY_AGAIN}</Button> : null}
      </NoticeFrame>
    );
  }

  if (screen.kind === "mp") {
    const whatsapp = whatsAppStoreHref(screen.whatsapp);
    return (
      <NoticeFrame titleRef={titleRef} title={CUSTOMER_MP} icon={<Link2Off aria-hidden="true" className="size-8" />}>
        <div className="grid gap-2">
          {whatsapp ? (
            <Button asChild variant="pix" size="lg" className="w-full">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{TALK_TO_STORE}</a>
            </Button>
          ) : null}
          {slots}
        </div>
      </NoticeFrame>
    );
  }

  if (screen.kind === "error") {
    return (
      <NoticeFrame titleRef={titleRef} title={CUSTOMER_GENERIC} icon={<Link2Off aria-hidden="true" className="size-8" />}>
        {onRetry ? <Button type="button" variant="pix" size="lg" className="w-full" onClick={onRetry}>{TRY_AGAIN}</Button> : null}
      </NoticeFrame>
    );
  }

  if (screen.kind === "conflict") {
    return (
      <NoticeFrame titleRef={titleRef} title={CUSTOMER_CONFLICT_TITLE} icon={<Clock aria-hidden="true" className="size-8" />}>
        <p className="text-sm text-muted">{CUSTOMER_CONFLICT_BODY}</p>
        <div className="grid gap-2">
          {onContinue ? (
            <Button type="button" variant="pix" size="lg" className="w-full" onClick={onContinue}>{CONTINUE_PAYMENT}</Button>
          ) : null}
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href={publicPath} referrerPolicy="no-referrer">{SEE_SLOTS}</a>
          </Button>
        </div>
      </NoticeFrame>
    );
  }

  if (screen.kind === "in_progress") {
    return (
      <NoticeFrame titleRef={titleRef} title={CUSTOMER_IN_PROGRESS} icon={<Clock aria-hidden="true" className="size-8" />}>
        <div className="grid gap-2">
          {onRetry ? <Button type="button" variant="pix" size="lg" className="w-full" onClick={onRetry}>{TRY_AGAIN}</Button> : null}
          {slots}
        </div>
      </NoticeFrame>
    );
  }

  if (screen.kind === "updated") {
    const whatsapp = whatsAppStoreHref(screen.whatsapp);
    return (
      <NoticeFrame titleRef={titleRef} title={updatedLinkMessage(screen.businessName)} icon={<Link2Off aria-hidden="true" className="size-8" />}>
        <div className="grid gap-2">
          {whatsapp ? (
            <Button asChild variant="pix" size="lg" className="w-full">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{TALK_TO_STORE}</a>
            </Button>
          ) : null}
          {whatsapp ? (
            <Button asChild variant="outline" size="lg" className="w-full">
              <a href={publicPath} referrerPolicy="no-referrer">{SEE_SLOTS}</a>
            </Button>
          ) : slots}
        </div>
      </NoticeFrame>
    );
  }

  return (
    <NoticeFrame titleRef={titleRef} title={CUSTOMER_UNAVAILABLE_TITLE} icon={<Link2Off aria-hidden="true" className="size-8" />}>
      {slots}
    </NoticeFrame>
  );
}

function NoticeFrame({
  titleRef,
  title,
  icon,
  children,
}: {
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto grid w-full max-w-md gap-4 rounded-card border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]" data-testid="slot-link-screen">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-subtle text-ink">{icon}</div>
      <h1 ref={titleRef} tabIndex={-1} className="font-display text-2xl font-extrabold tracking-tight text-ink outline-none">
        {title}
      </h1>
      {children}
    </section>
  );
}
