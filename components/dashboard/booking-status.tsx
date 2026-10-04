import { StatusChip } from "../ui/value-slab";
import type { bookings } from "@/db/schema";

const labels = {
  pending_payment: "Aguardando sinal",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  expired: "Prazo do sinal encerrado",
  completed: "Concluído",
} satisfies Record<typeof bookings.$inferSelect.status, string>;

export function BookingStatus({ status }: { status: typeof bookings.$inferSelect.status }) {
  return <StatusChip active={status === "confirmed"}>{labels[status]}</StatusChip>;
}
