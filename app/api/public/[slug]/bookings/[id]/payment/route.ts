import { getDb } from "@/db";
import { appPreflight, withAppCors } from "@/lib/origins";
import { serializePublicBooking } from "@/lib/bookings/public-payload";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { getBookingPayment } from "@/lib/bookings/service";
import { json } from "@/lib/http";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/bookings/[id]/payment">) {
  return withAppCors(request, async () => {
    const { slug, id } = await context.params;
    const view = await getBookingPayment(slug, id, request.headers.get("authorization"), getDb(), bookingClientIdentity(request));
    return json(serializePublicBooking(view));
  });
}

export function OPTIONS(request: Request) { return appPreflight(request, ["GET"]); }
