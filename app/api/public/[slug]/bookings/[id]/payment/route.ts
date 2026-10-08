import { appPreflight, withAppCors } from "@/lib/origins";
import { serializePublicBooking } from "@/lib/bookings/public-payload";
import { getBookingPayment } from "@/lib/bookings/service";
import { json } from "@/lib/http";

export async function GET(request: Request, context: RouteContext<"/api/public/[slug]/bookings/[id]/payment">) {
  return withAppCors(request, async () => {
    const { slug, id } = await context.params;
    return json(serializePublicBooking(await getBookingPayment(slug, id, request.headers.get("authorization"))));
  });
}

export function OPTIONS(request: Request) { return appPreflight(request, ["GET"]); }
