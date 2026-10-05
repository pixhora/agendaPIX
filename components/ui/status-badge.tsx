import { Ban, CheckCircle2, CircleCheckBig, Clock3, TimerOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingStatusValue = "pending_payment" | "confirmed" | "cancelled" | "expired" | "completed";

const config: Record<BookingStatusValue, { label: string; short: string; Icon: typeof Clock3; tone: string }> = {
  confirmed: { label: "Confirmado · sinal pago", short: "Pago", Icon: CheckCircle2, tone: "border-success/25 bg-success-soft text-success" },
  pending_payment: { label: "Aguardando sinal Pix", short: "Pendente", Icon: Clock3, tone: "border-warning/30 bg-warning-soft text-warning" },
  completed: { label: "Concluído", short: "Concluído", Icon: CircleCheckBig, tone: "border-line bg-subtle text-ink" },
  cancelled: { label: "Cancelado", short: "Cancelado", Icon: Ban, tone: "border-line bg-subtle text-muted" },
  expired: { label: "Prazo do sinal encerrado", short: "Expirado", Icon: TimerOff, tone: "border-line bg-subtle text-muted" },
};

/** Status com ícone + texto + cor (não depende só da cor — WCAG 1.4.1). */
export function StatusBadge({ status, compact = false, className }: { status: BookingStatusValue; compact?: boolean; className?: string }) {
  const { label, short, Icon, tone } = config[status];
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold", tone, className)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {compact ? <><span aria-hidden="true">{short}</span><span className="sr-only">{label}</span></> : label}
    </span>
  );
}

export function statusLabel(status: BookingStatusValue) {
  return config[status].label;
}
