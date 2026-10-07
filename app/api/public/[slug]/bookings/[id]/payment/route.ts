import { appPreflight, withAppCors } from "@/lib/origins";
import { getBookingPayment } from "@/lib/bookings/service";
import { json } from "@/lib/http";
import { extractBookingToken, clearBookingCookie } from "@/lib/bookings/cookies";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/bookings/[id]/payment">) {
  return withAppCors(request, async () => {
    const { slug, id } = await context.params;
    const token = extractBookingToken(request);
    const payment = await getBookingPayment(slug, id, token);
    const response = json(payment);
    
    if (["confirmed", "expired", "cancelled"].includes(payment.status)) {
      response.headers.set("Set-Cookie", clearBookingCookie());
    }
    
    return response;
  });
}

export function OPTIONS(request: Request) { return appPreflight(request, ["GET"]); }
