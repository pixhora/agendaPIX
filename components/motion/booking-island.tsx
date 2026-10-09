/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

import "@/app/motion-base.css";
import "@/app/motion/island.css";

import { cn } from "@/lib/utils";
import { InView } from "@/components/motion/in-view";

export type BookingIslandProps = {
  compactLabel: string;
  guestName: string;
  serviceName: string;
  whenLabel: string;
  statusLabel: string;
  /** Nome acessível do bloco decorativo. */
  label: string;
  className?: string;
};

/** Pílula dentro de um celular. Abre do aviso curto para o cartão da reserva. */
export function BookingIsland({
  compactLabel,
  guestName,
  serviceName,
  whenLabel,
  statusLabel,
  label,
  className,
}: BookingIslandProps) {
  return (
    <InView role="img" aria-label={label} data-testid="booking-island" className={cn("booking-island mx-auto w-full max-w-[280px]", className)}>
      <div aria-hidden="true" className="rounded-frame bg-paper p-3 shadow-card ring-1 ring-line">
        <div className="rounded-card bg-brand-tile px-3 pt-4 pb-6 shadow-[inset_0_0_0_1px_var(--brand-tile-edge)]">
          <div className="phone-speaker mx-auto mb-4 h-1.5 w-16 rounded-full" />
          <div className="island-shell">
            <div className="island-body overflow-hidden rounded-slab bg-brand-tile-foreground text-brand-tile">
              <p className="island-compact font-display text-sm font-bold">{compactLabel}</p>
              <div className="island-detail px-3 py-3">
                <p className="text-sm font-semibold leading-snug">
                  {guestName} · {serviceName} · <span className="tabular-nums">{whenLabel}</span>
                </p>
                <p className="mt-2 inline-flex min-h-6 items-center rounded-full bg-pix-bright px-2.5 text-xs font-semibold text-pix-bright-foreground">
                  {statusLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </InView>
  );
}
