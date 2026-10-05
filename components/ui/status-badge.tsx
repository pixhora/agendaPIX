import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { BOOKING_STATUS_ICONS } from "@/lib/icons/registry";

export type BookingStatusValue = "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";

const config: Record<BookingStatusValue, { label: string; short: string; Icon: LucideIcon; tone: string }> = {
  confirmed: { label: "Confirmado · sinal pago", short: "Pago", Icon: BOOKING_STATUS_ICONS.confirmed, tone: "border-success/25 bg-success-soft text-success" },
  pending_payment: { label: "Aguardando sinal Pix", short: "Pendente", Icon: BOOKING_STATUS_ICONS.pending_payment, tone: "border-warning/30 bg-warning-soft text-warning" },
  completed: { label: "Concluído", short: "Concluído", Icon: BOOKING_STATUS_ICONS.completed, tone: "border-line bg-subtle text-ink" },
  cancelled: { label: "Cancelado", short: "Cancelado", Icon: BOOKING_STATUS_ICONS.cancelled, tone: "border-danger/25 bg-danger-soft text-danger" },
  expired: { label: "Prazo do sinal encerrado", short: "Expirado", Icon: BOOKING_STATUS_ICONS.expired, tone: "border-line bg-subtle text-muted" },
};

/** Status com ícone + texto + cor (não depende só da cor — WCAG 1.4.1). */
export function StatusBadge({ status, compact = false, className }: { status: BookingStatusValue; compact?: boolean; className?: string }) {
  const { label, short, Icon: IconGlyph, tone } = config[status];
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold", tone, className)}>
      <Icon icon={IconGlyph} size="sm" />
      {compact ? <><span aria-hidden="true">{short}</span><span className="sr-only">{label}</span></> : label}
    </span>
  );
}

export function statusLabel(status: BookingStatusValue) {
  return config[status].label;
}
