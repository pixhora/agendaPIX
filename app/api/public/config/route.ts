import { handleHttp } from "@/lib/http";
import { getPublicBookingFacts } from "@/lib/marketing/facts";

/** Prazo público do hold e do Pix. Cache curto: mudar `BOOKING_HOLD_MINUTES` não exige deploy de código. */
export function GET() {
  return handleHttp(async () => Response.json(await getPublicBookingFacts(), {
    headers: { "Cache-Control": "public, max-age=300" },
  }));
}
