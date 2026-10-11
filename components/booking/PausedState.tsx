"use client";

import { useEffect, useRef } from "react";
import { Pause } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import type { PublicService } from "./types";
import { formatCurrency, formatDuration } from "./formatters";
import { whatsappHref } from "./booking-error";
import { BOOKINGS_PAUSED_COPY, BOOKINGS_PAUSED_LATER, BOOKINGS_PAUSED_RECEIPT, TALK_TO_STORE } from "./customer-copy";

interface PausedStateProps {
  businessName: string;
  contactWhatsapp?: string | null;
  services: PublicService[];
  /** Foco no título quando a pausa acontece no meio do fluxo. */
  autoFocus?: boolean;
}

/** Página pública quando o negócio não aceita novos agendamentos. */
export function PausedState({ contactWhatsapp, services, autoFocus = false }: PausedStateProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const href = whatsappHref(contactWhatsapp);

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="space-y-6" data-testid="paused-state">
      <section role="status" className="rounded-frame bg-surface px-6 py-8 text-center shadow-[var(--shadow-card)]">
        <span aria-hidden="true" className="mx-auto flex size-[52px] items-center justify-center rounded-2xl bg-subtle text-ink">
          <Icon icon={Pause} className="size-[22px]" />
        </span>
        <h2 ref={titleRef} tabIndex={-1} className="mx-auto mt-4 max-w-[28ch] font-display text-2xl font-extrabold tracking-tight text-ink outline-none">
          {BOOKINGS_PAUSED_COPY}
        </h2>
        {href ? (
          <Button asChild variant="pixDeep" size="lg" className="mt-6 min-h-[52px] w-full">
            <a href={href} target="_blank" rel="noopener noreferrer">{TALK_TO_STORE}</a>
          </Button>
        ) : (
          <p className="mt-6 text-sm text-muted">{BOOKINGS_PAUSED_LATER}</p>
        )}
        <p className="mt-4 text-[13px] text-muted">{BOOKINGS_PAUSED_RECEIPT}</p>
      </section>

      {services.length > 0 ? (
        <div>
          <h3 className="font-display text-lg font-bold text-ink">Serviços</h3>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {services.map((service) => (
              <li key={service.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
                <span>
                  {service.name} · {formatDuration(service.durationMinutes)}
                </span>
                <span className="shrink-0 tabular-nums">{formatCurrency(service.priceCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
