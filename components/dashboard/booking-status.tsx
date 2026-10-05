import { StatusBadge } from "@/components/ui/status-badge";
import type { bookings } from "@/db/schema";

export function BookingStatus({ status, compact }: { status: typeof bookings.$inferSelect.status; compact?: boolean }) {
  return <StatusBadge status={status} compact={compact} />;
}
