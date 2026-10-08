import { CalendarClock } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { EVE_CHIP_LABEL, eveDeadlineLine, PENDING_LABEL, refundListMarks, type RefundUiStatus } from "@/lib/dashboard/refund-ui";

const chip = "inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold";

/** Chip âmbar da véspera e a frase com a data real do prazo. */
export function RefundEveChip() {
  return (
    <span className={`${chip} border-warning/30 bg-warning-soft text-warning`}>
      <Icon icon={CalendarClock} size="sm" />
      {EVE_CHIP_LABEL}
    </span>
  );
}

export function RefundEveLine({ dueLabel }: { dueLabel: string }) {
  return <p className="text-sm font-semibold text-warning">{eveDeadlineLine(dueLabel)}</p>;
}

export function RefundMarks({ refundStatus, dueTomorrow }: { refundStatus: RefundUiStatus; dueTomorrow: boolean }) {
  const marks = refundListMarks({ refundStatus, manualRefundDueTomorrow: dueTomorrow });
  if (!marks.pending && !marks.eve && !marks.inProcess && !marks.refunded) return null;
  return (
    <>
      {marks.pending && <span className={`${chip} border-warning/30 bg-warning-soft text-warning`}>{PENDING_LABEL}</span>}
      {marks.eve && <RefundEveChip />}
      {marks.inProcess && <span className={`${chip} border-warning/30 bg-warning-soft text-warning`}>Devolução em andamento</span>}
      {marks.refunded && <span className={`${chip} border-success/25 bg-success-soft text-success`}>Devolvido</span>}
    </>
  );
}
