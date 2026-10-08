import { Icon } from "@/components/ui/icon";
import { SUMMARY_ICONS } from "@/lib/icons/registry";
import type { AvailabilitySlot, PublicService } from "./types";
import { formatCurrency, formatDateFull, formatDuration, formatTimeSlot } from "./formatters";
import { DEPOSIT_NOW_LABEL, REMAINDER_LABEL } from "@/lib/copy/booking-summary";
import { cn } from "@/lib/utils";

interface BookingSummaryProps {
  service: PublicService | null;
  slot: AvailabilitySlot | null;
  timezone: string;
  /** `hero`: valor do sinal em destaque no topo (estilo Stripe). */
  variant?: "hero" | "plain";
  className?: string;
  headingLevel?: "h2" | "h3";
}

/** Resumo do pedido no estilo Stripe: valor em destaque, itens e total. */
export function BookingSummary({ service, slot, timezone, variant = "hero", className, headingLevel = "h2" }: BookingSummaryProps) {
  const Heading = headingLevel;
  const remainingCents = service ? Math.max(0, service.priceCents - service.depositCents) : 0;
  return (
    <section aria-label="Resumo do agendamento" className={cn("rounded-card border border-line bg-surface", className)}>
      {variant === "hero" && service && (
        <div className="border-b border-line p-5">
          <Heading className="font-sans text-sm font-semibold text-muted">{service.depositCents > 0 ? "Sinal a pagar agora" : "Total do serviço"}</Heading>
          <p className="mt-1 font-display text-4xl font-extrabold tracking-tight tabular-nums text-ink">
            {formatCurrency(service.depositCents > 0 ? service.depositCents : service.priceCents)}
          </p>
          {service.depositCents > 0 && <p className="mt-1 text-sm text-muted">via Pix · o restante você paga no local</p>}
        </div>
      )}
      <dl className="space-y-3 p-5 text-sm">
        <div className="flex items-start gap-3">
          <dt className="sr-only">Serviço</dt>
          <Icon icon={SUMMARY_ICONS.service} className="mt-0.5 size-4 shrink-0 text-muted" />
          <dd className="min-w-0 flex-1 font-semibold text-ink">{service ? service.name : <span className="font-normal text-muted">Escolha um serviço</span>}</dd>
          {service && <dd className="text-muted">{formatDuration(service.durationMinutes)}</dd>}
        </div>
        <div className="flex items-start gap-3">
          <dt className="sr-only">Data</dt>
          <Icon icon={SUMMARY_ICONS.date} className="mt-0.5 size-4 shrink-0 text-muted" />
          <dd className={cn("first-letter:uppercase", slot ? "font-semibold text-ink" : "text-muted")}>{slot ? formatDateFull(slot.startsAt, timezone) : "Escolha o dia"}</dd>
        </div>
        <div className="flex items-start gap-3">
          <dt className="sr-only">Horário</dt>
          <Icon icon={SUMMARY_ICONS.time} className="mt-0.5 size-4 shrink-0 text-muted" />
          <dd className={cn("tabular-nums", slot ? "font-semibold text-ink" : "text-muted")}>
            {slot ? `${formatTimeSlot(slot.startsAt, timezone)} – ${formatTimeSlot(slot.endsAt, timezone)}` : "Escolha o horário"}
          </dd>
        </div>
      </dl>
      {service && (
        <dl className="space-y-2 border-t border-line p-5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Valor do serviço</dt>
            <dd className="tabular-nums text-ink">{formatCurrency(service.priceCents)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{REMAINDER_LABEL}</dt>
            <dd className="tabular-nums text-ink">{formatCurrency(remainingCents)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 font-semibold">
            <dt className="text-ink">{DEPOSIT_NOW_LABEL}</dt>
            <dd className="tabular-nums text-pix">{formatCurrency(service.depositCents)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
