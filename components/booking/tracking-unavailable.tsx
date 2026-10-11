"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TRACKING_ASK_STORE, TRACKING_LINK_UPDATED, TALK_TO_STORE } from "./customer-copy";
import { whatsappHref } from "./booking-error";

/** 404 `booking_not_found` do acompanhamento. Sem slug, não há WhatsApp para abrir. */
export function TrackingUnavailable({
  slug,
  whatsapp,
}: {
  slug: string | null;
  whatsapp?: string | null;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const href = slug && slug.length > 0 ? whatsappHref(whatsapp) : null;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section data-testid="tracking-unavailable" className="rounded-frame bg-surface px-6 py-8 text-center shadow-[var(--shadow-card)]">
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="mx-auto max-w-[28ch] font-display text-xl font-extrabold tracking-tight text-ink outline-none sm:text-2xl"
      >
        {TRACKING_LINK_UPDATED}
      </h1>
      {href ? (
        <Button asChild variant="pix" size="lg" className="mt-6 w-full">
          <a href={href}>{TALK_TO_STORE}</a>
        </Button>
      ) : (
        <p className="mx-auto mt-4 max-w-[36ch] text-sm leading-relaxed text-muted">{TRACKING_ASK_STORE}</p>
      )}
    </section>
  );
}
