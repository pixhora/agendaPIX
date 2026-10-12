import { readSlotLinkOgCard } from "@/lib/bookings/slot-link";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { availableSlotLinkOgResponse, unavailableSlotLinkOgResponse } from "@/lib/slot-link/og-response";

export const runtime = "nodejs";

/**
 * Imagem da prévia. Ocupado, expirado, pago e previewId inexistente devolvem
 * o mesmo status, os mesmos cabeçalhos e os mesmos bytes: só a marca AgendaPix.
 * O cartão disponível usa nome, logo, serviço e horário públicos. Sem quem reservou.
 */
export async function GET(request: Request, context: RouteContext<"/og/slot-link/[previewId]">) {
  const { previewId } = await context.params;
  const card = await readSlotLinkOgCard(previewId, bookingClientIdentity(request));
  if (card.kind === "unavailable") return unavailableSlotLinkOgResponse();
  return availableSlotLinkOgResponse(card);
}
