"use client";

import { useEffect, useRef } from "react";
import { MessageCircle, Pause } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import type { PublicService } from "./types";
import { formatCurrency, formatDuration } from "./formatters";
import { whatsappHref } from "./booking-error";

interface PausedStateProps {
  businessName: string;
  contactWhatsapp?: string | null;
  services: PublicService[];
  /** Foco no título quando a pausa acontece no meio do fluxo. */
  autoFocus?: boolean;
}

const PAUSED_WHATSAPP_TEXT = (businessName: string) =>
  `Olá, ${businessName}! Vi sua página de agendamento e queria marcar um horário.`;

/** Página pública quando o negócio não aceita novos agendamentos. */
export function PausedState({ businessName, contactWhatsapp, services, autoFocus = false }: PausedStateProps) {
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
        <h2 ref={titleRef} tabIndex={-1} className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink outline-none">
          Agendamento online pausado
        </h2>
        <p className="mx-auto mt-3 max-w-[34ch] text-[15px] leading-relaxed text-muted">
          O {businessName} não está recebendo novos agendamentos por aqui no momento. Quem já agendou continua com o horário garantido.
        </p>
        {href ? (
          <Button asChild size="lg" className="mt-6 min-h-[52px] w-full">
            <a href={`${href}?text=${encodeURIComponent(PAUSED_WHATSAPP_TEXT(businessName))}`}>
              <Icon icon={MessageCircle} size="md" />
              Chamar no WhatsApp
            </a>
          </Button>
        ) : (
          <p className="mt-6 text-sm text-muted">Fale com o {businessName} pelos canais de sempre.</p>
        )}
        <p className="mt-4 text-[13px] text-muted">Já agendou? Seu comprovante continua valendo.</p>
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
          <p className="mt-3 text-center text-sm text-muted">Os horários voltam a aparecer quando o agendamento for reaberto.</p>
        </div>
      ) : null}
    </div>
  );
}
